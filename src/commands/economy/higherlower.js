const {
    SlashCommandBuilder,
    ContainerBuilder, SectionBuilder, TextDisplayBuilder, ThumbnailBuilder,
    SeparatorBuilder, SeparatorSpacingSize,
    ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags
} = require('discord.js');
const db = require('../../utils/db');
const { XP_REWARDS } = require('../../utils/xp');
const { getEmoji } = require('../../utils/emojis');

const coin = getEmoji('coin');

const MULTIPLIERS = [1, 1.5, 2, 3, 4, 6, 9, 14, 20, 30];

function buildContainer(user, bet, current, round, potentialWin, status = null, prevNum = null, correct = null) {
    const roundDisplay = round + 1;
    const nextMult = MULTIPLIERS[Math.min(round, MULTIPLIERS.length - 1)];

    let statusLine = '';
    if (status === 'win') statusLine = `\n\n**Cashed out!**`;
    else if (status === 'lose') statusLine = `\n\n**Wrong! You lost!**`;
    else if (status === 'max') statusLine = `\n\n**Max round! Auto cash-out!**`;

    const historyLine = prevNum !== null ? `Previous: **${prevNum}** → **${current}** ${correct ? 'correct' : 'wrong'}\n` : '';

    const container = new ContainerBuilder()
        .addSectionComponents(
            new SectionBuilder()
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(`## Higher or Lower - Round ${roundDisplay}`)
                )
                .setThumbnailAccessory(new ThumbnailBuilder().setURL(user.displayAvatarURL({ forceStatic: true })))
        )
        .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `${historyLine}` +
                `**Current Number:** \`${current}\`\n` +
                `**Bet:** ${coin} **${bet.toLocaleString()}** coins\n` +
                `**Potential Win:** ${coin} **${Math.floor(bet * nextMult).toLocaleString()}** coins (${nextMult}x)\n` +
                `**Round:** ${roundDisplay} / ${MULTIPLIERS.length}` +
                statusLine
            )
        );

    return container;
}

module.exports = {
    cooldown: 8,
    data: new SlashCommandBuilder()
        .setName('higherlower')
        .setDescription('Guess higher or lower. Keep going to multiply your winnings.')
        .addIntegerOption(opt =>
            opt.setName('amount')
                .setDescription('Amount to bet from your wallet')
                .setMinValue(10)
                .setRequired(true)),

    async execute(interaction) {
        const { user } = interaction;
        const amount = interaction.options.getInteger('amount');

        try {
            const profile = await db.getUser(user.id);
            if (profile.wallet < amount) {
                return interaction.editReply({ content: `Not enough coins. You have ${coin} **${profile.wallet.toLocaleString()}** in wallet.`, ephemeral: true });
            }

            await db.updateWallet(user.id, -amount);

            let currentNum = Math.floor(Math.random() * 100) + 1;
            let round = 0;

            const container = buildContainer(user, amount, currentNum, round, amount);
            container.addActionRowComponents(
                new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('hl_higher').setLabel('Higher').setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId('hl_lower').setLabel('Lower').setStyle(ButtonStyle.Danger),
                    new ButtonBuilder().setCustomId('hl_cashout').setLabel('Cash Out').setStyle(ButtonStyle.Secondary).setDisabled(true)
                )
            );

            const response = await interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [container] });

            const collector = response.createMessageComponentCollector({
                filter: i => i.user.id === user.id,
                time: 60_000
            });

            collector.on('collect', async i => {
                await i.deferUpdate();

                if (i.customId === 'hl_cashout') {
                    collector.stop('cashout');
                    const winMult = MULTIPLIERS[Math.min(round, MULTIPLIERS.length - 1)];
                    const payout = Math.floor(amount * winMult);
                    await db.updateWallet(user.id, payout);
                    db.addXP(user.id, XP_REWARDS.gamblingWin).catch(() => null);
                    const updated = await db.getUser(user.id);

                    const final = buildContainer(user, amount, currentNum, round, payout, 'win');
                    final.addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(`**Payout:** ${coin} **+${payout.toLocaleString()}** coins (${winMult}x)\n**Wallet:** ${coin} **${updated.wallet.toLocaleString()}** coins`)
                    );
                    return interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [final] }).catch(() => null);
                }

                const prevNum = currentNum;
                const nextNum = Math.floor(Math.random() * 100) + 1;

                let guessedHigher = i.customId === 'hl_higher';
                // If same number, always wrong (edge case)
                const correct = nextNum !== prevNum && (guessedHigher ? nextNum > prevNum : nextNum < prevNum);

                currentNum = nextNum;

                if (!correct) {
                    collector.stop('lose');
                    const updated = await db.getUser(user.id);
                    const final = buildContainer(user, amount, currentNum, round, 0, 'lose', prevNum, false);
                    final.addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(`**Lost:** ${coin} **-${amount.toLocaleString()}** coins\n**Wallet:** ${coin} **${updated.wallet.toLocaleString()}** coins`)
                    );
                    return interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [final] }).catch(() => null);
                }

                round++;

                if (round >= MULTIPLIERS.length) {
                    collector.stop('max');
                    const winMult = MULTIPLIERS[MULTIPLIERS.length - 1];
                    const payout = Math.floor(amount * winMult);
                    await db.updateWallet(user.id, payout);
                    db.addXP(user.id, XP_REWARDS.gamblingWin).catch(() => null);
                    const updated = await db.getUser(user.id);

                    const final = buildContainer(user, amount, currentNum, round, payout, 'max', prevNum, true);
                    final.addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(`**Max Win:** ${coin} **+${payout.toLocaleString()}** coins (${winMult}x)\n**Wallet:** ${coin} **${updated.wallet.toLocaleString()}** coins`)
                    );
                    return interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [final] }).catch(() => null);
                }

                const nextMult = MULTIPLIERS[Math.min(round, MULTIPLIERS.length - 1)];
                const updated = buildContainer(user, amount, currentNum, round, Math.floor(amount * nextMult), null, prevNum, true);
                updated.addActionRowComponents(
                    new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId('hl_higher').setLabel('Higher').setStyle(ButtonStyle.Success),
                        new ButtonBuilder().setCustomId('hl_lower').setLabel('Lower').setStyle(ButtonStyle.Danger),
                        new ButtonBuilder().setCustomId('hl_cashout').setLabel('Cash Out').setStyle(ButtonStyle.Secondary)
                    )
                );
                await interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [updated] }).catch(() => null);
            });

            collector.on('end', async (_, reason) => {
                if (reason === 'time') {
                    // Auto cash out on timeout
                    const winMult = MULTIPLIERS[Math.min(round, MULTIPLIERS.length - 1)];
                    const payout = round > 0 ? Math.floor(amount * winMult) : 0;
                    await db.updateWallet(user.id, payout);
                    const updated = await db.getUser(user.id);

                    const final = buildContainer(user, amount, currentNum, round, payout, round > 0 ? 'win' : 'lose');
                    final.addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(
                            `*(Timed out - ${round > 0 ? `auto cash-out at ${winMult}x` : 'no rounds won'})*\n**Wallet:** ${coin} **${updated.wallet.toLocaleString()}** coins`
                        )
                    );
                    await interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [final] }).catch(() => null);
                }
            });

        } catch (err) {
            console.error('[HIGHERLOWER ERROR]', err);
            const msg = { content: 'Game crashed.', ephemeral: true };
            if (interaction.replied || interaction.deferred) await interaction.followUp(msg).catch(() => null);
            else await interaction.editReply(msg).catch(() => null);
        }
    }
};
