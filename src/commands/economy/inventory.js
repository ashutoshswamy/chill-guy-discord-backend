const {
    SlashCommandBuilder,
    ContainerBuilder, SectionBuilder, TextDisplayBuilder, ThumbnailBuilder,
    SeparatorBuilder, SeparatorSpacingSize, MessageFlags,
    ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, StringSelectMenuOptionBuilder
} = require('discord.js');
const db = require('../../utils/db');
const { HUNT_LOOT, DIG_LOOT, CHOP_LOOT, SHOP_ITEMS, getSellPrice } = require('../../utils/items');
const { ORES, PICKAXES, getOreValueFromInventory } = require('../../utils/mining');
const { FISH, RODS, getFishValueFromInventory } = require('../../utils/fishing');
const { getEmoji } = require('../../utils/emojis');

const coin = getEmoji('coin');

// ── Build unified item metadata map ──────────────────────────────
const ITEM_META = new Map();

function reg(name, emoji, category, sellFn) {
    ITEM_META.set(name.toLowerCase(), { name, emoji, category, sellFn });
}

for (const i of SHOP_ITEMS) {
    reg(i.name, i.emoji, i.tool ? 'Tools' : 'Consumables', () => getSellPrice(i.name));
}
for (const name of Object.keys(PICKAXES)) {
    reg(name, PICKAXES[name].emoji, 'Tools', () => 0);
}
for (const name of Object.keys(RODS)) {
    reg(name, RODS[name].emoji, 'Tools', () => 0);
}
for (const i of HUNT_LOOT) {
    reg(i.name, i.emoji, 'Hunt', () => i.sell);
}
for (const i of DIG_LOOT) {
    reg(i.name, i.emoji, 'Dig', () => i.sell);
}
for (const i of CHOP_LOOT) {
    reg(i.name, i.emoji, 'Chop', () => i.sell);
}
for (const i of ORES) {
    reg(i.name, i.emoji, i.rarity === 'junk' ? 'Junk' : 'Mine', () => getOreValueFromInventory(i.name));
}
for (const i of FISH) {
    reg(i.name, i.emoji, i.rarity === 'junk' ? 'Junk' : 'Fish', () => getFishValueFromInventory(i.name));
}

// ── Category display config ───────────────────────────────────────
const CATEGORY_ORDER = ['Tools', 'Consumables', 'Hunt', 'Dig', 'Chop', 'Mine', 'Fish', 'Junk', 'Other'];
const CATEGORY_ICONS = {
    Tools:       '',
    Consumables: '',
    Hunt:        '',
    Dig:         '',
    Chop:        '',
    Mine:        '',
    Fish:        '',
    Junk:        '',
    Other:       '',
};

function buildInventoryContainer(selectedCategory, page, rawInventory, target, user) {
    const isSelf = target.id === user.id;

    // Group and calculate totals
    const groups = {};
    let totalSellValue = 0;
    let totalItems = 0;

    for (const inv of rawInventory) {
        const meta = ITEM_META.get(inv.item_name.toLowerCase());
        const category = meta ? meta.category : 'Other';
        const emoji    = meta ? meta.emoji : '';
        const sellEach = meta ? meta.sellFn() : getSellPrice(inv.item_name);

        if (!groups[category]) groups[category] = [];
        groups[category].push({ name: inv.item_name, emoji, qty: inv.quantity, sellEach, category });

        totalSellValue += sellEach * inv.quantity;
        totalItems     += inv.quantity;
    }

    // Flatten items based on filter
    let filteredItems = [];
    if (selectedCategory === 'All') {
        for (const cat of CATEGORY_ORDER) {
            if (!groups[cat]) continue;
            const items = groups[cat].sort((a, b) => (b.sellEach * b.qty) - (a.sellEach * a.qty));
            filteredItems.push(...items);
        }
    } else {
        if (groups[selectedCategory]) {
            filteredItems = groups[selectedCategory].sort((a, b) => (b.sellEach * b.qty) - (a.sellEach * a.qty));
        }
    }

    const itemsPerPage = 8;
    const totalPages = Math.max(1, Math.ceil(filteredItems.length / itemsPerPage));
    const currentPage = Math.max(1, Math.min(page, totalPages));

    const pageItems = filteredItems.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    let bodyText = '';
    if (pageItems.length === 0) {
        bodyText = `*No items found in this category.*`;
    } else {
        let lastCat = null;
        for (const item of pageItems) {
            if (item.category !== lastCat) {
                lastCat = item.category;
                const icon = CATEGORY_ICONS[lastCat];
                bodyText += `### ${icon ? icon + ' ' : ''}${lastCat}\n`;
            }
            const sellInfo = item.sellEach > 0
                ? ` · ${coin} ${(item.sellEach * item.qty).toLocaleString()}`
                : '';
            bodyText += `${item.emoji} **${item.name}** ×${item.qty}${sellInfo}\n`;
        }
    }

    const title = selectedCategory === 'All' ? 'Inventory' : `${selectedCategory} Inventory`;
    const container = new ContainerBuilder()
        .addSectionComponents(
            new SectionBuilder()
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        `## ${isSelf ? 'Your' : `${target.displayName}'s`} ${title}\n` +
                        `Showing ${filteredItems.length ? (currentPage - 1) * itemsPerPage + 1 : 0}–${Math.min(currentPage * itemsPerPage, filteredItems.length)} of ${filteredItems.length} items`
                    )
                )
                .setThumbnailAccessory(new ThumbnailBuilder().setURL(target.displayAvatarURL({ forceStatic: true })))
        )
        .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(bodyText.trim()))
        .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));

    // Category select menu
    const selectOptions = [
        new StringSelectMenuOptionBuilder().setLabel('All Categories').setValue('All').setDefault(selectedCategory === 'All')
    ];
    for (const cat of CATEGORY_ORDER) {
        if (groups[cat] && groups[cat].length > 0) {
            selectOptions.push(
                new StringSelectMenuOptionBuilder()
                    .setLabel(`${cat} (${groups[cat].length})`)
                    .setValue(cat)
                    .setDefault(selectedCategory === cat)
            );
        }
    }

    const select = new StringSelectMenuBuilder()
        .setCustomId('inv_select_category')
        .setPlaceholder('Filter by Category')
        .addOptions(selectOptions);

    // Buttons row
    const btnRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('inv_prev')
            .setLabel('Previous')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(currentPage === 1),
        new ButtonBuilder()
            .setCustomId('inv_page_num')
            .setLabel(`Page ${currentPage} / ${totalPages}`)
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(true),
        new ButtonBuilder()
            .setCustomId('inv_next')
            .setLabel('Next')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(currentPage === totalPages)
    );

    container.addActionRowComponents(new ActionRowBuilder().addComponents(select));
    container.addActionRowComponents(btnRow);

    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            `**Total items:** ${totalItems.toLocaleString()}` +
            (totalSellValue > 0 ? `  ·  **Est. sell value:** ${coin} ${totalSellValue.toLocaleString()} coins` : '') +
            `\n-# Use \`/shop sell <item>\` to sell loot.`
        )
    );

    return container;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('inventory')
        .setDescription('View your inventory or another user\'s.')
        .addUserOption(opt =>
            opt.setName('user')
                .setDescription('User to view')
                .setRequired(false)),

    async execute(interaction) {
        const target = interaction.options.getUser('user') || interaction.user;
        const isSelf = target.id === interaction.user.id;
        const { user } = interaction;

        const rawInventory = await db.getInventory(target.id);

        if (!rawInventory.length) {
            const container = new ContainerBuilder()
                .addSectionComponents(
                    new SectionBuilder()
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent(
                                `## ${isSelf ? 'Your' : `${target.displayName}'s`} Inventory\nNothing here yet.`
                            )
                        )
                        .setThumbnailAccessory(new ThumbnailBuilder().setURL(target.displayAvatarURL({ forceStatic: true })))
                )
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        `-# Buy tools from \`/shop buy\` and gather items with \`/hunt\`, \`/dig\`, \`/chop\`, \`/mine\`, \`/fish\`.`
                    )
                );
            return interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [container] });
        }

        let currentCategory = 'All';
        let currentPage = 1;

        const response = await interaction.editReply({
            flags: MessageFlags.IsComponentsV2,
            components: [buildInventoryContainer(currentCategory, currentPage, rawInventory, target, user)]
        });

        const collector = response.createMessageComponentCollector({
            filter: i => i.user.id === user.id,
            time: 120_000,
        });

        collector.on('collect', async i => {
            try {
                await i.deferUpdate();

                if (i.customId === 'inv_prev') {
                    currentPage = Math.max(1, currentPage - 1);
                } else if (i.customId === 'inv_next') {
                    currentPage = currentPage + 1;
                } else if (i.customId === 'inv_select_category') {
                    currentCategory = i.values[0];
                    currentPage = 1;
                }

                const updated = buildInventoryContainer(currentCategory, currentPage, rawInventory, target, user);
                await interaction.editReply({
                    flags: MessageFlags.IsComponentsV2,
                    components: [updated]
                }).catch(() => null);
            } catch (err) {
                console.error('[INVENTORY INTERACTION ERROR]', err);
            }
        });

        collector.on('end', async () => {
            try {
                const final = buildInventoryContainer(currentCategory, currentPage, rawInventory, target, user);
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
    }
};
