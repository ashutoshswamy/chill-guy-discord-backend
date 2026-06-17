const {
    SlashCommandBuilder,
    ContainerBuilder, SectionBuilder, TextDisplayBuilder, ThumbnailBuilder,
    SeparatorBuilder, SeparatorSpacingSize, MessageFlags
} = require('discord.js');
const db = require('../../utils/db');
const { HUNT_LOOT, rollLoot, getRarity } = require('../../utils/items');
const { tryDropLootbox, LOOTBOX_TIERS } = require('../../utils/lootbox');
const { getEmoji } = require('../../utils/emojis');

const coin = getEmoji('coin');

const COOLDOWN_MS  = 60 * 60 * 1000; // 1 hour
const TOOL_NAME    = 'Hunting Rifle';
const FAIL_CHANCE  = 0.12; // 12% chance of empty hunt

const FAIL_MESSAGES = [
    'You stalked through the forest for an hour and found absolutely nothing.',
    'A twig snapped under your boot. Everything fled. Classic.',
    'You found tracks - then lost them. Empty hands.',
    'You waited in a bush for two hours. Not a single animal showed up.',
];

const SUCCESS_PREFIXES = [
    'After careful tracking, you caught a',
    'Patience paid off. You bagged a',
    'Sharp eyes and steady hands - you took down a',
    'Deep in the wilderness, you found and hunted a',
];

function formatMs(ms) {
    const m = Math.floor(ms / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    return `${m}m ${s}s`;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('hunt')
        .setDescription('Go hunting. Requires a Hunting Rifle. 1 hour cooldown.'),

    async execute(interaction) {
        const { user } = interaction;

        try {
            const hasTool = await db.hasItem(user.id, TOOL_NAME);
            if (!hasTool) {
                return interaction.editReply({
                    content: `You need a **${TOOL_NAME}** to hunt! Buy one from \`/shop buy\`.`,
                    ephemeral: true
                });
            }

            const cd = await db.checkAndSetCooldown(user.id, 'hunt', COOLDOWN_MS);
            if (cd.onCooldown) {
                return interaction.editReply({
                    content: `You need to rest! Hunt again in **${formatMs(cd.remaining)}**.`,
                    ephemeral: true
                });
            }

            // 12% empty hunt
            if (Math.random() < FAIL_CHANCE) {
                const msg = FAIL_MESSAGES[Math.floor(Math.random() * FAIL_MESSAGES.length)];
                const container = new ContainerBuilder()
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(`## Hunting Trip\n${msg}\n\n-# Better luck next time. Come back in 1 hour.`)
                    );
                return interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [container] });
            }

            const item   = rollLoot(HUNT_LOOT);
            const rarity = getRarity(item.rarity);
            await db.addItem(user.id, item.name);

            const prefix    = SUCCESS_PREFIXES[Math.floor(Math.random() * SUCCESS_PREFIXES.length)];
            const boxDrop   = tryDropLootbox();
            if (boxDrop) await db.addItem(user.id, boxDrop);

            const container = new ContainerBuilder()
                .addSectionComponents(
                    new SectionBuilder()
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent(
                                `## Hunting Trip\n${prefix} **${item.emoji} ${item.name}**!`
                            )
                        )
                        .setThumbnailAccessory(new ThumbnailBuilder().setURL(user.displayAvatarURL({ forceStatic: true })))
                )
                .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        `${rarity.emoji} **Rarity:** ${rarity.label}\n` +
                        `**Sell Value:** ${coin} ${item.sell.toLocaleString()} coins\n` +
                        `**Item added to inventory.**` +
                        (boxDrop ? `\n\n${LOOTBOX_TIERS[boxDrop].emoji} **Lootbox Drop!** Found a **${boxDrop}**!\n-# Open it with \`/lootbox open\`.` : '') +
                        `\n\n-# Use \`/shop sell\` to sell your items.`
                    )
                );

            return interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [container] });

        } catch (err) {
            console.error('[HUNT ERROR]', err);
            const msg = { content: 'Hunt failed.', ephemeral: true };
            if (interaction.replied || interaction.deferred) await interaction.followUp(msg).catch(() => null);
            else await interaction.editReply(msg).catch(() => null);
        }
    }
};
