const {
    SlashCommandBuilder,
    ContainerBuilder, SectionBuilder, TextDisplayBuilder, ThumbnailBuilder,
    SeparatorBuilder, SeparatorSpacingSize,
    ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags
} = require('discord.js');
const db = require('../../utils/db');
const { checkCooldown } = require('../../utils/cooldowns');
const { getEmoji } = require('../../utils/emojis');

const coin = getEmoji('coin');

const CARD_TYPES = [
    { name: 'Bronze', cost: 50,  emoji: 'Bronze', prizes: [0,0,0,0,25,50,75,100,150,200,250,500],       jackpot: 1000  },
    { name: 'Silver', cost: 150, emoji: 'Silver', prizes: [0,0,0,50,100,150,200,300,400,500,750,1500],   jackpot: 5000  },
    { name: 'Gold',   cost: 500, emoji: 'Gold',   prizes: [0,0,50,100,250,500,750,1000,1500,2000,3000,5000], jackpot: 20000 },
];

const SYMBOLS = ['Diamond', 'Star', 'Clover', 'Bell', 'Target', 'Money', 'Dice', 'Card', 'Tent', 'Shine'];
const SCRATCH_EMOJIS = {
    'Diamond': '💎',
    'Star': '⭐',
    'Clover': '🍀',
    'Bell': '🔔',
    'Target': '🎯',
    'Money': '💵',
    'Dice': '🎲',
    'Card': '🃏',
    'Tent': '⛺',
    'Shine': '✨'
};

function generateGrid(cardType) {
    // 3x3 grid - determine win first, then build grid
    const prize = cardType.prizes[Math.floor(Math.random() * cardType.prizes.length)];
    const isJackpot = Math.random() < 0.001; // 0.1% jackpot

    const finalPrize = isJackpot ? cardType.jackpot : prize;

    // Pick a winning symbol (or none for 0 prize)
    const winSymbol = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
    const grid = [];

    if (finalPrize > 0) {
        // Place 3 matching symbols in random positions
        const positions = [0,1,2,3,4,5,6,7,8].sort(() => Math.random() - 0.5).slice(0, 3);
        for (let i = 0; i < 9; i++) {
            if (positions.includes(i)) {
                grid.push(winSymbol);
            } else {
                let s;
                do { s = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)]; } while (s === winSymbol);
                grid.push(s);
            }
        }
    } else {
        // Ensure no 3-of-a-kind
        const used = {};
        for (let i = 0; i < 9; i++) {
            let s;
            let attempts = 0;
            do {
                s = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
                attempts++;
            } while ((used[s] || 0) >= 2 && attempts < 20);
            used[s] = (used[s] || 0) + 1;
            grid.push(s);
        }
    }

    return { grid, prize: finalPrize, winSymbol: finalPrize > 0 ? winSymbol : null, isJackpot };
}


function getRevealedStats(grid, revealed) {
    const counts = {};
    for (let i = 0; i < 9; i++) {
        if (revealed[i]) {
            const sym = grid[i];
            counts[sym] = (counts[sym] || 0) + 1;
        }
    }
    const lines = Object.entries(counts)
        .map(([sym, count]) => `**${SCRATCH_EMOJIS[sym]} ${sym}**: x${count}`)
        .join(' | ');
    return lines ? lines : 'None yet';
}

function rollMultiplier() {
    const rand = Math.random();
    if (rand < 0.01) return 5;
    if (rand < 0.05) return 3;
    if (rand < 0.20) return 2;
    return 1;
}

// Sessions stored in memory (per-user)
const sessions = new Map();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('scratchcard')
        .setDescription('Buy a scratch card and reveal tiles to find matching symbols.')
        .addStringOption(opt =>
            opt.setName('tier')
                .setDescription('Card tier (default: Bronze)')
                .setRequired(false)
                .addChoices(
                    { name: 'Bronze - 50 coins', value: 'Bronze' },
                    { name: 'Silver - 150 coins', value: 'Silver' },
                    { name: 'Gold - 500 coins', value: 'Gold' },
                )),

    async execute(interaction) {
        const { user } = interaction;
        const tierName = interaction.options.getString('tier') || 'Bronze';
        const cardType = CARD_TYPES.find(c => c.name === tierName);

        const cd = checkCooldown('scratchcard', user.id, 15);
        if (cd.onCooldown) {
            return interaction.editReply({ content: `Scratching too fast. Wait **${cd.remaining}s**.`, ephemeral: true });
        }

        try {
            const profile = await db.getUser(user.id);
            if (profile.wallet < cardType.cost) {
                return interaction.editReply({ content: `Not enough coins. ${cardType.name} card costs ${coin} **${cardType.cost}**.`, ephemeral: true });
            }

            await db.updateWallet(user.id, -cardType.cost);

            const { grid, prize, winSymbol, isJackpot } = generateGrid(cardType);
            const revealed = new Array(9).fill(false);
            const multiplier = rollMultiplier();

            sessions.set(user.id, {
                grid,
                prize,
                winSymbol,
                isJackpot,
                revealed,
                multiplier,
                bonusRevealed: false,
                cardType,
                done: false
            });

            const buildView = (session) => {
                const { grid, prize, revealed, multiplier, bonusRevealed, cardType, done, isJackpot } = session;
                const won = done && prize > 0;
                const finalPrize = prize * multiplier;

                let title = `## ${cardType.name} Scratch Card\n`;
                if (done) {
                    if (won) {
                        title += `${isJackpot ? 'JACKPOT! ' : ''}You won ${coin} **${finalPrize.toLocaleString()} coins**!`;
                        if (multiplier > 1) {
                            title += ` (Base prize ${coin} ${prize} x${multiplier} Multiplier)`;
                        }
                    } else {
                        title += `No match. Better luck next time.`;
                    }
                } else {
                    title += `Scratch tiles to reveal symbols. Three matching = win!`;
                }

                const container = new ContainerBuilder()
                    .addSectionComponents(
                        new SectionBuilder()
                            .addTextDisplayComponents(
                                new TextDisplayBuilder().setContent(title)
                            )
                            .setThumbnailAccessory(new ThumbnailBuilder().setURL(user.displayAvatarURL({ forceStatic: true })))
                    )
                    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(
                            `**Matches:** ${getRevealedStats(grid, done ? new Array(9).fill(true) : revealed)}\n` +
                            `**Card Cost:** ${coin} ${cardType.cost.toLocaleString()} coins\n` +
                            `**Multiplier:** ${bonusRevealed || done ? `x${multiplier}` : '?'}\n` +
                            (won ? `**Won:** ${coin} +${finalPrize.toLocaleString()} coins\n` : '') +
                            `**Jackpot:** ${coin} ${cardType.jackpot.toLocaleString()} coins`
                        )
                    );

                // Row 1 (tiles 0-2)
                container.addActionRowComponents(
                    new ActionRowBuilder().addComponents(
                        ...[0,1,2].map(i =>
                            new ButtonBuilder()
                                .setCustomId(`sc_tile_${i}`)
                                .setLabel(revealed[i] || done ? SCRATCH_EMOJIS[grid[i]] : '❓')
                                .setStyle(revealed[i] || done ? ButtonStyle.Secondary : ButtonStyle.Primary)
                                .setDisabled(revealed[i] || done)
                        )
                    )
                );
                // Row 2 (tiles 3-5)
                container.addActionRowComponents(
                    new ActionRowBuilder().addComponents(
                        ...[3,4,5].map(i =>
                            new ButtonBuilder()
                                .setCustomId(`sc_tile_${i}`)
                                .setLabel(revealed[i] || done ? SCRATCH_EMOJIS[grid[i]] : '❓')
                                .setStyle(revealed[i] || done ? ButtonStyle.Secondary : ButtonStyle.Primary)
                                .setDisabled(revealed[i] || done)
                        )
                    )
                );
                // Row 3 (tiles 6-8)
                container.addActionRowComponents(
                    new ActionRowBuilder().addComponents(
                        ...[6,7,8].map(i =>
                            new ButtonBuilder()
                                .setCustomId(`sc_tile_${i}`)
                                .setLabel(revealed[i] || done ? SCRATCH_EMOJIS[grid[i]] : '❓')
                                .setStyle(revealed[i] || done ? ButtonStyle.Secondary : ButtonStyle.Primary)
                                .setDisabled(revealed[i] || done)
                        )
                    )
                );
                // Row 4: Multiplier and Reveal All
                const row4 = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId('sc_bonus')
                        .setLabel(bonusRevealed || done ? `Multiplier: x${multiplier}` : 'Reveal Multiplier')
                        .setStyle(bonusRevealed || done ? ButtonStyle.Success : ButtonStyle.Primary)
                        .setDisabled(bonusRevealed || done)
                );
                if (!done) {
                    row4.addComponents(
                        new ButtonBuilder()
                            .setCustomId('sc_reveal_all')
                            .setLabel('Reveal All')
                            .setStyle(ButtonStyle.Danger)
                    );
                }
                container.addActionRowComponents(row4);

                return container;
            };

            const response = await interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [buildView(sessions.get(user.id))] });

            const collector = response.createMessageComponentCollector({
                filter: i => i.user.id === user.id,
                time: 120_000
            });

            collector.on('collect', async i => {
                await i.deferUpdate();
                const session = sessions.get(user.id);
                if (!session || session.done) return;

                if (i.customId === 'sc_reveal_all') {
                    session.revealed.fill(true);
                    session.bonusRevealed = true;
                } else if (i.customId === 'sc_bonus') {
                    session.bonusRevealed = true;
                } else {
                    const tileIdx = parseInt(i.customId.replace('sc_tile_', ''));
                    session.revealed[tileIdx] = true;
                }

                const allRevealed = session.revealed.every(Boolean);
                if (allRevealed) {
                    session.done = true;
                    session.bonusRevealed = true;
                    collector.stop('done');
                    const finalPrize = session.prize * session.multiplier;
                    if (finalPrize > 0) {
                        await db.updateWallet(user.id, finalPrize);
                    }
                    const updated = await db.getUser(user.id);
                    const final = buildView(session);
                    final.addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(`**Wallet:** ${coin} ${updated.wallet.toLocaleString()} coins`)
                    );
                    return interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [final] }).catch(() => null);
                }

                await interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [buildView(session)] }).catch(() => null);
            });

            collector.on('end', async (_, reason) => {
                const session = sessions.get(user.id);
                if (!session || session.done) return;
                session.done = true;
                session.revealed.fill(true);
                session.bonusRevealed = true;
                const finalPrize = session.prize * session.multiplier;
                if (finalPrize > 0) await db.updateWallet(user.id, finalPrize);
                const updated = await db.getUser(user.id);
                const final = buildView(session);
                final.addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(`*(Timed out - auto-revealed)*\n**Wallet:** ${coin} ${updated.wallet.toLocaleString()} coins`)
                );
                await interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [final] }).catch(() => null);
                sessions.delete(user.id);
            });

        } catch (err) {
            console.error('[SCRATCHCARD ERROR]', err);
            const msg = { content: 'Scratch card failed.', ephemeral: true };
            if (interaction.replied || interaction.deferred) await interaction.followUp(msg).catch(() => null);
            else await interaction.editReply(msg).catch(() => null);
        }
    }
};
