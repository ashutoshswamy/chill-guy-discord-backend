const {
    SlashCommandBuilder,
    ContainerBuilder, SectionBuilder, TextDisplayBuilder, ThumbnailBuilder,
    SeparatorBuilder, SeparatorSpacingSize, MessageFlags
} = require('discord.js');
const db = require('../../utils/db');
const { DIG_LOOT, rollLoot, getRarity } = require('../../utils/items');
const { tryDropLootbox, LOOTBOX_TIERS } = require('../../utils/lootbox');
const { getEmoji } = require('../../utils/emojis');

const coin = getEmoji('coin');

const COOLDOWN_MS = 45 * 60 * 1000; // 45 minutes
const TOOL_NAME   = 'Shovel';
const FAIL_CHANCE = 0.10;

const FAIL_MESSAGES = [
    'You dug for an hour and hit nothing but rocks and disappointment.',
    'The ground here has been picked clean. Try again later.',
    'You found a worm hole but the worm was not home.',
    'You dug three feet deep and found only more dirt.',
];

const SUCCESS_PREFIXES = [
    'Digging through the earth, you unearthed a',
    'Careful excavation paid off - you found a',
    'After some serious digging, you pulled out a',
    'Hidden just beneath the surface was a',
];

function formatMs(ms) {
    const m = Math.floor(ms / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    return `${m}m ${s}s`;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('dig')
        .setDescription('Go digging for buried treasure. Requires a Shovel. 45 min cooldown.'),

    async execute(interaction) {
        const { user } = interaction;

        try {
            const hasTool = await db.hasItem(user.id, TOOL_NAME);
            if (!hasTool) {
                return interaction.editReply({
                    content: `You need a **${TOOL_NAME}** to dig! Buy one from \`/shop buy\`.`,
                    ephemeral: true
                });
            }

            const cd = await db.checkAndSetCooldown(user.id, 'dig', COOLDOWN_MS);
            if (cd.onCooldown) {
                return interaction.editReply({
                    content: `Your arms are sore! Dig again in **${formatMs(cd.remaining)}**.`,
                    ephemeral: true
                });
            }

            if (Math.random() < FAIL_CHANCE) {
                const msg = FAIL_MESSAGES[Math.floor(Math.random() * FAIL_MESSAGES.length)];
                const container = new ContainerBuilder()
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(`## Digging\n${msg}\n\n-# Better luck next time. Come back in 45 minutes.`)
                    );
                return interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [container] });
            }

            const item   = rollLoot(DIG_LOOT);
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
                                `## Digging\n${prefix} **${item.emoji} ${item.name}**!`
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
            console.error('[DIG ERROR]', err);
            const msg = { content: 'Digging failed.', ephemeral: true };
            if (interaction.replied || interaction.deferred) await interaction.followUp(msg).catch(() => null);
            else await interaction.editReply(msg).catch(() => null);
        }
    }
};
