const {
    SlashCommandBuilder,
    ContainerBuilder, SectionBuilder, TextDisplayBuilder, ThumbnailBuilder,
    SeparatorBuilder, SeparatorSpacingSize, MessageFlags,
    ActionRowBuilder, ButtonBuilder, ButtonStyle
} = require('discord.js');
const db = require('../../utils/db');
const { getLevelFromXP } = require('../../utils/xp');
const { getSellPrice } = require('../../utils/items');
const { getEmoji } = require('../../utils/emojis');

const coin = getEmoji('coin');

// Define achievements list
const ACHIEVEMENTS_LIST = [
    {
        id: 'lvl_5',
        title: 'Sprout Grinder',
        desc: 'Reach Level 5',
        check: (data) => data.level >= 5,
        progress: (data) => `${data.level}/5`,
        pct: (data) => Math.min(1, data.level / 5),
        reward: `1,000 coins`
    },
    {
        id: 'lvl_20',
        title: 'Golden Grinder',
        desc: 'Reach Level 20',
        check: (data) => data.level >= 20,
        progress: (data) => `${data.level}/20`,
        pct: (data) => Math.min(1, data.level / 20),
        reward: `5,000 coins`
    },
    {
        id: 'lvl_50',
        title: 'Emerald Legend',
        desc: 'Reach Level 50',
        check: (data) => data.level >= 50,
        progress: (data) => `${data.level}/50`,
        pct: (data) => Math.min(1, data.level / 50),
        reward: `25,000 coins`
    },
    {
        id: 'wealth_10k',
        title: 'Hustler',
        desc: 'Reach a Net Worth of 10,000 coins',
        check: (data) => data.netWorth >= 10000,
        progress: (data) => `${data.netWorth.toLocaleString()}/10,000`,
        pct: (data) => Math.min(1, data.netWorth / 10000),
        reward: `500 coins`
    },
    {
        id: 'wealth_100k',
        title: 'Collector',
        desc: 'Reach a Net Worth of 100,000 coins',
        check: (data) => data.netWorth >= 100000,
        progress: (data) => `${data.netWorth.toLocaleString()}/100,000`,
        pct: (data) => Math.min(1, data.netWorth / 100000),
        reward: `5,000 coins`
    },
    {
        id: 'wealth_1m',
        title: 'Millionaire',
        desc: 'Reach a Net Worth of 1,000,000 coins',
        check: (data) => data.netWorth >= 1000000,
        progress: (data) => `${data.netWorth.toLocaleString()}/1,000,000`,
        pct: (data) => Math.min(1, data.netWorth / 1000000),
        reward: `50,000 coins`
    },
    {
        id: 'fish_50',
        title: 'Master Angler',
        desc: 'Catch 50 fish total',
        check: (data) => data.fishCaught >= 50,
        progress: (data) => `${data.fishCaught}/50`,
        pct: (data) => Math.min(1, data.fishCaught / 50),
        reward: `2,500 coins`
    },
    {
        id: 'mine_50',
        title: 'Gold Digger',
        desc: 'Mine 50 ores total',
        check: (data) => data.oresMined >= 50,
        progress: (data) => `${data.oresMined}/50`,
        pct: (data) => Math.min(1, data.oresMined / 50),
        reward: `2,500 coins`
    },
    {
        id: 'work_50',
        title: 'Employee of the Month',
        desc: 'Complete 50 work shifts',
        check: (data) => data.shiftsWorked >= 50,
        progress: (data) => `${data.shiftsWorked}/50`,
        pct: (data) => Math.min(1, data.shiftsWorked / 50),
        reward: `3,000 coins`
    },
    {
        id: 'pet_5',
        title: 'Animal Trainer',
        desc: 'Get a pet to Level 5 or higher',
        check: (data) => data.maxPetLvl >= 5,
        progress: (data) => `${data.maxPetLvl}/5`,
        pct: (data) => Math.min(1, data.maxPetLvl / 5),
        reward: `2,000 coins`
    }
];

function buildProgressBar(pct, length = 10) {
    const fill = Math.round(pct * length);
    const empty = length - fill;
    return `\`${'█'.repeat(fill)}${'░'.repeat(empty)}\` ${Math.round(pct * 100)}%`;
}

function buildAchievementsContainer(data, target, user, page) {
    const isSelf = target.id === user.id;

    // Filter achievements or paginate them
    const itemsPerPage = 3;
    const totalPages = Math.ceil(ACHIEVEMENTS_LIST.length / itemsPerPage);
    const currentPage = Math.max(1, Math.min(page, totalPages));

    const pageItems = ACHIEVEMENTS_LIST.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    let bodyText = '';
    let completedCount = 0;

    for (const ach of ACHIEVEMENTS_LIST) {
        if (ach.check(data)) completedCount++;
    }

    for (const ach of pageItems) {
        const completed = ach.check(data);
        const status = completed ? '**Unlocked**' : '**Locked**';
        const progressLine = ach.progress(data);
        const pct = ach.pct(data);
        const bar = buildProgressBar(pct);

        bodyText += `### ${ach.title}\n` +
                    `*${ach.desc}*\n` +
                    `· Status: ${status}\n` +
                    `· Progress: ${bar} (${progressLine})\n` +
                    `· Reward: ${coin} **${ach.reward}**\n\n`;
    }

    const container = new ContainerBuilder()
        .addSectionComponents(
            new SectionBuilder()
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        `## ${isSelf ? 'Your' : `${target.displayName}'s`} Achievements\n` +
                        `Unlocked: **${completedCount} / ${ACHIEVEMENTS_LIST.length}** achievements`
                    )
                )
                .setThumbnailAccessory(new ThumbnailBuilder().setURL(target.displayAvatarURL({ forceStatic: true })))
        )
        .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(bodyText.trim()))
        .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));

    const btnRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('ach_prev')
            .setLabel('Previous')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(currentPage === 1),
        new ButtonBuilder()
            .setCustomId('ach_page_num')
            .setLabel(`Page ${currentPage} / ${totalPages}`)
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(true),
        new ButtonBuilder()
            .setCustomId('ach_next')
            .setLabel('Next')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(currentPage === totalPages)
    );

    container.addActionRowComponents(btnRow);
    return container;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('achievements')
        .setDescription("View your completed and locked career achievements.")
        .addUserOption(opt =>
            opt.setName('user')
                .setDescription('User to view achievements for')
                .setRequired(false)),

    async execute(interaction) {
        const target = interaction.options.getUser('user') || interaction.user;
        const { user } = interaction;

        if (target.bot) {
            return interaction.editReply({ content: 'Bots do not have achievements.', ephemeral: true });
        }

        try {
            // Load target data to calculate achievements dynamically
            const [profile, userJob, rawInventory, portfolio, fishing, mining, pets] = await Promise.all([
                db.getUser(target.id),
                db.getUserJob(target.id),
                db.getInventory(target.id),
                db.getUserPortfolio(target.id),
                db.getFishingStats(target.id),
                db.getMiningStats(target.id),
                db.getUserPets(target.id)
            ]);

            // Calculate Net Worth
            const inventoryValue = rawInventory.reduce(
                (sum, inv) => sum + inv.quantity * getSellPrice(inv.item_name), 0
            );
            const stocksValue = portfolio.reduce((sum, h) => {
                const price = h.stocks ? h.stocks.current_price : 0;
                return sum + h.shares * price;
            }, 0);
            const netWorth = profile.wallet + profile.bank + inventoryValue + stocksValue;

            // Gather all achievements data
            const data = {
                level: getLevelFromXP(profile.xp || 0),
                netWorth,
                fishCaught: fishing?.total_caught || 0,
                oresMined: mining?.total_mined || 0,
                shiftsWorked: userJob?.total_work_count || 0,
                maxPetLvl: pets.length > 0 ? Math.max(...pets.map(p => p.level)) : 0
            };

            let currentPage = 1;

            const response = await interaction.editReply({
                flags: MessageFlags.IsComponentsV2,
                components: [buildAchievementsContainer(data, target, user, currentPage)]
            });

            const collector = response.createMessageComponentCollector({
                filter: i => i.user.id === user.id,
                time: 60_000
            });

            collector.on('collect', async i => {
                try {
                    await i.deferUpdate();

                    if (i.customId === 'ach_prev') {
                        currentPage = Math.max(1, currentPage - 1);
                    } else if (i.customId === 'ach_next') {
                        currentPage = currentPage + 1;
                    }

                    await interaction.editReply({
                        flags: MessageFlags.IsComponentsV2,
                        components: [buildAchievementsContainer(data, target, user, currentPage)]
                    }).catch(() => null);
                } catch (err) {
                    console.error('[ACHIEVEMENT COLLECTOR ERROR]', err);
                }
            });

            collector.on('end', async () => {
                try {
                    const final = buildAchievementsContainer(data, target, user, currentPage);
                    for (const row of final.components || []) {
                        if (row.components) {
                            for (const comp of row.components) {
                                if (typeof comp.setDisabled === 'function') comp.setDisabled(true);
                            }
                        }
                    }
                    await interaction.editReply({
                        flags: MessageFlags.IsComponentsV2,
                        components: [final]
                    }).catch(() => null);
                } catch (err) {
                    // Ignore
                }
            });

        } catch (err) {
            console.error('[ACHIEVEMENTS LOAD ERROR]', err);
            const msg = { content: 'Failed to load achievements.', ephemeral: true };
            if (interaction.replied || interaction.deferred) await interaction.followUp(msg).catch(() => null);
            else await interaction.editReply(msg).catch(() => null);
        }
    }
};
