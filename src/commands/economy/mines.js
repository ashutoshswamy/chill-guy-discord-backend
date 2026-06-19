const {
    SlashCommandBuilder,
    ContainerBuilder, SectionBuilder, TextDisplayBuilder, ThumbnailBuilder,
    SeparatorBuilder, SeparatorSpacingSize,
    ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags
} = require('discord.js');
const db = require('../../utils/db');
const { getEmoji } = require('../../utils/emojis');

const coin = getEmoji('coin');

function getMultiplier(minesCount, safeRevealedCount) {
    if (safeRevealedCount === 0) return 1.0;
    let prob = 1.0;
    const totalTiles = 16;
    for (let i = 0; i < safeRevealedCount; i++) {
        prob *= (totalTiles - minesCount - i) / (totalTiles - i);
    }
    const raw = 1.0 / prob;
    // Add a 5% house edge
    return parseFloat((raw * 0.95).toFixed(2));
}


function generateMinesGrid(minesCount) {
    const grid = new Array(16).fill('gem');
    let placed = 0;
    while (placed < minesCount) {
        const idx = Math.floor(Math.random() * 16);
        if (grid[idx] !== 'mine') {
            grid[idx] = 'mine';
            placed++;
        }
    }
    return grid;
}

const sessions = new Map();

const COOLDOWN_MS = 15 * 1000;

module.exports = {
    data: new SlashCommandBuilder()
        .setName('mines')
        .setDescription('Play Mines. Reveal safe tiles to multiply your bet, cash out before hitting a mine.')
        .addIntegerOption(opt =>
            opt.setName('bet')
                .setDescription('Amount to bet from wallet')
                .setRequired(true)
                .setMinValue(10))
        .addIntegerOption(opt =>
            opt.setName('mines')
                .setDescription('Number of mines on the grid (1-15, default: 3)')
                .setRequired(false)
                .setMinValue(1)
                .setMaxValue(15)),

    async execute(interaction) {
        const { user } = interaction;
        const bet = interaction.options.getInteger('bet');
        const minesCount = interaction.options.getInteger('mines') || 3;

        const cd = await db.checkAndSetCooldown(user.id, 'mines', COOLDOWN_MS);
        if (cd.onCooldown) {
            const s = Math.ceil(cd.remaining / 1000);
            return interaction.editReply({ content: `On cooldown! Try again in **${s}s**.`, ephemeral: true });
        }

        try {
            const profile = await db.getUser(user.id);
            if (profile.wallet < bet) {
                return interaction.editReply({ content: `Not enough coins in wallet. You have ${coin} **${profile.wallet.toLocaleString()}** coins.`, ephemeral: true });
            }

            // Deduct bet
            await db.updateWallet(user.id, -bet);

            const grid = generateMinesGrid(minesCount);
            const revealed = new Array(16).fill(false);

            sessions.set(user.id, {
                grid,
                revealed,
                minesCount,
                bet,
                safeRevealedCount: 0,
                explodedIdx: -1,
                done: false
            });

            const buildView = (session, done = false) => {
                const { grid, revealed, minesCount, bet, safeRevealedCount, explodedIdx } = session;
                const currentMult = getMultiplier(minesCount, safeRevealedCount);
                const nextMult = getMultiplier(minesCount, safeRevealedCount + 1);
                const potentialWinnings = Math.floor(bet * currentMult);
                const nextWinnings = Math.floor(bet * nextMult);

                let contentText = '';
                if (done) {
                    if (explodedIdx !== -1) {
                        contentText = `### Game Over!\nYou hit a mine and lost your bet of ${coin} **${bet.toLocaleString()}** coins.`;
                    } else {
                        contentText = `### Cashed Out!\nYou successfully cashed out at **${currentMult}x** multiplier.\n` +
                            `**Won:** ${coin} **+${(potentialWinnings - bet).toLocaleString()}** coins!`;
                    }
                } else {
                    contentText = `Click tiles below to reveal gems and multiply your bet. Cash out before you hit a mine!\n\n` +
                        `**Current Multiplier:** **${currentMult}x** (Winnings: ${coin} **${potentialWinnings.toLocaleString()}**)\n` +
                        `**Next Tile Multiplier:** **${nextMult}x** (Winnings: ${coin} **${nextWinnings.toLocaleString()}**)\n` +
                        `**Mines Count:** **${minesCount}** / 16`;
                }

                const container = new ContainerBuilder()
                    .addSectionComponents(
                        new SectionBuilder()
                            .addTextDisplayComponents(
                                new TextDisplayBuilder().setContent(`## Mines Game\n${contentText}`)
                            )
                            .setThumbnailAccessory(new ThumbnailBuilder().setURL(user.displayAvatarURL({ forceStatic: true })))
                    );

                // Build grid rows
                for (let r = 0; r < 4; r++) {
                    const rowComponents = [];
                    for (let c = 0; c < 4; c++) {
                        const idx = r * 4 + c;
                        const isRevealed = revealed[idx];
                        const isMine = grid[idx] === 'mine';
                        const shouldShow = isRevealed || done;

                        let btnLabel = '?';
                        let btnStyle = ButtonStyle.Primary;

                        if (shouldShow) {
                            if (isMine) {
                                btnLabel = idx === explodedIdx ? '*' : 'M';
                                btnStyle = ButtonStyle.Danger;
                            } else {
                                btnLabel = 'o';
                                btnStyle = ButtonStyle.Success;
                            }
                        }

                        rowComponents.push(
                            new ButtonBuilder()
                                .setCustomId(`mines_tile_${idx}`)
                                .setLabel(btnLabel)
                                .setStyle(btnStyle)
                                .setDisabled(isRevealed || done)
                        );
                    }
                    container.addActionRowComponents(new ActionRowBuilder().addComponents(rowComponents));
                }

                // Add Cash Out button
                container.addActionRowComponents(
                    new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setCustomId('mines_cash_out')
                            .setLabel('Cash Out')
                            .setStyle(ButtonStyle.Success)
                            .setDisabled(safeRevealedCount === 0 || done)
                    )
                );

                return container;
            };

            const response = await interaction.editReply({
                flags: MessageFlags.IsComponentsV2,
                components: [buildView(sessions.get(user.id))]
            });

            const collector = response.createMessageComponentCollector({
                filter: i => i.user.id === user.id,
                time: 180_000
            });

            collector.on('collect', async i => {
                await i.deferUpdate();
                const session = sessions.get(user.id);
                if (!session || session.done) return;

                if (i.customId === 'mines_cash_out') {
                    session.done = true;
                    collector.stop('cashed_out');
                    const winnings = Math.floor(session.bet * getMultiplier(session.minesCount, session.safeRevealedCount));
                    if (winnings > 0) {
                        await db.updateWallet(user.id, winnings);
                    }
                    const updated = await db.getUser(user.id);
                    const final = buildView(session, true);
                    final.addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(`**Wallet:** ${coin} ${updated.wallet.toLocaleString()} coins`)
                    );
                    return interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [final] }).catch(() => null);
                }

                const tileIdx = parseInt(i.customId.replace('mines_tile_', ''));
                session.revealed[tileIdx] = true;

                if (session.grid[tileIdx] === 'mine') {
                    // Exploded!
                    session.done = true;
                    session.explodedIdx = tileIdx;
                    collector.stop('exploded');
                    const updated = await db.getUser(user.id);
                    const final = buildView(session, true);
                    final.addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(`**Wallet:** ${coin} ${updated.wallet.toLocaleString()} coins`)
                    );
                    return interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [final] }).catch(() => null);
                }

                session.safeRevealedCount++;
                const maxSafe = 16 - session.minesCount;
                if (session.safeRevealedCount === maxSafe) {
                    // All safe tiles revealed! Auto Cash Out!
                    session.done = true;
                    collector.stop('won_all');
                    const winnings = Math.floor(session.bet * getMultiplier(session.minesCount, session.safeRevealedCount));
                    await db.updateWallet(user.id, winnings);
                    const updated = await db.getUser(user.id);
                    const final = buildView(session, true);
                    final.addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(
                            `**Perfect Game!** All safe tiles cleared!\n` +
                            `**Wallet:** ${coin} ${updated.wallet.toLocaleString()} coins`
                        )
                    );
                    return interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [final] }).catch(() => null);
                }

                await interaction.editReply({
                    flags: MessageFlags.IsComponentsV2,
                    components: [buildView(session)]
                }).catch(() => null);
            });

            collector.on('end', async (_, reason) => {
                const session = sessions.get(user.id);
                if (!session || session.done) return;
                session.done = true;
                // Auto cash out at current progress
                const winnings = Math.floor(session.bet * getMultiplier(session.minesCount, session.safeRevealedCount));
                if (winnings > 0) {
                    await db.updateWallet(user.id, winnings);
                }
                const updated = await db.getUser(user.id);
                const final = buildView(session, true);
                final.addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        `*(Timed out - auto cashed out)*\n` +
                        `**Wallet:** ${coin} ${updated.wallet.toLocaleString()} coins`
                    )
                );
                await interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [final] }).catch(() => null);
                sessions.delete(user.id);
            });

        } catch (err) {
            console.error('[MINES ERROR]', err);
            const msg = { content: 'Mines game failed.', ephemeral: true };
            if (interaction.replied || interaction.deferred) await interaction.followUp(msg).catch(() => null);
            else await interaction.editReply(msg).catch(() => null);
        }
    }
};
