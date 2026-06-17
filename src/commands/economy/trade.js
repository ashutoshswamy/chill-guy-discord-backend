const {
    SlashCommandBuilder,
    ContainerBuilder, SectionBuilder, TextDisplayBuilder, ThumbnailBuilder,
    SeparatorBuilder, SeparatorSpacingSize, MessageFlags,
    ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, StringSelectMenuOptionBuilder,
    ModalBuilder, TextInputBuilder, TextInputStyle
} = require('discord.js');
const db = require('../../utils/db');
const { getEmoji } = require('../../utils/emojis');

const coin = getEmoji('coin');

// Trade states in memory: messageId -> tradeObject
const activeTrades = new Map();

function buildTradeContainer(trade, userId) {
    const { playerA, playerB } = trade;

    const renderOffer = (player) => {
        let text = `**${player.tag}**\n`;
        text += `**Coins:** ${coin} ${player.coins.toLocaleString()}\n`;
        text += `**Items:**\n`;
        if (player.items.size === 0) {
            text += `  *None*\n`;
        } else {
            for (const [name, qty] of player.items.entries()) {
                text += `  · **${name}** ×${qty}\n`;
            }
        }
        text += `Accept State: ${player.accepted ? '**Accepted**' : '**Modifying**'}\n`;
        return text;
    };

    const container = new ContainerBuilder()
        .addSectionComponents(
            new SectionBuilder()
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        `## Active Trade Agreement\n` +
                        `Both players must add items/coins and click **Accept** to finalize.`
                    )
                )
        )
        .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(renderOffer(playerA)))
        .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(renderOffer(playerB)))
        .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));

    // Determine if current viewer is in trade
    const activePlayer = playerA.id === userId ? playerA : (playerB.id === userId ? playerB : null);

    if (trade.status === 'completed') {
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`**Trade completed successfully!**`)
        );
        return container;
    } else if (trade.status === 'cancelled') {
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`**Trade was cancelled.**`)
        );
        return container;
    }

    if (activePlayer) {
        // Build Select Menu for adding items from the active player's inventory
        const selectOptions = [];
        for (const item of activePlayer.inventory) {
            // Check if player has more in inventory than already offered
            const offeredQty = activePlayer.items.get(item.item_name) || 0;
            const remaining = item.quantity - offeredQty;
            if (remaining > 0) {
                selectOptions.push(
                    new StringSelectMenuOptionBuilder()
                        .setLabel(`${item.item_name} (Own: ${remaining})`)
                        .setValue(item.item_name)
                );
            }
        }

        if (selectOptions.length > 0) {
            const select = new StringSelectMenuBuilder()
                .setCustomId('trade_add_item')
                .setPlaceholder('Add Item to Trade')
                .addOptions(selectOptions.slice(0, 25)); // limit 25 options

            container.addActionRowComponents(new ActionRowBuilder().addComponents(select));
        } else {
            container.addTextDisplayComponents(
                new TextDisplayBuilder().setContent(`-# *No tradeable items in your inventory.*`)
            );
        }

        const btnRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('trade_add_coins')
                .setLabel('Add Coins')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('trade_accept')
                .setLabel(activePlayer.accepted ? 'Unaccept' : 'Accept Trade')
                .setStyle(activePlayer.accepted ? ButtonStyle.Secondary : ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId('trade_cancel')
                .setLabel('Cancel')
                .setStyle(ButtonStyle.Danger)
        );

        container.addActionRowComponents(btnRow);
    } else {
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`-# *Viewing trade panel as spectator.*`)
        );
    }

    return container;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('trade')
        .setDescription('Trade coins and items with another user.')
        .addUserOption(opt =>
            opt.setName('user')
                .setDescription('User to trade with')
                .setRequired(true)),

    async execute(interaction) {
        const { user } = interaction;
        const target = interaction.options.getUser('user');

        if (target.id === user.id) {
            return interaction.editReply({ content: 'You cannot trade with yourself.', ephemeral: true });
        }
        if (target.bot) {
            return interaction.editReply({ content: 'You cannot trade with a bot.', ephemeral: true });
        }

        // Send trade invite
        const inviteContainer = new ContainerBuilder()
            .addSectionComponents(
                new SectionBuilder()
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(
                            `## Trade Proposal\n` +
                            `**${user.displayName}** has invited **${target.displayName}** to trade!`
                        )
                    )
            )
            .addActionRowComponents(
                new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId('trade_invite_accept')
                        .setLabel('Accept Trade')
                        .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()
                        .setCustomId('trade_invite_decline')
                        .setLabel('Decline')
                        .setStyle(ButtonStyle.Danger)
                )
            );

        const response = await interaction.editReply({
            flags: MessageFlags.IsComponentsV2,
            components: [inviteContainer]
        });

        const inviteCollector = response.createMessageComponentCollector({
            filter: i => i.user.id === target.id || i.user.id === user.id,
            time: 60_000,
            max: 1
        });

        inviteCollector.on('collect', async i => {
            if (i.customId === 'trade_invite_decline') {
                await i.deferUpdate();
                inviteCollector.stop('declined');
                await interaction.editReply({
                    content: `**${target.displayName}** declined the trade invite.`,
                    components: []
                }).catch(() => null);
                return;
            }

            if (i.customId === 'trade_invite_accept') {
                if (i.user.id !== target.id) {
                    return i.reply({ content: 'Only the invited player can accept the trade!', ephemeral: true });
                }

                await i.deferUpdate();

                // Fetch starting inventory & profiles
                const [invA, invB, profileA, profileB] = await Promise.all([
                    db.getInventory(user.id),
                    db.getInventory(target.id),
                    db.getUser(user.id),
                    db.getUser(target.id)
                ]);

                const trade = {
                    status: 'active',
                    playerA: {
                        id: user.id,
                        tag: user.username,
                        coins: 0,
                        items: new Map(), // name -> qty
                        accepted: false,
                        inventory: invA,
                        walletCoins: profileA.wallet
                    },
                    playerB: {
                        id: target.id,
                        tag: target.username,
                        coins: 0,
                        items: new Map(), // name -> qty
                        accepted: false,
                        inventory: invB,
                        walletCoins: profileB.wallet
                    }
                };

                activeTrades.set(response.id, trade);

                await interaction.editReply({
                    flags: MessageFlags.IsComponentsV2,
                    components: [buildTradeContainer(trade, user.id)]
                }).catch(() => null);

                // Start active trade collector
                const tradeCollector = response.createMessageComponentCollector({
                    time: 300_000 // 5 minutes
                });

                tradeCollector.on('collect', async ti => {
                    const currentTrade = activeTrades.get(response.id);
                    if (!currentTrade || currentTrade.status !== 'active') return;

                    const isA = ti.user.id === currentTrade.playerA.id;
                    const isB = ti.user.id === currentTrade.playerB.id;

                    if (!isA && !isB) {
                        return ti.reply({ content: 'You are not part of this trade!', ephemeral: true });
                    }

                    const activeP = isA ? currentTrade.playerA : currentTrade.playerB;
                    const otherP = isA ? currentTrade.playerB : currentTrade.playerA;

                    if (ti.customId === 'trade_cancel') {
                        await ti.deferUpdate();
                        currentTrade.status = 'cancelled';
                        activeTrades.delete(response.id);
                        tradeCollector.stop('cancelled');
                        await interaction.editReply({
                            flags: MessageFlags.IsComponentsV2,
                            components: [buildTradeContainer(currentTrade, ti.user.id)]
                        }).catch(() => null);
                        return;
                    }

                    if (ti.customId === 'trade_accept') {
                        await ti.deferUpdate();
                        activeP.accepted = !activeP.accepted;

                        // If both accepted, perform the database trade!
                        if (currentTrade.playerA.accepted && currentTrade.playerB.accepted) {
                            currentTrade.status = 'completed';
                            activeTrades.delete(response.id);
                            tradeCollector.stop('completed');

                            // Execute Trade!
                            try {
                                // Double check wallets
                                const [profA, profB] = await Promise.all([
                                    db.getUser(currentTrade.playerA.id),
                                    db.getUser(currentTrade.playerB.id)
                                ]);

                                if (profA.wallet < currentTrade.playerA.coins || profB.wallet < currentTrade.playerB.coins) {
                                    currentTrade.status = 'cancelled';
                                    await interaction.editReply({
                                        content: 'Trade failed: One or both players no longer have enough coins.',
                                        components: []
                                    }).catch(() => null);
                                    return;
                                }

                                // Transfer Coins
                                if (currentTrade.playerA.coins > 0) {
                                    await db.updateWallet(currentTrade.playerA.id, -currentTrade.playerA.coins);
                                    await db.updateWallet(currentTrade.playerB.id, currentTrade.playerA.coins);
                                }
                                if (currentTrade.playerB.coins > 0) {
                                    await db.updateWallet(currentTrade.playerB.id, -currentTrade.playerB.coins);
                                    await db.updateWallet(currentTrade.playerA.id, currentTrade.playerB.coins);
                                }

                                // Transfer Items A -> B
                                for (const [itemName, qty] of currentTrade.playerA.items.entries()) {
                                    await db.removeItem(currentTrade.playerA.id, itemName, qty);
                                    await db.addItem(currentTrade.playerB.id, itemName, qty);
                                }
                                // Transfer Items B -> A
                                for (const [itemName, qty] of currentTrade.playerB.items.entries()) {
                                    await db.removeItem(currentTrade.playerB.id, itemName, qty);
                                    await db.addItem(currentTrade.playerA.id, itemName, qty);
                                }

                                await interaction.editReply({
                                    flags: MessageFlags.IsComponentsV2,
                                    components: [buildTradeContainer(currentTrade, ti.user.id)]
                                }).catch(() => null);

                            } catch (err) {
                                console.error('[TRADE EXECUTION ERROR]', err);
                                currentTrade.status = 'cancelled';
                                await interaction.editReply({
                                    content: 'An error occurred while executing the trade. Trade cancelled.',
                                    components: []
                                }).catch(() => null);
                            }
                            return;
                        }

                        await interaction.editReply({
                            flags: MessageFlags.IsComponentsV2,
                            components: [buildTradeContainer(currentTrade, ti.user.id)]
                        }).catch(() => null);
                        return;
                    }

                    if (ti.customId === 'trade_add_coins') {
                        // Prompt Modal for coin input
                        const modal = new ModalBuilder()
                            .setCustomId('trade_coins_modal')
                            .setTitle('Add Coins to Trade');

                        const input = new TextInputBuilder()
                            .setCustomId('trade_coins_input')
                            .setLabel(`Amount to offer (Max: ${activeP.walletCoins})`)
                            .setStyle(TextInputStyle.Short)
                            .setRequired(true);

                        modal.addComponents(new ActionRowBuilder().addComponents(input));
                        await ti.showModal(modal);

                        try {
                            const modalSubmit = await ti.awaitModalSubmit({ time: 30_000, filter: m => m.user.id === ti.user.id });
                            await modalSubmit.deferUpdate();

                            const coinsVal = parseInt(modalSubmit.fields.getTextInputValue('trade_coins_input'), 10);
                            if (isNaN(coinsVal) || coinsVal < 0 || coinsVal > activeP.walletCoins) {
                                await modalSubmit.followUp({ content: 'Invalid coin amount.', ephemeral: true }).catch(() => null);
                                return;
                            }

                            activeP.coins = coinsVal;
                            // Reset accept status on update
                            activeP.accepted = false;
                            otherP.accepted = false;

                            await interaction.editReply({
                                flags: MessageFlags.IsComponentsV2,
                                components: [buildTradeContainer(currentTrade, ti.user.id)]
                            }).catch(() => null);

                        } catch (err) {
                            // Modal timeout
                        }
                        return;
                    }

                    if (ti.customId === 'trade_add_item') {
                        const selectedItemName = ti.values[0];

                        // Prompt quantity modal
                        const modal = new ModalBuilder()
                            .setCustomId('trade_item_modal')
                            .setTitle(`Quantity of ${selectedItemName}`);

                        const userInvItem = activeP.inventory.find(i => i.item_name === selectedItemName);
                        const remaining = userInvItem ? userInvItem.quantity - (activeP.items.get(selectedItemName) || 0) : 0;

                        const input = new TextInputBuilder()
                            .setCustomId('trade_item_input')
                            .setLabel(`Quantity (Max: ${remaining})`)
                            .setStyle(TextInputStyle.Short)
                            .setRequired(true);

                        modal.addComponents(new ActionRowBuilder().addComponents(input));
                        await ti.showModal(modal);

                        try {
                            const modalSubmit = await ti.awaitModalSubmit({ time: 30_000, filter: m => m.user.id === ti.user.id });
                            await modalSubmit.deferUpdate();

                            const qtyVal = parseInt(modalSubmit.fields.getTextInputValue('trade_item_input'), 10);
                            if (isNaN(qtyVal) || qtyVal <= 0 || qtyVal > remaining) {
                                await modalSubmit.followUp({ content: 'Invalid quantity.', ephemeral: true }).catch(() => null);
                                return;
                            }

                            const currentQty = activeP.items.get(selectedItemName) || 0;
                            activeP.items.set(selectedItemName, currentQty + qtyVal);

                            // Reset accept status on update
                            activeP.accepted = false;
                            otherP.accepted = false;

                            await interaction.editReply({
                                flags: MessageFlags.IsComponentsV2,
                                components: [buildTradeContainer(currentTrade, ti.user.id)]
                            }).catch(() => null);

                        } catch (err) {
                            // Modal timeout
                        }
                        return;
                    }
                });
            }
        });

        inviteCollector.on('end', async (collected, reason) => {
            if (reason === 'time' && collected.size === 0) {
                await interaction.editReply({
                    content: 'Trade invitation timed out.',
                    components: []
                }).catch(() => null);
            }
        });
    }
};
