const {
    SlashCommandBuilder,
    ContainerBuilder, SectionBuilder, TextDisplayBuilder, ThumbnailBuilder,
    SeparatorBuilder, SeparatorSpacingSize,
    ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags
} = require('discord.js');
const db = require('../../utils/db');
const { checkCooldown } = require('../../utils/cooldowns');
const { XP_REWARDS } = require('../../utils/xp');
const { getEmoji } = require('../../utils/emojis');

const coin = getEmoji('coin');

// Provably-fair-ish crash point: heavy-tailed distribution
// ~50% crash before 2x, ~25% before 3x, ~12.5% before 5x, etc.
function generateCrashPoint() {
    const r = Math.random();
    if (r < 0.01) return 1.00; // 1% instant crash
    const crash = Math.max(1.00, 0.99 / (1 - r));
    return Math.floor(crash * 100) / 100;
}

function buildCrashContainer(user, bet, currentMult, crashPoint, status, cashoutMult = null) {
    const isLive = status === 'live';
    const isCrashed = status === 'crashed';
    const isCashout = status === 'cashout';

    const bar = buildBar(currentMult, crashPoint);

    let resultLine = '';
    if (isCashout) {
        const payout = Math.floor(bet * cashoutMult);
        resultLine = `\n\n**Cashed out at ${cashoutMult}x!**\n**Won:** ${coin} **+${(payout - bet).toLocaleString()}** coins`;
    } else if (isCrashed) {
        resultLine = `\n\n**CRASHED at ${crashPoint}x!**\n**Lost:** ${coin} **-${bet.toLocaleString()}** coins`;
    }

    const container = new ContainerBuilder()
        .addSectionComponents(
            new SectionBuilder()
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        `## Crash - ${isLive ? `${currentMult}x` : isCrashed ? `Crashed!` : `${cashoutMult}x`}`
                    )
                )
                .setThumbnailAccessory(new ThumbnailBuilder().setURL(user.displayAvatarURL({ forceStatic: true })))
        )
        .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `${bar}\n\n` +
                `**Bet:** ${coin} **${bet.toLocaleString()}** coins\n` +
                `**Multiplier:** ${isLive ? currentMult : isCrashed ? crashPoint : cashoutMult}x\n` +
                `**Potential:** ${coin} **${Math.floor(bet * currentMult).toLocaleString()}** coins` +
                resultLine
            )
        );

    return container;
}

function buildBar(current, crash) {
    const maxDisplay = Math.max(crash * 1.1, 10);
    const pct = Math.min((current - 1) / (maxDisplay - 1), 1);
    const filled = Math.floor(pct * 20);
    const bar = '█'.repeat(filled) + '░'.repeat(20 - filled);
    return `\`[${bar}] ${current}x\``;
}

const TICK_MS = 1500;
const TICKS = [1.2, 1.5, 1.8, 2.1, 2.5, 3.0, 3.5, 4.0, 5.0, 6.0, 7.5, 10.0];

module.exports = {
    data: new SlashCommandBuilder()
        .setName('crash')
        .setDescription('Bet on a rising multiplier. Cash out before it crashes!')
        .addIntegerOption(opt =>
            opt.setName('amount')
                .setDescription('Amount to bet from your wallet')
                .setMinValue(10)
                .setRequired(true)),

    async execute(interaction) {
        const { user } = interaction;
        const amount = interaction.options.getInteger('amount');

        const cd = checkCooldown('crash', user.id, 20);
        if (cd.onCooldown) {
            return interaction.editReply({ content: `Crash cooling down. Wait **${cd.remaining}s**.`, ephemeral: true });
        }

        try {
            const profile = await db.getUser(user.id);
            if (profile.wallet < amount) {
                return interaction.editReply({ content: `Not enough coins. You have ${coin} **${profile.wallet.toLocaleString()}** in wallet.`, ephemeral: true });
            }

            await db.updateWallet(user.id, -amount);

            const crashPoint = generateCrashPoint();
            let tickIndex = 0;
            let cashedOut = false;
            let currentMult = 1.00;

            const initialContainer = buildCrashContainer(user, amount, currentMult, crashPoint, 'live');
            initialContainer.addActionRowComponents(
                new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId('crash_cashout')
                        .setLabel(`Cash Out (${currentMult}x)`)
                        .setStyle(ButtonStyle.Success)
                )
            );

            const response = await interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [initialContainer] });

            const collector = response.createMessageComponentCollector({
                filter: i => i.user.id === user.id,
                time: 45_000
            });

            collector.on('collect', async i => {
                if (i.customId === 'crash_cashout' && !cashedOut) {
                    cashedOut = true;
                    collector.stop('cashout');
                    await i.deferUpdate();

                    const payout = Math.floor(amount * currentMult);
                    await db.updateWallet(user.id, payout);
                    db.addXP(user.id, XP_REWARDS.gamblingWin).catch(() => null);
                    const updated = await db.getUser(user.id);

                    const final = buildCrashContainer(user, amount, currentMult, crashPoint, 'cashout', currentMult);
                    final.addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(`**Crash Point Was:** ${crashPoint}x\n**Wallet:** ${coin} **${updated.wallet.toLocaleString()}** coins`)
                    );
                    await interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [final] }).catch(() => null);
                }
            });

            // Tick loop
            const tick = async () => {
                if (cashedOut) return;

                if (tickIndex < TICKS.length) {
                    currentMult = TICKS[tickIndex];
                    tickIndex++;
                } else {
                    currentMult = Math.floor((currentMult + currentMult * 0.15) * 100) / 100;
                }

                if (currentMult >= crashPoint) {
                    cashedOut = true; // prevent cashout race
                    collector.stop('crashed');

                    const final = buildCrashContainer(user, amount, crashPoint, crashPoint, 'crashed');
                    final.addActionRowComponents(
                        new ActionRowBuilder().addComponents(
                            new ButtonBuilder()
                                .setCustomId('crash_cashout_dead')
                                .setLabel('Crashed!')
                                .setStyle(ButtonStyle.Danger)
                                .setDisabled(true)
                        )
                    );
                    const updated = await db.getUser(user.id);
                    final.addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(`**Wallet:** ${coin} **${updated.wallet.toLocaleString()}** coins`)
                    );
                    await interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [final] }).catch(() => null);
                    return;
                }

                const live = buildCrashContainer(user, amount, currentMult, crashPoint, 'live');
                live.addActionRowComponents(
                    new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setCustomId('crash_cashout')
                            .setLabel(`Cash Out (${currentMult}x)`)
                            .setStyle(ButtonStyle.Success)
                    )
                );
                await interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [live] }).catch(() => null);

                setTimeout(tick, TICK_MS);
            };

            setTimeout(tick, TICK_MS);

            collector.on('end', async (_, reason) => {
                if (reason === 'time' && !cashedOut) {
                    cashedOut = true;
                    const final = buildCrashContainer(user, amount, currentMult, crashPoint, 'crashed');
                    final.addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(`*(Timed out - auto-lost)*`)
                    );
                    await interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [final] }).catch(() => null);
                }
            });

        } catch (err) {
            console.error('[CRASH ERROR]', err);
            const msg = { content: 'Crash game failed.', ephemeral: true };
            if (interaction.replied || interaction.deferred) await interaction.followUp(msg).catch(() => null);
            else await interaction.editReply(msg).catch(() => null);
        }
    }
};
