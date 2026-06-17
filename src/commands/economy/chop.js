const {
    SlashCommandBuilder,
    ContainerBuilder, SectionBuilder, TextDisplayBuilder, ThumbnailBuilder,
    SeparatorBuilder, SeparatorSpacingSize, MessageFlags
} = require('discord.js');
const db = require('../../utils/db');
const { getEmoji } = require('../../utils/emojis');
const { CHOP_LOOT, rollLoot, getRarity } = require('../../utils/items');
const { tryDropLootbox, LOOTBOX_TIERS } = require('../../utils/lootbox');

const coin = getEmoji('coin');

const COOLDOWN_MS = 45 * 60 * 1000; // 45 minutes
const TOOL_NAME   = 'Axe';
const FAIL_CHANCE = 0.08;

const FAIL_MESSAGES = [
    'The tree was too tough. Your axe bounced right off.',
    'You swung too early and missed completely. Embarrassing.',
    'The forest was eerily quiet. You could not find a single good tree.',
    'You chopped for a while but the wood was rotten. Useless.',
];

const SUCCESS_PREFIXES = [
    'After some solid swings, you chopped down a',
    'Your axe bit deep and you extracted a',
    'Clean strokes - you walked away with a',
    'The tree came down smooth. You collected a',
];

function formatMs(ms) {
    const m = Math.floor(ms / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    return `${m}m ${s}s`;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('chop')
        .setDescription('Chop wood in the forest. Requires an Axe. 45 min cooldown.'),

    async execute(interaction) {
        const { user } = interaction;

        try {
            const hasTool = await db.hasItem(user.id, TOOL_NAME);
            if (!hasTool) {
                return interaction.editReply({
                    content: `You need a **${TOOL_NAME}** to chop! Buy one from \`/shop buy\`.`,
                    ephemeral: true
                });
            }

            const cd = await db.checkAndSetCooldown(user.id, 'chop', COOLDOWN_MS);
            if (cd.onCooldown) {
                return interaction.editReply({
                    content: `Your arms need a break! Chop again in **${formatMs(cd.remaining)}**.`,
                    ephemeral: true
                });
            }

            if (Math.random() < FAIL_CHANCE) {
                const msg = FAIL_MESSAGES[Math.floor(Math.random() * FAIL_MESSAGES.length)];
                const container = new ContainerBuilder()
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(`## Chopping Wood\n${msg}\n\n-# Come back in 45 minutes.`)
                    );
                return interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [container] });
            }

            const item   = rollLoot(CHOP_LOOT);
            const rarity = getRarity(item.rarity);
            await db.addItem(user.id, item.name);

            const prefix  = SUCCESS_PREFIXES[Math.floor(Math.random() * SUCCESS_PREFIXES.length)];
            const boxDrop = tryDropLootbox();
            if (boxDrop) await db.addItem(user.id, boxDrop);

            const container = new ContainerBuilder()
                .addSectionComponents(
                    new SectionBuilder()
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent(
                                `## Chopping Wood\n${prefix} **${item.emoji} ${item.name}**!`
                            )
                        )
                        .setThumbnailAccessory(new ThumbnailBuilder().setURL(user.displayAvatarURL({ forceStatic: true })))
                )
                .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        `${rarity.emoji} **Rarity:** ${rarity.label}\n` +
                        `**Sell Value:** ${coin} **${item.sell.toLocaleString()}** coins\n` +
                        `**Item added to inventory.**` +
                        (boxDrop ? `\n\n${LOOTBOX_TIERS[boxDrop].emoji} **Lootbox Drop!** Found a **${boxDrop}**!\n-# Open it with \`/lootbox open\`.` : '') +
                        `\n\n-# Use \`/shop sell\` to sell your items.`
                    )
                );

            return interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [container] });

        } catch (err) {
            console.error('[CHOP ERROR]', err);
            const msg = { content: 'Chopping failed.', ephemeral: true };
            if (interaction.replied || interaction.deferred) await interaction.followUp(msg).catch(() => null);
            else await interaction.editReply(msg).catch(() => null);
        }
    }
};
