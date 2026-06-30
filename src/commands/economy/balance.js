const {
    SlashCommandBuilder,
    ContainerBuilder, SectionBuilder, TextDisplayBuilder, ThumbnailBuilder,
    SeparatorBuilder, SeparatorSpacingSize,
    ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags
} = require('discord.js');
const db = require('../../utils/db');
const { getEmoji } = require('../../utils/emojis');
const { getSellPrice } = require('../../utils/items');

const coin = getEmoji('coin');

async function buildBalanceContainer(targetUser) {
    const profile = await db.getUser(targetUser.id);
    const rawInventory = await db.getInventory(targetUser.id);
    const inventoryValue = rawInventory.reduce((sum, inv) => sum + inv.quantity * getSellPrice(inv.item_name), 0);

    const portfolio = await db.getUserPortfolio(targetUser.id);
    const stocksValue = portfolio.reduce((sum, holding) => {
        const price = holding.stocks ? holding.stocks.current_price : 0;
        return sum + (holding.shares * price);
    }, 0);

    const netWorth = profile.wallet + profile.bank + inventoryValue + stocksValue;

    const container = new ContainerBuilder()
        .addSectionComponents(
            new SectionBuilder()
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        `## Balance: ${targetUser.username}\nGlobal economy wallet & bank`
                    )
                )
                .setThumbnailAccessory(new ThumbnailBuilder().setURL(targetUser.displayAvatarURL({ forceStatic: true })))
        )
        .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `**Wallet:** ${coin} **${profile.wallet.toLocaleString()}** coins\n` +
                `**Bank:** ${coin} **${profile.bank.toLocaleString()}** coins\n` +
                `**Inventory Value:** ${coin} **${inventoryValue.toLocaleString()}** coins\n` +
                `**Stock Portfolio:** ${coin} **${stocksValue.toLocaleString()}** coins\n` +
                `**Net Worth:** ${coin} **${netWorth.toLocaleString()}** coins`
            )
        );

    return { container, profile };
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('balance')
        .setDescription("Check your (or another user's) global wallet balance.")
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user to check balance for (defaults to yourself)')
                .setRequired(false)),

    async execute(interaction) {
        const targetUser = interaction.options.getUser('user') || interaction.user;
        const { user } = interaction;

        if (targetUser.bot) {
            return interaction.editReply({ content: 'Bots do not hold coins.', ephemeral: true });
        }

        try {
            const { container, profile } = await buildBalanceContainer(targetUser);
            const isSelf = targetUser.id === user.id;

            if (isSelf) {
                container.addActionRowComponents(
                    new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setCustomId('bal_deposit_all')
                            .setLabel('Deposit All')
                            .setStyle(ButtonStyle.Success)
                            .setDisabled(profile.wallet <= 0),
                        new ButtonBuilder()
                            .setCustomId('bal_withdraw_all')
                            .setLabel('Withdraw All')
                            .setStyle(ButtonStyle.Primary)
                            .setDisabled(profile.bank <= 0)
                    )
                );
            }

            const response = await interaction.editReply({
                flags: MessageFlags.IsComponentsV2,
                components: [container]
            });

            if (!isSelf) return;

            interaction.followUp({
                content: `${coin} **Want more coins?** Vote for Chill Guy on top.gg with \`/vote\`, then claim **1,500–2,500 coins + 75 XP** every 12 hours using \`/vote-reward\`!`,
                ephemeral: true
            }).catch(() => null);

            const collector = response.createMessageComponentCollector({
                filter: i => i.user.id === user.id,
                time: 60_000
            });

            collector.on('collect', async i => {
                const current = await db.getUser(user.id);

                if (i.customId === 'bal_deposit_all') {
                    if (current.wallet <= 0) return i.reply({ content: 'Wallet is empty!', ephemeral: true });
                    await db.depositCoins(user.id, current.wallet);
                } else if (i.customId === 'bal_withdraw_all') {
                    if (current.bank <= 0) return i.reply({ content: 'Bank is empty!', ephemeral: true });
                    await db.withdrawCoins(user.id, current.bank);
                }

                const updated = await buildBalanceContainer(targetUser);
                updated.container.addActionRowComponents(
                    new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId('bal_deposit_all').setLabel('Deposit All').setStyle(ButtonStyle.Success).setDisabled(updated.profile.wallet <= 0),
                        new ButtonBuilder().setCustomId('bal_withdraw_all').setLabel('Withdraw All').setStyle(ButtonStyle.Primary).setDisabled(updated.profile.bank <= 0)
                    )
                );
                await i.update({ flags: MessageFlags.IsComponentsV2, components: [updated.container] });
            });

            collector.on('end', async () => {
                const final = await buildBalanceContainer(targetUser);
                final.container.addActionRowComponents(
                    new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId('bal_deposit_all').setLabel('Deposit All').setStyle(ButtonStyle.Success).setDisabled(true),
                        new ButtonBuilder().setCustomId('bal_withdraw_all').setLabel('Withdraw All').setStyle(ButtonStyle.Primary).setDisabled(true)
                    )
                );
                await interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [final.container] }).catch(() => null);
            });

        } catch (err) {
            console.error('[BALANCE ERROR]', err);
            const msg = { content: 'Failed to retrieve balance.', ephemeral: true };
            if (interaction.replied || interaction.deferred) await interaction.followUp(msg).catch(() => null);
            else await interaction.editReply(msg).catch(() => null);
        }
    }
};
