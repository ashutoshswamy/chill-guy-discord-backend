const {
    SlashCommandBuilder,
    ContainerBuilder, SectionBuilder, TextDisplayBuilder, ThumbnailBuilder,
    SeparatorBuilder, SeparatorSpacingSize, MessageFlags,
    ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, StringSelectMenuOptionBuilder
} = require('discord.js');
const db = require('../../utils/db');
const { SHOP_ITEMS, getShopItem, getSellPrice } = require('../../utils/items');
const { getEmoji } = require('../../utils/emojis');

const coin = getEmoji('coin');

const CATEGORIES = ['Tools', 'Consumables', 'Lootboxes'];

function splitContent(text, max = 3900) {
    if (text.length <= max) return [text];
    const chunks = [];
    const lines = text.split('\n');
    let current = '';
    for (const line of lines) {
        if ((current + '\n' + line).length > max) {
            if (current) chunks.push(current);
            current = line;
        } else {
            current = current ? current + '\n' + line : line;
        }
    }
    if (current) chunks.push(current);
    return chunks;
}

function buildShopContainer(selectedCategory, page, user) {
    const filtered = selectedCategory === 'All'
        ? SHOP_ITEMS
        : SHOP_ITEMS.filter(i => i.category === selectedCategory);

    const itemsPerPage = 5;
    const totalPages = Math.max(1, Math.ceil(filtered.length / itemsPerPage));
    const currentPage = Math.max(1, Math.min(page, totalPages));

    const pageItems = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    const grouped = {};
    for (const item of pageItems) {
        if (!grouped[item.category]) grouped[item.category] = [];
        grouped[item.category].push(item);
    }

    let bodyText = '';
    for (const [cat, items] of Object.entries(grouped)) {
        bodyText += `### ${cat}\n`;
        for (const item of items) {
            bodyText += `**${item.name}** - ${coin} ${item.price.toLocaleString()} coins\n`;
            bodyText += `-# ${item.description}\n`;
        }
        bodyText += '\n';
    }

    const container = new ContainerBuilder()
        .addSectionComponents(
            new SectionBuilder()
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        `## Shop${selectedCategory !== 'All' ? ` - ${selectedCategory}` : ''}\n` +
                        `Showing ${filtered.length ? (currentPage - 1) * itemsPerPage + 1 : 0}–${Math.min(currentPage * itemsPerPage, filtered.length)} of ${filtered.length} items`
                    )
                )
                .setThumbnailAccessory(new ThumbnailBuilder().setURL(user.displayAvatarURL({ forceStatic: true })))
        )
        .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(bodyText.trim()))
        .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));

    // Category select menu
    const select = new StringSelectMenuBuilder()
        .setCustomId('shop_select_category')
        .setPlaceholder('Filter by Category')
        .addOptions(
            new StringSelectMenuOptionBuilder().setLabel('All Categories').setValue('All').setDefault(selectedCategory === 'All'),
            ...CATEGORIES.map(c => new StringSelectMenuOptionBuilder().setLabel(c).setValue(c).setDefault(selectedCategory === c))
        );

    // Buttons row
    const btnRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('shop_prev')
            .setLabel('Previous')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(currentPage === 1),
        new ButtonBuilder()
            .setCustomId('shop_page_num')
            .setLabel(`Page ${currentPage} / ${totalPages}`)
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(true),
        new ButtonBuilder()
            .setCustomId('shop_next')
            .setLabel('Next')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(currentPage === totalPages)
    );

    container.addActionRowComponents(new ActionRowBuilder().addComponents(select));
    container.addActionRowComponents(btnRow);

    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            `-# Use \`/shop buy <item>\` to purchase · \`/shop sell <item>\` to sell inventory`
        )
    );

    return container;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('shop')
        .setDescription('Browse, buy, and sell items.')
        .addSubcommand(sub =>
            sub.setName('view')
                .setDescription('Browse the shop.')
                .addStringOption(opt =>
                    opt.setName('category')
                        .setDescription('Filter by category')
                        .setRequired(false)
                        .addChoices(...CATEGORIES.map(c => ({ name: c, value: c })))))
        .addSubcommand(sub =>
            sub.setName('buy')
                .setDescription('Buy an item from the shop.')
                .addStringOption(opt =>
                    opt.setName('item')
                        .setDescription('Item to buy')
                        .setRequired(true)
                        .addChoices(...SHOP_ITEMS.map(i => ({ name: `${i.name} - ${i.price.toLocaleString()} coins`, value: i.name })))))
        .addSubcommand(sub =>
            sub.setName('sell')
                .setDescription('Sell an item from your inventory.')
                .addStringOption(opt =>
                    opt.setName('item')
                        .setDescription('Item name to sell')
                        .setRequired(true))
                .addIntegerOption(opt =>
                    opt.setName('amount')
                        .setDescription('Quantity to sell (default: 1)')
                        .setRequired(false)
                        .setMinValue(1))),

    async execute(interaction) {
        const sub  = interaction.options.getSubcommand();
        const { user } = interaction;

        // ─── VIEW ─────────────────────────────────────────────────
        if (sub === 'view') {
            const filter = interaction.options.getString('category') || 'All';
            let currentCategory = filter;
            let currentPage = 1;

            const response = await interaction.editReply({
                flags: MessageFlags.IsComponentsV2,
                components: [buildShopContainer(currentCategory, currentPage, user)]
            });

            const collector = response.createMessageComponentCollector({
                filter: i => i.user.id === user.id,
                time: 120_000,
            });

            collector.on('collect', async i => {
                try {
                    await i.deferUpdate();

                    if (i.customId === 'shop_prev') {
                        currentPage = Math.max(1, currentPage - 1);
                    } else if (i.customId === 'shop_next') {
                        currentPage = currentPage + 1;
                    } else if (i.customId === 'shop_select_category') {
                        currentCategory = i.values[0];
                        currentPage = 1;
                    }

                    const updated = buildShopContainer(currentCategory, currentPage, user);
                    await interaction.editReply({
                        flags: MessageFlags.IsComponentsV2,
                        components: [updated]
                    }).catch(() => null);
                } catch (err) {
                    console.error('[SHOP INTERACTION ERROR]', err);
                }
            });

            collector.on('end', async () => {
                try {
                    const final = buildShopContainer(currentCategory, currentPage, user);
                    for (const c of final.components || []) {
                        if (c.components) {
                            for (const comp of c.components) {
                                if (typeof comp.setDisabled === 'function') comp.setDisabled(true);
                            }
                        }
                        if (typeof c.setDisabled === 'function') c.setDisabled(true);
                    }
                    await interaction.editReply({
                        flags: MessageFlags.IsComponentsV2,
                        components: [final]
                    }).catch(() => null);
                } catch (err) {
                    // Ignore
                }
            });

            return;
        }

        // ─── BUY ──────────────────────────────────────────────────
        if (sub === 'buy') {
            const itemName = interaction.options.getString('item');
            const shopItem = getShopItem(itemName);
            if (!shopItem) return interaction.editReply({ content: 'Item not found in shop.', ephemeral: true });

            const profile = await db.getUser(user.id);
            if (profile.wallet < shopItem.price) {
                return interaction.editReply({
                    content: `Not enough coins! **${shopItem.name}** costs ${coin} **${shopItem.price.toLocaleString()}** coins. You have ${coin} **${profile.wallet.toLocaleString()}**.`,
                    ephemeral: true
                });
            }

            // Block buying duplicate tools
            if (shopItem.tool) {
                const alreadyOwned = await db.hasItem(user.id, shopItem.name);
                if (alreadyOwned) {
                    return interaction.editReply({
                        content: `You already own a **${shopItem.emoji} ${shopItem.name}**. You only need one.`,
                        ephemeral: true
                    });
                }
            }

            await db.updateWallet(user.id, -shopItem.price);
            await db.addItem(user.id, shopItem.name);
            const updated = await db.getUser(user.id);

            const container = new ContainerBuilder()
                .addSectionComponents(
                    new SectionBuilder()
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent(
                                `## Purchase Successful\nYou bought **${shopItem.emoji} ${shopItem.name}**!`
                            )
                        )
                        .setThumbnailAccessory(new ThumbnailBuilder().setURL(user.displayAvatarURL({ forceStatic: true })))
                )
                .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        `**Paid:** ${coin} ${shopItem.price.toLocaleString()} coins\n` +
                        `**Wallet:** ${coin} ${updated.wallet.toLocaleString()} coins\n\n` +
                        `-# ${shopItem.description}`
                    )
                );

            return interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [container] });
        }

        // ─── SELL ─────────────────────────────────────────────────
        if (sub === 'sell') {
            const itemName = interaction.options.getString('item').trim();
            const amount   = interaction.options.getInteger('amount') || 1;
            const sellPrice = getSellPrice(itemName);

            if (sellPrice === 0) {
                return interaction.editReply({
                    content: `**${itemName}** cannot be sold or is not a recognised item.`,
                    ephemeral: true
                });
            }

            const inventory = await db.getInventory(user.id);
            const invItem   = inventory.find(i => i.item_name.toLowerCase() === itemName.toLowerCase());

            if (!invItem || invItem.quantity < 1) {
                return interaction.editReply({
                    content: `You do not have **${itemName}** in your inventory.`,
                    ephemeral: true
                });
            }

            const qty = Math.min(amount, invItem.quantity);
            const total = sellPrice * qty;

            await db.removeItem(user.id, invItem.item_name, qty);
            await db.updateWallet(user.id, total);
            const updated = await db.getUser(user.id);

            const container = new ContainerBuilder()
                .addSectionComponents(
                    new SectionBuilder()
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent(
                                `## Item Sold\nSold **${qty}x ${invItem.item_name}** for ${coin} **${total.toLocaleString()}** coins!`
                            )
                        )
                        .setThumbnailAccessory(new ThumbnailBuilder().setURL(user.displayAvatarURL({ forceStatic: true })))
                )
                .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        `**Price per item:** ${coin} ${sellPrice.toLocaleString()} coins\n` +
                        `**Total received:** ${coin} ${total.toLocaleString()} coins\n` +
                        `**Wallet:** ${coin} ${updated.wallet.toLocaleString()} coins\n` +
                        `**Remaining in inventory:** ${invItem.quantity - qty}`
                    )
                );

            return interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [container] });
        }
    }
};
