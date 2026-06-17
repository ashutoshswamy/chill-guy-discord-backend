const {
    SlashCommandBuilder,
    ContainerBuilder, SectionBuilder, TextDisplayBuilder, ThumbnailBuilder,
    SeparatorBuilder, SeparatorSpacingSize, MessageFlags
} = require('discord.js');
const db = require('../../utils/db');
const { getEmoji } = require('../../utils/emojis');

const coin = getEmoji('coin');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('deposit')
        .setDescription('Move coins from your wallet into your bank.')
        .addStringOption(option =>
            option.setName('amount')
                .setDescription('Amount to deposit, or "all"')
                .setRequired(true)),

    async execute(interaction) {
        const { user } = interaction;
        const input = interaction.options.getString('amount').trim().toLowerCase();

        try {
            const profile = await db.getUser(user.id);

            let amount;
            if (input === 'all') {
                amount = profile.wallet;
            } else {
                amount = parseInt(input);
                if (isNaN(amount) || amount <= 0) {
                    return interaction.editReply({ content: 'Provide a valid positive amount or "all".', ephemeral: true });
                }
            }

            if (amount === 0) {
                return interaction.editReply({ content: 'Your wallet is empty - nothing to deposit.', ephemeral: true });
            }
            if (profile.wallet < amount) {
                return interaction.editReply({
                    content: `Not enough coins in wallet! You have ${coin} **${profile.wallet.toLocaleString()}** coins.`,
                    ephemeral: true
                });
            }

            const result = await db.depositCoins(user.id, amount);

            const container = new ContainerBuilder()
                .addSectionComponents(
                    new SectionBuilder()
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent(
                                `## Bank Deposit\nDeposited ${coin} **${amount.toLocaleString()}** coins into your bank.`
                            )
                        )
                        .setThumbnailAccessory(new ThumbnailBuilder().setURL(user.displayAvatarURL({ forceStatic: true })))
                )
                .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        `**Wallet:** ${coin} **${result.wallet.toLocaleString()}** coins\n` +
                        `**Bank:** ${coin} **${result.bank.toLocaleString()}** coins`
                    )
                );

            await interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [container] });

        } catch (err) {
            console.error('[DEPOSIT ERROR]', err);
            const msg = { content: 'Transaction failed.', ephemeral: true };
            if (interaction.replied || interaction.deferred) await interaction.followUp(msg).catch(() => null);
            else await interaction.editReply(msg).catch(() => null);
        }
    }
};
