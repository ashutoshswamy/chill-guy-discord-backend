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
        .setName('pay')
        .setDescription('Send coins from your wallet to another user.')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user to pay')
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName('amount')
                .setDescription('Amount of coins to send')
                .setRequired(true)
                .setMinValue(1)),

    async execute(interaction) {
        const { user } = interaction;
        const target = interaction.options.getUser('user');
        const amount = interaction.options.getInteger('amount');

        if (target.id === user.id) {
            return interaction.editReply({ content: 'You cannot pay yourself.', ephemeral: true });
        }
        if (target.bot) {
            return interaction.editReply({ content: 'You cannot pay a bot.', ephemeral: true });
        }

        try {
            const sender = await db.getUser(user.id);

            if (sender.wallet < amount) {
                return interaction.editReply({
                    content: `Not enough coins in wallet! You have ${coin} **${sender.wallet.toLocaleString()}** coins.`,
                    ephemeral: true
                });
            }

            await db.updateWallet(user.id, -amount);
            await db.updateWallet(target.id, amount);

            const updated = await db.getUser(user.id);

            const container = new ContainerBuilder()
                .addSectionComponents(
                    new SectionBuilder()
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent(
                                `## Payment Sent\n${coin} **${amount.toLocaleString()}** coins sent to **${target.username}**!`
                            )
                        )
                        .setThumbnailAccessory(new ThumbnailBuilder().setURL(target.displayAvatarURL({ forceStatic: true })))
                )
                .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        `**Your Wallet:** ${coin} **${updated.wallet.toLocaleString()}** coins`
                    )
                );

            await interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [container] });

        } catch (err) {
            console.error('[PAY ERROR]', err);
            const msg = { content: 'Transaction failed.', ephemeral: true };
            if (interaction.replied || interaction.deferred) await interaction.followUp(msg).catch(() => null);
            else await interaction.editReply(msg).catch(() => null);
        }
    }
};
