const {
    SlashCommandBuilder,
    ContainerBuilder, SectionBuilder, TextDisplayBuilder, ThumbnailBuilder,
    SeparatorBuilder, SeparatorSpacingSize, MessageFlags,
    ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, StringSelectMenuOptionBuilder
} = require('discord.js');
const db = require('../../utils/db');
const { RECIPES } = require('../../utils/crafting');
const { getEmoji } = require('../../utils/emojis');

const coin = getEmoji('coin');

function buildCraftingContainer(selectedIdx, userInventory, walletCoins, craftedItem = null, errorMsg = null) {
    const container = new ContainerBuilder()
        .addSectionComponents(
            new SectionBuilder()
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        `## Crafting Bench\nTurn raw materials and coins into upgraded tools and items.`
                    )
                )
        )
        .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));

    const recipe = RECIPES[selectedIdx];

    // Build select menu of all recipes
    const selectOptions = RECIPES.map((r, i) => {
        return new StringSelectMenuOptionBuilder()
            .setLabel(r.result)
            .setDescription(r.description.slice(0, 100))
            .setValue(i.toString())
            .setDefault(i === selectedIdx);
    });

    const select = new StringSelectMenuBuilder()
        .setCustomId('craft_select_recipe')
        .setPlaceholder('Choose a Recipe')
        .addOptions(selectOptions);

    let recipeText = `### Selected Recipe: **${recipe.result}**\n*${recipe.description}*\n\n**Required Materials:**\n`;
    let canCraft = true;

    for (const mat of recipe.materials) {
        const userQty = userInventory.find(i => i.item_name.toLowerCase() === mat.name.toLowerCase())?.quantity || 0;
        const hasEnough = userQty >= mat.quantity;
        if (!hasEnough) canCraft = false;

        const checkMark = hasEnough ? '[PASS]' : '[FAIL]';
        recipeText += `${checkMark} **${mat.name}**: ${userQty}/${mat.quantity}\n`;
    }

    if (recipe.cost > 0) {
        const hasEnoughCoins = walletCoins >= recipe.cost;
        if (!hasEnoughCoins) canCraft = false;
        const checkMark = hasEnoughCoins ? '[PASS]' : '[FAIL]';
        recipeText += `${checkMark} ${coin} **Cost**: ${walletCoins.toLocaleString()}/${recipe.cost.toLocaleString()} coins\n`;
    }

    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(recipeText));

    if (craftedItem) {
        container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`**Success!** You crafted 1x **${craftedItem}**!`)
        );
    } else if (errorMsg) {
        container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`**Error:** ${errorMsg}`)
        );
    }

    container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));
    container.addActionRowComponents(new ActionRowBuilder().addComponents(select));

    const craftButton = new ButtonBuilder()
        .setCustomId(`craft_confirm_${selectedIdx}`)
        .setLabel(`Craft ${recipe.result}`)
        .setStyle(ButtonStyle.Success)
        .setDisabled(!canCraft);

    container.addActionRowComponents(new ActionRowBuilder().addComponents(craftButton));

    return container;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('craft')
        .setDescription('Open the crafting bench to make items and tools.'),

    async execute(interaction) {
        const { user } = interaction;

        try {
            let userProfile = await db.getUser(user.id);
            let userInventory = await db.getInventory(user.id);
            let selectedIdx = 0;

            const response = await interaction.editReply({
                flags: MessageFlags.IsComponentsV2,
                components: [buildCraftingContainer(selectedIdx, userInventory, userProfile.wallet)]
            });

            const collector = response.createMessageComponentCollector({
                filter: i => i.user.id === user.id,
                time: 120_000,
            });

            collector.on('collect', async i => {
                try {
                    if (i.customId === 'craft_select_recipe') {
                        await i.deferUpdate();
                        selectedIdx = parseInt(i.values[0], 10);
                        userProfile = await db.getUser(user.id);
                        userInventory = await db.getInventory(user.id);
                        await interaction.editReply({
                            flags: MessageFlags.IsComponentsV2,
                            components: [buildCraftingContainer(selectedIdx, userInventory, userProfile.wallet)]
                        }).catch(() => null);
                    } else if (i.customId.startsWith('craft_confirm_')) {
                        await i.deferUpdate();
                        const idx = parseInt(i.customId.split('_')[2], 10);
                        const recipe = RECIPES[idx];

                        // Re-verify requirements
                        userProfile = await db.getUser(user.id);
                        userInventory = await db.getInventory(user.id);

                        let meetsRequirements = true;
                        for (const mat of recipe.materials) {
                            const userQty = userInventory.find(inv => inv.item_name.toLowerCase() === mat.name.toLowerCase())?.quantity || 0;
                            if (userQty < mat.quantity) meetsRequirements = false;
                        }
                        if (userProfile.wallet < recipe.cost) meetsRequirements = false;

                        if (!meetsRequirements) {
                            await interaction.editReply({
                                flags: MessageFlags.IsComponentsV2,
                                components: [buildCraftingContainer(idx, userInventory, userProfile.wallet, null, 'Insufficient materials or coins.')]
                            }).catch(() => null);
                            return;
                        }

                        // Perform transactions
                        for (const mat of recipe.materials) {
                            await db.removeItem(user.id, mat.name, mat.quantity);
                        }
                        if (recipe.cost > 0) {
                            await db.updateWallet(user.id, -recipe.cost);
                        }
                        await db.addItem(user.id, recipe.result, 1);

                        // Reload state
                        userProfile = await db.getUser(user.id);
                        userInventory = await db.getInventory(user.id);

                        await interaction.editReply({
                            flags: MessageFlags.IsComponentsV2,
                            components: [buildCraftingContainer(idx, userInventory, userProfile.wallet, recipe.result)]
                        }).catch(() => null);
                    }
                } catch (err) {
                    console.error('[CRAFT INTERACTION ERROR]', err);
                }
            });

            collector.on('end', async () => {
                try {
                    const final = buildCraftingContainer(selectedIdx, userInventory, userProfile.wallet);
                    for (const row of final.components || []) {
                        if (row.components) {
                            for (const comp of row.components) {
                                if (typeof comp.setDisabled === 'function') comp.setDisabled(true);
                            }
                        }
                    }
                    await interaction.editReply({
                        flags: MessageFlags.IsComponentsV2,
                        components: [final]
                    }).catch(() => null);
                } catch (err) {
                    // Ignore
                }
            });

        } catch (err) {
            console.error('[CRAFTING ERROR]', err);
            const msg = { content: 'Failed to open crafting bench.', ephemeral: true };
            if (interaction.replied || interaction.deferred) await interaction.followUp(msg).catch(() => null);
            else await interaction.editReply(msg).catch(() => null);
        }
    }
};
