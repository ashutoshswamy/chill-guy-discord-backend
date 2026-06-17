const {
    SlashCommandBuilder,
    ContainerBuilder, SectionBuilder, TextDisplayBuilder, ThumbnailBuilder,
    SeparatorBuilder, SeparatorSpacingSize, MessageFlags,
} = require('discord.js');
const db = require('../../utils/db');
const { LOOTBOX_TIERS, LOOTBOX_ITEMS, openLootbox } = require('../../utils/lootbox');
const { getEmoji } = require('../../utils/emojis');

const coin = getEmoji('coin');

const CONSUMABLE_EMOJIS = {
    'XP Potion':   '',
    'Work Gloves': '',
    'Coin Bomb':   '',
};

const RARITY_LABELS = {
    common:    'Common',
    uncommon:  'Uncommon',
    rare:      'Rare',
    epic:      'Epic',
    legendary: 'Legendary',
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('lootbox')
        .setDescription('Manage and open your lootboxes.')
        .addSubcommand(sub =>
            sub.setName('open')
                .setDescription('Open a lootbox from your inventory.')
                .addStringOption(opt =>
                    opt.setName('tier')
                        .setDescription('Which lootbox to open')
                        .setRequired(true)
                        .addChoices(
                            ...Object.keys(LOOTBOX_TIERS).map(name => ({
                                name: `${LOOTBOX_TIERS[name].emoji} ${name}`,
                                value: name,
                            }))
                        )
                )
        )
        .addSubcommand(sub =>
            sub.setName('tiers')
                .setDescription('View all lootbox tiers, drop rates, and potential rewards.')
        ),

    async execute(interaction) {
        const { user } = interaction;
        const sub = interaction.options.getSubcommand();

        try {
            if (sub === 'open') {
                const tierName = interaction.options.getString('tier');
                const tierDef  = LOOTBOX_TIERS[tierName];

                const hasBox = await db.hasItem(user.id, tierName);
                if (!hasBox) {
                    return interaction.editReply({
                        content: `You don't have a **${tierDef.emoji} ${tierName}** in your inventory!\nGet one from grinding commands or buy from \`/shop buy\`.`,
                        ephemeral: true,
                    });
                }

                await db.removeItem(user.id, tierName);

                const { results } = openLootbox(tierName);

                let totalCoins = 0;
                let totalXP    = 0;
                const rewardLines = [];

                for (const r of results) {
                    if (r.type === 'coins') {
                        totalCoins += r.amount;
                        rewardLines.push(`${coin} **+${r.amount.toLocaleString()} coins**`);
                    } else if (r.type === 'xp') {
                        totalXP += r.amount;
                        rewardLines.push(`**+${r.amount} XP**`);
                    } else if (r.type === 'item') {
                        await db.addItem(user.id, r.name);
                        const rarityLabel = RARITY_LABELS[r.rarity] ?? r.rarity;
                        rewardLines.push(`**${r.name}** *(${rarityLabel})*`);
                    } else if (r.type === 'consumable') {
                        await db.addItem(user.id, r.name);
                        rewardLines.push(`**${r.name}** *(Consumable)*`);
                    }
                }

                if (totalCoins > 0) await db.updateWallet(user.id, totalCoins);
                if (totalXP > 0)    await db.addXP(user.id, totalXP);

                const updatedUser = await db.getUser(user.id);

                const container = new ContainerBuilder()
                    .addSectionComponents(
                        new SectionBuilder()
                            .addTextDisplayComponents(
                                new TextDisplayBuilder().setContent(
                                    `## Opening ${tierName}...`
                                )
                            )
                            .setThumbnailAccessory(
                                new ThumbnailBuilder().setURL(user.displayAvatarURL({ forceStatic: true }))
                            )
                    )
                    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(
                            `**You received:**\n${rewardLines.join('\n')}`
                        )
                    )
                    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(
                            `-# Wallet: ${coin} ${updatedUser.wallet.toLocaleString()} coins`
                        )
                    );

                return interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [container] });
            }

            if (sub === 'tiers') {
                const tierLines = Object.entries(LOOTBOX_TIERS).map(([name, def]) => {
                    const dropPct = ((def.dropWeight / 100) * 20).toFixed(2);
                    return (
                        `**${name}** - sell for ${coin} ${def.sell.toLocaleString()}\n` +
                        `-# Drop chance per grind: ~${dropPct}% | Open with \`/lootbox open\``
                    );
                }).join('\n\n');

                const itemLines = LOOTBOX_ITEMS.map(it =>
                    `**${it.name}** - ${RARITY_LABELS[it.rarity]} - ${coin} ${it.sell.toLocaleString()}`
                ).join('\n');

                const container = new ContainerBuilder()
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(
                            `## Lootbox Tiers\n\nLootboxes drop randomly from grinding commands (\`/hunt\`, \`/dig\`, \`/chop\`, \`/fish\`, \`/mine\`).\n\n${tierLines}`
                        )
                    )
                    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(
                            `### Exclusive Lootbox Items\n${itemLines}\n\n-# Items added to inventory. Sell with \`/shop sell\`.`
                        )
                    );

                return interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [container] });
            }

        } catch (err) {
            console.error('[LOOTBOX ERROR]', err);
            const msg = { content: 'Something went wrong with the lootbox.', ephemeral: true };
            if (interaction.replied || interaction.deferred) await interaction.followUp(msg).catch(() => null);
            else await interaction.editReply(msg).catch(() => null);
        }
    },
};
