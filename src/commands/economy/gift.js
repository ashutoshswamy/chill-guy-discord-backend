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
for (const item of EXTRA_ITEMS) register(item);

module.exports = {
    data: new SlashCommandBuilder()
        .setName('gift')
        .setDescription('Gift items or coins to another user.')
        .addSubcommand(sub =>
            sub.setName('coins')
                .setDescription('Gift coins to another user')
                .addUserOption(opt => opt.setName('user').setDescription('User to gift').setRequired(true))
                .addIntegerOption(opt => opt.setName('amount').setDescription('Amount of coins to gift').setRequired(true).setMinValue(1))
        )
        .addSubcommand(sub =>
            sub.setName('item')
                .setDescription('Gift an item to another user')
                .addUserOption(opt => opt.setName('user').setDescription('User to gift').setRequired(true))
                .addStringOption(opt => opt.setName('item').setDescription('Item to gift').setRequired(true).setAutocomplete(true))
                .addIntegerOption(opt => opt.setName('quantity').setDescription('Quantity to gift').setRequired(false).setMinValue(1))
        ),

    async autocomplete(interaction) {
        const focusedValue = interaction.options.getFocused().toLowerCase();
        // Only autocomplete items that the user actually owns!
        const userInventory = await db.getInventory(interaction.user.id).catch(() => []);
        const ownedItemNames = userInventory.map(i => i.item_name);

        const filtered = ownedItemNames.filter(item => item.toLowerCase().includes(focusedValue));
        await interaction.respond(
            filtered.slice(0, 25).map(item => ({ name: item, value: item }))
        );
    },

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();
        const target = interaction.options.getUser('user');
        const { user } = interaction;

        if (target.id === user.id) {
            return interaction.editReply({ content: 'You cannot gift yourself.', ephemeral: true });
        }
        if (target.bot) {
            return interaction.editReply({ content: 'You cannot gift bots.', ephemeral: true });
        }

        try {
            if (sub === 'coins') {
                const amount = interaction.options.getInteger('amount');
                const sender = await db.getUser(user.id);

                if (sender.wallet < amount) {
                    return interaction.editReply({
                        content: `You do not have enough coins! You only have ${coin} **${sender.wallet.toLocaleString()}** in your wallet.`,
                        ephemeral: true
                    });
                }

                await db.updateWallet(user.id, -amount);
                await db.updateWallet(target.id, amount);

                const container = new ContainerBuilder()
                    .addSectionComponents(
                        new SectionBuilder()
                            .addTextDisplayComponents(
                                new TextDisplayBuilder().setContent(
                                    `## Coins Gifted!\n` +
                                    `You gave ${coin} **${amount.toLocaleString()}** coins to **${target.displayName}**!`
                                )
                            )
                            .setThumbnailAccessory(new ThumbnailBuilder().setURL(target.displayAvatarURL({ forceStatic: true })))
                    );

                return interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [container] });
            }

            if (sub === 'item') {
                const itemNameRaw = interaction.options.getString('item');
                const quantity = interaction.options.getInteger('quantity') || 1;

                // Match item case-insensitively
                const match = ALL_ITEMS.find(i => i.toLowerCase() === itemNameRaw.toLowerCase());
                if (!match) {
                    return interaction.editReply({ content: `**${itemNameRaw}** is not a valid item.`, ephemeral: true });
                }

                const userInventory = await db.getInventory(user.id);
                const invItem = userInventory.find(i => i.item_name.toLowerCase() === match.toLowerCase());

                if (!invItem || invItem.quantity < quantity) {
                    const owned = invItem ? invItem.quantity : 0;
                    return interaction.editReply({
                        content: `You do not have enough **${match}** to gift! You have **${owned}** but tried to gift **${quantity}**.`,
                        ephemeral: true
                    });
                }

                await db.removeItem(user.id, match, quantity);
                await db.addItem(target.id, match, quantity);

                const container = new ContainerBuilder()
                    .addSectionComponents(
                        new SectionBuilder()
                            .addTextDisplayComponents(
                                new TextDisplayBuilder().setContent(
                                    `## Item Gifted!\n` +
                                    `You gifted **${quantity.toLocaleString()}**x **${match}** to **${target.displayName}**!`
                                )
                            )
                            .setThumbnailAccessory(new ThumbnailBuilder().setURL(target.displayAvatarURL({ forceStatic: true })))
                    );

                return interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [container] });
            }
        } catch (err) {
            console.error('[GIFT ERROR]', err);
            const msg = { content: 'Gift transaction failed.', ephemeral: true };
            if (interaction.replied || interaction.deferred) await interaction.followUp(msg).catch(() => null);
            else await interaction.editReply(msg).catch(() => null);
        }
    }
};
