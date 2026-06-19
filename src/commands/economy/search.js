const {
    SlashCommandBuilder,
    ContainerBuilder, SectionBuilder, TextDisplayBuilder, ThumbnailBuilder,
    SeparatorBuilder, SeparatorSpacingSize,
    ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags
} = require('discord.js');
const db = require('../../utils/db');
const { XP_REWARDS } = require('../../utils/xp');
const { getEmoji } = require('../../utils/emojis');

const coin = getEmoji('coin');

const LOCATIONS = {
    couch: {
        name: 'Couch',
        failChance: 0.05,
        minCoins: 20,
        maxCoins: 80,
        failMessages: [
            'You searched the couch cushions but only found old dust.',
            'You reached deep into the couch and got pinched by a rusty spring. Ouch!'
        ],
        successMessages: [
            'You dug under the couch cushions and found **{amount}** coins.',
            'You found a lost coin pouch down the side of the cushions containing **{amount}** coins.'
        ]
    },
    pocket: {
        name: 'Pocket',
        failChance: 0.10,
        minCoins: 30,
        maxCoins: 120,
        failMessages: [
            'You checked your pockets but found nothing but a hole.',
            'You reached into your jacket pocket and found an old mint wrapper.'
        ],
        successMessages: [
            'You checked your old winter coat pocket and found **{amount}** coins.',
            'You found **{amount}** coins in your back jeans pocket.'
        ]
    },
    mailbox: {
        name: 'Mailbox',
        failChance: 0.15,
        minCoins: 40,
        maxCoins: 160,
        failMessages: [
            'The mailbox was empty today.',
            'You opened the mailbox but it was just junk mail. Bummer.'
        ],
        successMessages: [
            'You opened the mailbox and found an anonymous card containing **{amount}** coins.',
            'You found a lost coin pouch in the mailbox containing **{amount}** coins.'
        ]
    },
    dresser: {
        name: 'Dresser',
        failChance: 0.12,
        minCoins: 35,
        maxCoins: 140,
        failMessages: [
            'You searched the dresser but only found folded socks.',
            'You pulled too hard on a dresser drawer and it fell on your toe. No coins.'
        ],
        successMessages: [
            'You dug through the top drawer and found **{amount}** coins under a stack of shirts.',
            'You found **{amount}** coins taped to the back of a drawer.'
        ]
    },
    car: {
        name: 'Car',
        failChance: 0.20,
        minCoins: 50,
        maxCoins: 200,
        failMessages: [
            'You searched the car glovebox but only found expired registration papers.',
            'The car alarm went off, forcing you to run away empty-handed.'
        ],
        successMessages: [
            'You cleaned out the cup holders and pocketed **{amount}** coins in loose change.',
            'You searched under the passenger seat and pulled out **{amount}** coins.'
        ]
    },
    sewer: {
        name: 'Sewer',
        failChance: 0.35,
        minCoins: 100,
        maxCoins: 450,
        failMessages: [
            'A giant rat hissed at you from the dark, causing you to drop everything and flee.',
            'You slipped in some questionable sludge and climbed back out empty-handed.'
        ],
        successMessages: [
            'You braved the smell and found a wet envelope containing **{amount}** coins!',
            'You fished out a shiny lost ring and traded it for **{amount}** coins.'
        ]
    },
    grass: {
        name: 'Grass',
        failChance: 0.08,
        minCoins: 15,
        maxCoins: 60,
        failMessages: [
            'You ran your hands through the grass but only found dirt.',
            'A stray dog barked at you, causing you to leave.'
        ],
        successMessages: [
            'You found a shiny coin in the grass worth **{amount}** coins.',
            'You searched near the park path and found **{amount}** coins.'
        ]
    },
    trashcan: {
        name: 'Trash Can',
        failChance: 0.30,
        minCoins: 80,
        maxCoins: 350,
        failMessages: [
            'You knocked over the trash can and got covered in garbage. People stared.',
            'An angry raccoon was inside and chased you down the street.'
        ],
        successMessages: [
            'You dug through the bins and found a discarded wallet with **{amount}** coins.',
            'You found **{amount}** coins inside an old cup.'
        ]
    }
};

const JUNK_ITEMS = ['Old Boot', 'Junk Seaweed', 'Common Worm'];

const COOLDOWN_MS = 60 * 1000;

module.exports = {
    data: new SlashCommandBuilder()
        .setName('search')
        .setDescription('Search funny locations for loose change. Risky places pay more!'),

    async execute(interaction) {
        const { user } = interaction;

        const cd = await db.checkAndSetCooldown(user.id, 'search', COOLDOWN_MS);
        if (cd.onCooldown) {
            const s = Math.ceil(cd.remaining / 1000);
            return interaction.editReply({ content: `On cooldown! Try again in **${s}s**.`, ephemeral: true });
        }

        try {
            // Select 3 random unique locations
            const keys = Object.keys(LOCATIONS);
            const shuffled = keys.sort(() => Math.random() - 0.5);
            const selectedKeys = shuffled.slice(0, 3);
            const choices = selectedKeys.map(k => LOCATIONS[k]);

            const container = new ContainerBuilder()
                .addSectionComponents(
                    new SectionBuilder()
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent(
                                `## Location Search\nWhere would you like to search? Choose a location below.`
                            )
                        )
                        .setThumbnailAccessory(new ThumbnailBuilder().setURL(user.displayAvatarURL({ forceStatic: true })))
                );

            const buttons = selectedKeys.map(key =>
                new ButtonBuilder()
                    .setCustomId(`search_loc_${key}`)
                    .setLabel(LOCATIONS[key].name)
                    .setStyle(ButtonStyle.Primary)
            );

            container.addActionRowComponents(new ActionRowBuilder().addComponents(buttons));

            const response = await interaction.editReply({
                flags: MessageFlags.IsComponentsV2,
                components: [container]
            });

            const collector = response.createMessageComponentCollector({
                filter: i => i.user.id === user.id,
                time: 30_000
            });

            collector.on('collect', async i => {
                await i.deferUpdate();
                collector.stop('clicked');

                const key = i.customId.replace('search_loc_', '');
                const loc = LOCATIONS[key];

                const failed = Math.random() < loc.failChance;
                let resultMsg = '';
                let details = '';

                if (failed) {
                    resultMsg = loc.failMessages[Math.floor(Math.random() * loc.failMessages.length)];
                    details = `**Result:** Found 0 coins.`;
                } else {
                    const payout = Math.floor(Math.random() * (loc.maxCoins - loc.minCoins + 1)) + loc.minCoins;
                    await db.updateWallet(user.id, payout);
                    db.addXP(user.id, XP_REWARDS.beg).catch(() => null);

                    let itemAwarded = null;
                    if (Math.random() < 0.10) {
                        itemAwarded = JUNK_ITEMS[Math.floor(Math.random() * JUNK_ITEMS.length)];
                        await db.addItem(user.id, itemAwarded);
                    }

                    const rawMsg = loc.successMessages[Math.floor(Math.random() * loc.successMessages.length)];
                    resultMsg = rawMsg.replace('{amount}', `${coin} ${payout.toLocaleString()}`);

                    details = `**Coins Pocketed:** ${coin} **+${payout.toLocaleString()}** coins`;
                    if (itemAwarded) details += `\n**Bonus Item:** Found **${itemAwarded}**!`;
                }

                const finalContainer = new ContainerBuilder()
                    .addSectionComponents(
                        new SectionBuilder()
                            .addTextDisplayComponents(
                                new TextDisplayBuilder().setContent(
                                    `## Search: ${loc.name}\n${resultMsg}`
                                )
                            )
                            .setThumbnailAccessory(new ThumbnailBuilder().setURL(user.displayAvatarURL({ forceStatic: true })))
                    )
                    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
                    .addTextDisplayComponents(new TextDisplayBuilder().setContent(details));

                // Re-render buttons but disabled
                const disabledButtons = selectedKeys.map(k => {
                    const isChoice = k === key;
                    return new ButtonBuilder()
                        .setCustomId(`search_loc_dis_${k}`)
                        .setLabel(LOCATIONS[k].name)
                        .setStyle(isChoice ? (failed ? ButtonStyle.Danger : ButtonStyle.Success) : ButtonStyle.Secondary)
                        .setDisabled(true);
                });

                finalContainer.addActionRowComponents(new ActionRowBuilder().addComponents(disabledButtons));

                await interaction.editReply({
                    flags: MessageFlags.IsComponentsV2,
                    components: [finalContainer]
                }).catch(() => null);
            });

            collector.on('end', async (_, reason) => {
                if (reason === 'time') {
                    const finalContainer = new ContainerBuilder()
                        .addSectionComponents(
                            new SectionBuilder()
                                .addTextDisplayComponents(
                                    new TextDisplayBuilder().setContent(`## Location Search\n*(Timed out - no location selected)*`)
                                )
                        );

                    const disabledButtons = selectedKeys.map(k =>
                        new ButtonBuilder()
                            .setCustomId(`search_loc_dis_${k}`)
                            .setLabel(LOCATIONS[k].name)
                            .setStyle(ButtonStyle.Secondary)
                            .setDisabled(true)
                    );

                    finalContainer.addActionRowComponents(new ActionRowBuilder().addComponents(disabledButtons));
                    await interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [finalContainer] }).catch(() => null);
                }
            });

        } catch (err) {
            console.error('[SEARCH ERROR]', err);
            const msg = { content: 'Search failed.', ephemeral: true };
            if (interaction.replied || interaction.deferred) await interaction.followUp(msg).catch(() => null);
            else await interaction.editReply(msg).catch(() => null);
        }
    }
};
