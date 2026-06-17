const {
    SlashCommandBuilder,
    ContainerBuilder, SectionBuilder, TextDisplayBuilder, ThumbnailBuilder,
    SeparatorBuilder, SeparatorSpacingSize, MessageFlags
} = require('discord.js');
const db = require('../../utils/db');
const { getEmoji } = require('../../utils/emojis');
const { SHOP_ITEMS, HUNT_LOOT, DIG_LOOT, CHOP_LOOT } = require('../../utils/items');
const { ORES, PICKAXES } = require('../../utils/mining');
const { FISH, RODS } = require('../../utils/fishing');

const coin = getEmoji('coin');
const xp   = getEmoji('xp');

// Build unified item list
const ALL_ITEMS = [];

function register(name) {
    if (!ALL_ITEMS.includes(name)) {
        ALL_ITEMS.push(name);
    }
}

for (const i of SHOP_ITEMS) register(i.name);
for (const name of Object.keys(PICKAXES)) register(name);
for (const name of Object.keys(RODS)) register(name);
for (const i of HUNT_LOOT) register(i.name);
for (const i of DIG_LOOT) register(i.name);
for (const i of CHOP_LOOT) register(i.name);
for (const i of ORES) register(i.name);
for (const i of FISH) register(i.name);

const EXTRA_ITEMS = [
    'Common Worm', 'Old Boot', 'Junk Seaweed',
    'Cloth Scrap', 'Iron Chunk', 'Mysterious Rune', 'Steel Ingot', 'Mana Crystal',
    'Shadow Essence', 'Void Shard', 'Dragon Heart', 'Phoenix Feather', 'Cosmic Dust'
];
for (const name of EXTRA_ITEMS) register(name);

// Check if executor is bot developer
async function isBotAdmin(interaction) {
    const { client, user } = interaction;
    if (process.env.ADMIN_IDS) {
        const admins = process.env.ADMIN_IDS.split(',').map(id => id.trim());
        if (admins.includes(user.id)) return true;
    }
    try {
        const app = await client.application.fetch();
        if (app.owner) {
            if (app.owner.members) {
                return app.owner.members.has(user.id);
            }
            return app.owner.id === user.id;
        }
    } catch (err) {
        console.error('[ADMIN CHECK ERROR]', err);
    }
    return false;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('admin')
        .setDescription('Developer/Administrator utility commands.')
        .addSubcommand(sub =>
            sub.setName('balance-give')
                .setDescription('Give coins to a user.')
                .addUserOption(opt => opt.setName('user').setDescription('The user to give coins to').setRequired(true))
                .addIntegerOption(opt => opt.setName('amount').setDescription('Amount of coins').setRequired(true).setMinValue(1)))
        .addSubcommand(sub =>
            sub.setName('balance-remove')
                .setDescription('Remove coins from a user.')
                .addUserOption(opt => opt.setName('user').setDescription('The user to remove coins from').setRequired(true))
                .addIntegerOption(opt => opt.setName('amount').setDescription('Amount of coins').setRequired(true).setMinValue(1)))
        .addSubcommand(sub =>
            sub.setName('balance-set')
                .setDescription("Set a user's wallet balance directly.")
                .addUserOption(opt => opt.setName('user').setDescription('The user to set balance for').setRequired(true))
                .addIntegerOption(opt => opt.setName('amount').setDescription('Amount of coins').setRequired(true).setMinValue(0)))
        .addSubcommand(sub =>
            sub.setName('item-give')
                .setDescription('Give an item to a user.')
                .addUserOption(opt => opt.setName('user').setDescription('The user to give the item to').setRequired(true))
                .addStringOption(opt => opt.setName('item').setDescription('Item name').setRequired(true).setAutocomplete(true))
                .addIntegerOption(opt => opt.setName('quantity').setDescription('Quantity to give (default: 1)').setRequired(false).setMinValue(1)))
        .addSubcommand(sub =>
            sub.setName('item-remove')
                .setDescription('Remove an item from a user.')
                .addUserOption(opt => opt.setName('user').setDescription('The user to remove the item from').setRequired(true))
                .addStringOption(opt => opt.setName('item').setDescription('Item name').setRequired(true).setAutocomplete(true))
                .addIntegerOption(opt => opt.setName('quantity').setDescription('Quantity to remove (default: 1)').setRequired(false).setMinValue(1)))
        .addSubcommand(sub =>
            sub.setName('xp-add')
                .setDescription('Add XP to a user.')
                .addUserOption(opt => opt.setName('user').setDescription('The user to adjust XP for').setRequired(true))
                .addIntegerOption(opt => opt.setName('amount').setDescription('Amount of XP (can be negative)').setRequired(true)))
        .addSubcommand(sub =>
            sub.setName('cooldown-reset')
                .setDescription("Reset a user's activity cooldowns.")
                .addUserOption(opt => opt.setName('user').setDescription('The user to reset cooldowns for').setRequired(true))
                .addStringOption(opt =>
                    opt.setName('action')
                        .setDescription('The cooldown to reset')
                        .setRequired(true)
                        .addChoices(
                            { name: 'All Cooldowns', value: 'all' },
                            { name: 'Chop', value: 'chop' },
                            { name: 'Dig', value: 'dig' },
                            { name: 'Fish', value: 'fish' },
                            { name: 'Hunt', value: 'hunt' },
                            { name: 'Mine', value: 'mine' },
                            { name: 'Work', value: 'work' },
                            { name: 'Daily Claim', value: 'daily' },
                            { name: 'Weekly Claim', value: 'weekly' },
                            { name: 'Monthly Claim', value: 'monthly' },
                            { name: 'Beg', value: 'beg' },
                            { name: 'Blackjack', value: 'blackjack' },
                            { name: 'Slots', value: 'slots' },
                            { name: 'Coinflip', value: 'coinflip' },
                            { name: 'Cockfight', value: 'cockfight' },
                            { name: 'Rob', value: 'rob' },
                            { name: 'Crash', value: 'crash' },
                            { name: 'Roulette', value: 'roulette' },
                            { name: 'RPS', value: 'rps' },
                            { name: 'Scratchcard', value: 'scratchcard' },
                            { name: 'Search', value: 'search' },
                            { name: 'Mines', value: 'mines' },
                            { name: 'Higher Lower', value: 'higherlower' },
                            { name: 'Horse Race', value: 'horserace' }
                        ))),

    async autocomplete(interaction) {
        const focusedValue = interaction.options.getFocused().toLowerCase();
        const filtered = ALL_ITEMS.filter(item => item.toLowerCase().includes(focusedValue));
        await interaction.respond(
            filtered.slice(0, 25).map(item => ({ name: item, value: item }))
        );
    },

    async execute(interaction) {
        // Authenticate admin check
        if (!(await isBotAdmin(interaction))) {
            return interaction.editReply({
                content: '**Unauthorized:** Only bot administrators can run this command.',
                ephemeral: true
            });
        }

        const sub = interaction.options.getSubcommand();

        try {
            if (sub === 'balance-give') {
                const targetUser = interaction.options.getUser('user');
                const amount = interaction.options.getInteger('amount');

                if (targetUser.bot) return interaction.editReply({ content: 'Bots do not hold coins.', ephemeral: true });

                const profile = await db.updateWallet(targetUser.id, amount);
                const container = new ContainerBuilder()
                    .addSectionComponents(
                        new SectionBuilder()
                            .addTextDisplayComponents(
                                new TextDisplayBuilder().setContent(
                                    `## Coins Given\nAdded ${coin} **${amount.toLocaleString()}** coins to **${targetUser.username}**'s wallet!`
                                )
                            )
                            .setThumbnailAccessory(new ThumbnailBuilder().setURL(targetUser.displayAvatarURL({ forceStatic: true })))
                    )
                    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(
                            `**New Wallet Balance:** ${coin} **${profile.wallet.toLocaleString()}** coins`
                        )
                    );

                return interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [container] });
            }

            if (sub === 'balance-remove') {
                const targetUser = interaction.options.getUser('user');
                const amount = interaction.options.getInteger('amount');

                if (targetUser.bot) return interaction.editReply({ content: 'Bots do not hold coins.', ephemeral: true });

                const profile = await db.updateWallet(targetUser.id, -amount);
                const container = new ContainerBuilder()
                    .addSectionComponents(
                        new SectionBuilder()
                            .addTextDisplayComponents(
                                new TextDisplayBuilder().setContent(
                                    `## Coins Removed\nRemoved ${coin} **${amount.toLocaleString()}** coins from **${targetUser.username}**'s wallet!`
                                )
                            )
                            .setThumbnailAccessory(new ThumbnailBuilder().setURL(targetUser.displayAvatarURL({ forceStatic: true })))
                    )
                    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(
                            `**New Wallet Balance:** ${coin} **${profile.wallet.toLocaleString()}** coins`
                        )
                    );

                return interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [container] });
            }

            if (sub === 'balance-set') {
                const targetUser = interaction.options.getUser('user');
                const amount = interaction.options.getInteger('amount');

                if (targetUser.bot) return interaction.editReply({ content: 'Bots do not hold coins.', ephemeral: true });

                const userProfile = await db.getUser(targetUser.id);
                const diff = amount - userProfile.wallet;
                const profile = await db.updateWallet(targetUser.id, diff);
                const container = new ContainerBuilder()
                    .addSectionComponents(
                        new SectionBuilder()
                            .addTextDisplayComponents(
                                new TextDisplayBuilder().setContent(
                                    `## Balance Set\nSet **${targetUser.username}**'s wallet balance to ${coin} **${amount.toLocaleString()}** coins!`
                                )
                            )
                            .setThumbnailAccessory(new ThumbnailBuilder().setURL(targetUser.displayAvatarURL({ forceStatic: true })))
                    )
                    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(
                            `**Previous Wallet:** ${coin} **${userProfile.wallet.toLocaleString()}** coins\n` +
                            `**Current Wallet:** ${coin} **${profile.wallet.toLocaleString()}** coins`
                        )
                    );

                return interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [container] });
            }

            if (sub === 'item-give') {
                const targetUser = interaction.options.getUser('user');
                const itemNameRaw = interaction.options.getString('item');
                const quantity = interaction.options.getInteger('quantity') || 1;

                if (targetUser.bot) return interaction.editReply({ content: 'Bots do not hold inventory.', ephemeral: true });

                const match = ALL_ITEMS.find(i => i.toLowerCase() === itemNameRaw.toLowerCase());
                if (!match) {
                    return interaction.editReply({
                        content: `**Invalid item:** "${itemNameRaw}" does not exist in the game.`,
                        ephemeral: true
                    });
                }

                await db.addItem(targetUser.id, match, quantity);
                const container = new ContainerBuilder()
                    .addSectionComponents(
                        new SectionBuilder()
                            .addTextDisplayComponents(
                                new TextDisplayBuilder().setContent(
                                    `## Item Given\nAdded **${quantity}x ${match}** to **${targetUser.username}**'s inventory!`
                                )
                            )
                            .setThumbnailAccessory(new ThumbnailBuilder().setURL(targetUser.displayAvatarURL({ forceStatic: true })))
                    );

                return interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [container] });
            }

            if (sub === 'item-remove') {
                const targetUser = interaction.options.getUser('user');
                const itemNameRaw = interaction.options.getString('item');
                const quantity = interaction.options.getInteger('quantity') || 1;

                if (targetUser.bot) return interaction.editReply({ content: 'Bots do not hold inventory.', ephemeral: true });

                const match = ALL_ITEMS.find(i => i.toLowerCase() === itemNameRaw.toLowerCase());
                if (!match) {
                    return interaction.editReply({
                        content: `**Invalid item:** "${itemNameRaw}" does not exist in the game.`,
                        ephemeral: true
                    });
                }

                const inventory = await db.getInventory(targetUser.id);
                const userItem = inventory.find(i => i.item_name.toLowerCase() === match.toLowerCase());

                if (!userItem || userItem.quantity <= 0) {
                    return interaction.editReply({
                        content: `**${targetUser.username}** does not have any **${match}** in their inventory.`,
                        ephemeral: true
                    });
                }

                const removeQty = Math.min(quantity, userItem.quantity);
                await db.removeItem(targetUser.id, match, removeQty);

                const container = new ContainerBuilder()
                    .addSectionComponents(
                        new SectionBuilder()
                            .addTextDisplayComponents(
                                new TextDisplayBuilder().setContent(
                                    `## Item Removed\nRemoved **${removeQty}x ${match}** from **${targetUser.username}**'s inventory!`
                                )
                            )
                            .setThumbnailAccessory(new ThumbnailBuilder().setURL(targetUser.displayAvatarURL({ forceStatic: true })))
                    )
                    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(
                            `**Previous Quantity:** ${userItem.quantity}\n` +
                            `**Remaining Quantity:** ${userItem.quantity - removeQty}`
                        )
                    );

                return interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [container] });
            }

            if (sub === 'xp-add') {
                const targetUser = interaction.options.getUser('user');
                const amount = interaction.options.getInteger('amount');

                if (targetUser.bot) return interaction.editReply({ content: 'Bots do not earn XP.', ephemeral: true });

                const xpResult = await db.addXP(targetUser.id, amount);
                const container = new ContainerBuilder()
                    .addSectionComponents(
                        new SectionBuilder()
                            .addTextDisplayComponents(
                                new TextDisplayBuilder().setContent(
                                    `## ${xp} XP Adjusted\nAdjusted **${targetUser.username}**'s XP by **${amount > 0 ? '+' : ''}${amount.toLocaleString()}** ${xp}!`
                                )
                            )
                            .setThumbnailAccessory(new ThumbnailBuilder().setURL(targetUser.displayAvatarURL({ forceStatic: true })))
                    )
                    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(
                            `${xp} **Current XP:** **${(xpResult.data.xp || 0).toLocaleString()}**\n` +
                            `**Current Level:** **${xpResult.data.level || 1}**` +
                            (xpResult.didLevel ? `\n\n**Level Up!** User reached level **${xpResult.newLevel}**!` : '')
                        )
                    );

                return interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [container] });
            }

            if (sub === 'cooldown-reset') {
                const targetUser = interaction.options.getUser('user');
                const action = interaction.options.getString('action');

                await db.resetCooldown(targetUser.id, action);

                const actionLabel = action === 'all' ? 'all cooldowns' : `the **${action}** cooldown`;
                const container = new ContainerBuilder()
                    .addSectionComponents(
                        new SectionBuilder()
                            .addTextDisplayComponents(
                                new TextDisplayBuilder().setContent(
                                    `## Cooldown Reset\nSuccessfully reset ${actionLabel} for **${targetUser.username}**!`
                                )
                            )
                            .setThumbnailAccessory(new ThumbnailBuilder().setURL(targetUser.displayAvatarURL({ forceStatic: true })))
                    );

                return interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [container] });
            }

        } catch (err) {
            console.error('[ADMIN COMMAND ERROR]', err);
            return interaction.editReply({
                content: `**An error occurred:** ${err.message}`,
                ephemeral: true
            });
        }
    }
};
