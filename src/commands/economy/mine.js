const {
    SlashCommandBuilder,
    ContainerBuilder, SectionBuilder, TextDisplayBuilder, ThumbnailBuilder,
    SeparatorBuilder, SeparatorSpacingSize,
    MessageFlags,
} = require('discord.js');
const db = require('../../utils/db');
const {
    RARITY_COLORS, RARITY_LABELS, MINE_COOLDOWN_MS, MINE_FLAVOR,
    rollOre, getBestPickaxeFromInventory,
} = require('../../utils/mining');
const { tryDropLootbox, LOOTBOX_TIERS } = require('../../utils/lootbox');

const TOOL_NAME = 'Pickaxe';

function fmtMs(ms) {
    const s = Math.ceil(ms / 1000);
    return s >= 60 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${s}s`;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('mine')
        .setDescription('Grab your pickaxe and head underground! Requires a Pickaxe.'),

    async execute(interaction) {
        const { user } = interaction;

        try {
            const hasTool = await db.hasItem(user.id, TOOL_NAME);
            if (!hasTool) {
                return interaction.editReply({
                    content: `You need a **${TOOL_NAME}** to mine! Buy one from \`/shop buy\`.`,
                    ephemeral: true,
                });
            }

            const cd = await db.checkAndSetCooldown(user.id, 'mine', MINE_COOLDOWN_MS);
            if (cd.onCooldown) {
                return interaction.editReply({
                    content: `The tunnels need to settle. Try again in **${fmtMs(cd.remaining)}**.`,
                    ephemeral: true,
                });
            }

            const inventory  = await db.getInventory(user.id);
            const pickName   = getBestPickaxeFromInventory(inventory);
            const find       = rollOre(pickName);
            const flavorLine = MINE_FLAVOR[Math.floor(Math.random() * MINE_FLAVOR.length)];
            const isJunk     = find.rarity === 'junk';

            if (!isJunk) {
                await db.addItem(user.id, find.name, find.quantity);
            }
            await db.updateQuestProgress(user.id, 'mine').catch(() => null);

            const boxDrop = isJunk ? null : tryDropLootbox();
            if (boxDrop) await db.addItem(user.id, boxDrop);

            const color       = RARITY_COLORS[find.rarity];
            const rarityLabel = RARITY_LABELS[find.rarity];

            const resultText = isJunk
                ? `**${find.name}** - nothing useful here.\n-# Junk tossed aside.`
                : `**${find.name}** ×${find.quantity} found!\n` +
                  `**Rarity:** ${rarityLabel}\n` +
                  `**Item added to inventory.**` +
                  (boxDrop ? `\n\n**Lootbox Drop!** Found a **${boxDrop}**!\n-# Open it with \`/lootbox open\`.` : '') +
                  `\n\n-# Use \`/shop sell\` to sell your ores.`;

            const container = new ContainerBuilder()
                .addSectionComponents(
                    new SectionBuilder()
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent(`## Mining\n${flavorLine}`)
                        )
                        .setThumbnailAccessory(
                            new ThumbnailBuilder().setURL(user.displayAvatarURL({ forceStatic: true }))
                        )
                )
                .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
                .addTextDisplayComponents(new TextDisplayBuilder().setContent(resultText));

            return interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [container] });

        } catch (err) {
            console.error('[MINE ERROR]', err);
            const msg = { content: 'Something went wrong while mining.', ephemeral: true };
            if (interaction.replied || interaction.deferred) await interaction.followUp(msg).catch(() => null);
            else await interaction.editReply(msg).catch(() => null);
        }
    },
};
