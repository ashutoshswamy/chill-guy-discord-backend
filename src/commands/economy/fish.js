const {
    SlashCommandBuilder,
    ContainerBuilder, SectionBuilder, TextDisplayBuilder, ThumbnailBuilder,
    SeparatorBuilder, SeparatorSpacingSize,
    MessageFlags,
} = require('discord.js');
const db = require('../../utils/db');
const {
    RARITY_COLORS, RARITY_LABELS, FISH_COOLDOWN_MS, FISH_CAST_LINES,
    rollFish, getBestRodFromInventory,
} = require('../../utils/fishing');
const { tryDropLootbox, LOOTBOX_TIERS } = require('../../utils/lootbox');
const { getEmoji } = require('../../utils/emojis');

const coin = getEmoji('coin');

const TOOL_NAME = 'Fishing Pole';

function fmtMs(ms) {
    const s = Math.ceil(ms / 1000);
    return s >= 60 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${s}s`;
}

function weightLabel(kg) {
    return kg >= 1 ? `${kg.toFixed(2)} kg` : `${(kg * 1000).toFixed(0)} g`;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('fish')
        .setDescription('Cast your line and reel in a catch! Requires a Fishing Pole.'),

    async execute(interaction) {
        const { user } = interaction;

        try {
            const hasTool = await db.hasItem(user.id, TOOL_NAME);
            if (!hasTool) {
                return interaction.editReply({
                    content: `You need a **${TOOL_NAME}** to fish! Buy one from \`/shop buy\`.`,
                    ephemeral: true,
                });
            }

            const cd = await db.checkAndSetCooldown(user.id, 'fish', FISH_COOLDOWN_MS);
            if (cd.onCooldown) {
                return interaction.editReply({
                    content: `Let the fish settle. Try again in **${fmtMs(cd.remaining)}**.`,
                    ephemeral: true,
                });
            }

            const inventory = await db.getInventory(user.id);
            const rodName   = getBestRodFromInventory(inventory);
            const catch_    = rollFish(rodName);
            const castLine  = FISH_CAST_LINES[Math.floor(Math.random() * FISH_CAST_LINES.length)];
            const isJunk    = catch_.rarity === 'junk';

            if (!isJunk) {
                await db.addItem(user.id, catch_.name, 1);
            }
            await db.updateQuestProgress(user.id, 'fish').catch(() => null);

            const boxDrop = isJunk ? null : tryDropLootbox();
            if (boxDrop) await db.addItem(user.id, boxDrop);

            const color       = RARITY_COLORS[catch_.rarity];
            const rarityLabel = RARITY_LABELS[catch_.rarity];

            const resultText = isJunk
                ? `**${catch_.name}** - yikes.\n-# Junk goes back in the water.`
                : `**${catch_.name}** caught!\n` +
                  `**Rarity:** ${rarityLabel}\n` +
                  `**Weight:** ${weightLabel(catch_.weight)}\n` +
                  `**Item added to inventory.**` +
                  (boxDrop ? `\n\n**Lootbox Drop!** Found a **${boxDrop}**!\n-# Open it with \`/lootbox open\`.` : '') +
                  `\n\n-# Use \`/shop sell\` to sell your fish.`;

            const container = new ContainerBuilder()
                .addSectionComponents(
                    new SectionBuilder()
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent(`## Fishing\n${castLine}`)
                        )
                        .setThumbnailAccessory(
                            new ThumbnailBuilder().setURL(user.displayAvatarURL({ forceStatic: true }))
                        )
                )
                .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
                .addTextDisplayComponents(new TextDisplayBuilder().setContent(resultText));

            return interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [container] });

        } catch (err) {
            console.error('[FISH ERROR]', err);
            const msg = { content: 'Something went wrong while fishing.', ephemeral: true };
            if (interaction.replied || interaction.deferred) await interaction.followUp(msg).catch(() => null);
            else await interaction.editReply(msg).catch(() => null);
        }
    },
};
