const {
    SlashCommandBuilder,
    ContainerBuilder, SectionBuilder, TextDisplayBuilder, ThumbnailBuilder,
    SeparatorBuilder, SeparatorSpacingSize,
    ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags,
    StringSelectMenuBuilder, StringSelectMenuOptionBuilder
} = require('discord.js');

const CATEGORIES = {
    economy: {
        label: 'Economy',
        emoji: '',
        commands: [
            { name: '/balance [user]', desc: 'Check wallet, bank, and net worth.', details: 'Cooldown: None · Option: user (optional)' },
            { name: '/deposit <amount | all>', desc: 'Deposit coins into bank safety.', details: 'Cooldown: None · Protects coins from robberies' },
            { name: '/withdraw <amount | all>', desc: 'Withdraw coins to wallet for spending.', details: 'Cooldown: None' },
            { name: '/pay <user> <amount>', desc: 'Send wallet coins to another user.', details: 'Cooldown: None · Action is irreversible' },
            { name: '/daily', desc: 'Claim daily allowance of 500-1000 coins.', details: 'Cooldown: 24 hours' },
            { name: '/weekly', desc: 'Claim weekly allowance of 5000-8000 coins.', details: 'Cooldown: 7 days' },
            { name: '/monthly', desc: 'Claim monthly allowance of 25000-40000 coins.', details: 'Cooldown: 30 days' },
            { name: '/beg', desc: 'Beg for spare change.', details: 'Cooldown: 45s · Payout: 5-50 coins' },
            { name: '/search', desc: 'Search funny locations for loose change or items.', details: 'Cooldown: 30s · Payout depends on risk level' }
        ]
    },
    gambling: {
        label: 'Gambling',
        emoji: '',
        commands: [
            { name: '/coinflip <amount> <heads | tails>', desc: 'Standard 50/50 flip.', details: 'Cooldown: 15s · Win: 2x bet' },
            { name: '/slots <amount>', desc: 'Spin reels and match symbols.', details: 'Cooldown: 15s · Win up to 50x bet' },
            { name: '/blackjack <amount>', desc: 'Play Blackjack against the dealer.', details: 'Cooldown: 15s · Win: 2x bet (2.5x blackjack)' },
            { name: '/roulette <amount> <bet>', desc: 'Bet on colors or specific numbers.', details: 'Cooldown: 15s · Win: Red/Black (2x), Green (14x), Number (36x)' },
            { name: '/higherlower <amount>', desc: 'Guess if the next card is higher/lower.', details: 'Cooldown: 15s · Multiplier climbs up to 30x' },
            { name: '/crash <amount>', desc: 'Cash out before the multiplier crashes.', details: 'Cooldown: 15s · Volatility: Extreme' },
            { name: '/rps <amount>', desc: 'Classic Rock-Paper-Scissors.', details: 'Cooldown: 15s · Draw refunds bet' },
            { name: '/cockfight <amount>', desc: 'Bet on your active pet rooster.', details: 'Cooldown: 15s (Rooster recovery: 5m)' },
            { name: '/horserace <amount> <horse>', desc: 'Bet on 1 of 5 horses.', details: 'Cooldown: 15s · Win: 2x to 8x (depends on odds)' },
            { name: '/scratchcard [tier]', desc: 'Match 3 items on a 3x3 grid.', details: 'Cooldown: 15s · Win up to 20x' },
            { name: '/mines <bet> [mines]', desc: 'Play Mines. Reveal safe tiles to multiply your bet.', details: 'Cooldown: 15s · Grid size: 4x4' },
            { name: '/rob <target>', desc: 'Attempt to steal from another wallet.', details: 'Cooldown: 10m · Success: 40% (fine on failure)' },
            { name: '/lottery buy <tickets>', desc: 'Buy lottery tickets (100 coins each).', details: 'Cooldown: None · Draw occurs every 24 hours' },
            { name: '/lottery info', desc: 'Check current lottery pot, round, and your tickets.', details: 'Cooldown: None' },
            { name: '/lottery draw', desc: 'Draw the lottery winner.', details: 'Cooldown: Available 24h after last draw' }
        ]
    },
    jobs: {
        label: 'Jobs & Work',
        emoji: '',
        commands: [
            { name: '/job list', desc: 'Browse all available jobs, ranks, and pay.', details: 'Cooldown: None' },
            { name: '/job apply <job>', desc: 'Apply for a job path.', details: 'Cooldown: None · Requires minimum level to apply' },
            { name: '/job info', desc: 'Check current job performance and streak details.', details: 'Cooldown: None' },
            { name: '/job resign', desc: 'Resign from your current career.', details: 'Cooldown: None · Resets rank progress' },
            { name: '/job prestige', desc: 'Reset job rank for permanent pay multipliers.', details: 'Cooldown: None · Max prestige: 5' },
            { name: '/work', desc: 'Work your active job shift.', details: 'Cooldown: 1h · Promotes every 15 shifts' }
        ]
    },
    activities: {
        label: 'Activities & Grinding',
        emoji: '',
        commands: [
            { name: '/hunt', desc: 'Hunt for game in the wilderness.', details: 'Cooldown: 1h · Requires Hunting Rifle item' },
            { name: '/dig', desc: 'Dig for buried treasures.', details: 'Cooldown: 45m · Requires Shovel item' },
            { name: '/chop', desc: 'Chop down trees for valuable timber.', details: 'Cooldown: 45m · Requires Axe item' },
            { name: '/mine', desc: 'Mine ore veins and rare gems.', details: 'Cooldown: 45m · Requires Pickaxe item' },
            { name: '/fish', desc: 'Cast a fishing line.', details: 'Cooldown: 45m · Requires Fishing Pole item' }
        ]
    },
    pets: {
        label: 'Pets System',
        emoji: '',
        commands: [
            { name: '/pet adopt <type> <name>', desc: 'Adopt a pet companion.', details: 'Cooldown: None · Costs coins · Max pets: 5' },
            { name: '/pet status', desc: 'View active pet hunger, happiness, energy, and health.', details: 'Cooldown: None' },
            { name: '/pet feed', desc: 'Restore hunger and health.', details: 'Cooldown: 1h (cooldown-free with Pet Food item)' },
            { name: '/pet play', desc: 'Boost happiness, uses energy.', details: 'Cooldown: 30m' },
            { name: '/pet list', desc: 'View all owned pets and stats.', details: 'Cooldown: None · Set active companion via select menu' },
            { name: '/pet select <id>', desc: 'Set active companion pet.', details: 'Cooldown: None' },
            { name: '/pet rename <name>', desc: 'Give your active pet a new name.', details: 'Cooldown: None' },
            { name: '/pet evolve', desc: 'Evolve active pet at lvl 10 (Adult) and lvl 25 (Elder).', details: 'Cooldown: None' },
            { name: '/pet release <id>', desc: 'Release owned pet into wild.', details: 'Cooldown: None · Action is permanent' }
        ]
    },
    stocks: {
        label: 'Stocks & Trading',
        emoji: '',
        commands: [
            { name: '/stocks view <exchange>', desc: 'View stock exchange listings.', details: 'Cooldown: None · Prices update every 30 minutes' },
            { name: '/stocks info <ticker>', desc: 'Detailed stock metrics & volatility.', details: 'Cooldown: None · Shows personal holdings if owned' },
            { name: '/stocks buy <ticker> <shares>', desc: 'Purchase stock shares.', details: 'Cooldown: None · Deducted from wallet balance' },
            { name: '/stocks sell <ticker> <shares | all>', desc: 'Sell stock shares.', details: 'Cooldown: None · Earned added to wallet balance' },
            { name: '/stocks portfolio [user]', desc: 'View current stock portfolio.', details: 'Cooldown: None · Displays average buy prices and P&L' }
        ]
    },
    shop: {
        label: 'Shop & Items',
        emoji: '',
        commands: [
            { name: '/shop view [category]', desc: 'Browse the shop items.', details: 'Cooldown: None · Category filtering dropdown available' },
            { name: '/shop buy <item>', desc: 'Buy permanent tools or consumables.', details: 'Cooldown: None · Tools are one-time purchase' },
            { name: '/shop sell <item> [amount]', desc: 'Sell gathered loot or items.', details: 'Cooldown: None · Added to wallet balance' },
            { name: '/inventory [user]', desc: 'View owned items, tools, and value.', details: 'Cooldown: None · Displays estimated sell value' },
            { name: '/lootbox open <tier>', desc: 'Open a lootbox from your inventory.', details: 'Cooldown: None · Rewards coins, XP, and consumable items' },
            { name: '/lootbox tiers', desc: 'View all lootbox tiers, drop rates, and potential rewards.', details: 'Cooldown: None' }
        ]
    },
    stats: {
        label: 'Stats & Rank',
        emoji: '',
        commands: [
            { name: '/rank [user]', desc: 'Check level, total XP, and progression.', details: 'Cooldown: None · View level pay bonuses' },
            { name: '/balance [user]', desc: 'View wallet, bank, and net worth.', details: 'Cooldown: None · Easy deposit/withdraw buttons' }
        ]
    },
    utility: {
        label: 'Utility',
        emoji: '',
        commands: [
            { name: '/ping', desc: 'Check bot Latency.', details: 'Cooldown: None' },
            { name: '/cooldowns [user]', desc: 'Check active action and reward cooldowns.', details: 'Cooldown: None · Option: user (optional)' },
            { name: '/help', desc: 'Browse help commands.', details: 'Cooldown: None · Dropdown & page pagination' }
        ]
    },
    admin: {
        label: 'Administrator',
        emoji: '',
        commands: [
            { name: '/admin balance-give <user> <amount>', desc: 'Give coins to a user.', details: 'Requires: Bot Developer' },
            { name: '/admin balance-remove <user> <amount>', desc: 'Remove coins from a user.', details: 'Requires: Bot Developer' },
            { name: '/admin balance-set <user> <amount>', desc: 'Set a user\'s balance directly.', details: 'Requires: Bot Developer' },
            { name: '/admin item-give <user> <item> [quantity]', desc: 'Give an item to a user.', details: 'Requires: Bot Developer · Autocomplete support' },
            { name: '/admin item-remove <user> <item> [quantity]', desc: 'Remove an item from a user.', details: 'Requires: Bot Developer · Autocomplete support' },
            { name: '/admin xp-add <user> <amount>', desc: 'Add XP to a user.', details: 'Requires: Bot Developer' },
            { name: '/admin cooldown-reset <user> <action>', desc: 'Reset cooldowns for a user.', details: 'Requires: Bot Developer' }
        ]
    }
};

// Exchange list for stocks info page
const STOCK_EXCHANGES = [
    'NYSE - 50 stocks (BRK, JPM, V, LLY, GS…)',
    'NASDAQ - 50 stocks (AAPL, NVDA, TSLA, META, COIN…)',
    'LSE - 50 stocks (AZN, SHEL, GAW, OCDO…)',
    'TSE - 50 stocks (NTD, TYT, SNY, KNM…)',
    'HKEX - 50 stocks (TCT, BABA, BYD, EVG…)',
    'NSE - 50 stocks (RELI, TCS, MARUTI, BAJFIN…)',
    'CRYPTO - 50 coins (BTC, ETH, SOL, PEPE, FLOKI…)',
];

const CATEGORY_KEYS = Object.keys(CATEGORIES);

function buildHelpContainer(categoryKey, page, client) {
    if (categoryKey === 'overview') {
        const container = new ContainerBuilder()
            .addSectionComponents(
                new SectionBuilder()
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(
                            `## Chill Guy Bot - Help\nGlobal economy bot. Use the dropdown below to explore categories.`
                        )
                    )
                    .setThumbnailAccessory(
                        new ThumbnailBuilder().setURL(client.user.displayAvatarURL({ forceStatic: true }))
                    )
            )
            .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    Object.values(CATEGORIES).map(c =>
                        `**${c.label}** - ${c.commands.length} commands`
                    ).join('\n')
                )
            );

        const select = new StringSelectMenuBuilder()
            .setCustomId('help_select_category')
            .setPlaceholder('Choose a Category')
            .addOptions(
                new StringSelectMenuOptionBuilder().setLabel('Overview / Home').setValue('overview').setDefault(true),
                ...CATEGORY_KEYS.map(k => new StringSelectMenuOptionBuilder()
                    .setLabel(CATEGORIES[k].label)
                    .setValue(k)
                )
            );

        container.addActionRowComponents(new ActionRowBuilder().addComponents(select));
        return container;
    }

    const cat = CATEGORIES[categoryKey];
    let extraText = '';
    if (categoryKey === 'stocks') {
        extraText = '\n\n**Available Exchanges (350 total):**\n' + STOCK_EXCHANGES.join('\n');
    }

    const commands = cat.commands;
    const itemsPerPage = 6;
    const totalPages = Math.max(1, Math.ceil(commands.length / itemsPerPage));
    const currentPage = Math.max(1, Math.min(page, totalPages));

    const pageCommands = commands.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
    const commandListStr = pageCommands.map(c => {
        let str = `**${c.name}**\n${c.desc}`;
        if (c.details) {
            str += `\n-# ${c.details}`;
        }
        return str;
    }).join('\n\n');

    const container = new ContainerBuilder()
        .addSectionComponents(
            new SectionBuilder()
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(`## ${cat.label} Commands\nShowing ${commands.length ? (currentPage - 1) * itemsPerPage + 1 : 0}-${Math.min(currentPage * itemsPerPage, commands.length)} of ${commands.length} commands`)
                )
                .setThumbnailAccessory(
                    new ThumbnailBuilder().setURL(client.user.displayAvatarURL({ forceStatic: true }))
                )
        )
        .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(commandListStr + extraText)
        )
        .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));

    const select = new StringSelectMenuBuilder()
        .setCustomId('help_select_category')
        .setPlaceholder('Choose a Category')
        .addOptions(
            new StringSelectMenuOptionBuilder().setLabel('Overview / Home').setValue('overview'),
            ...CATEGORY_KEYS.map(k => new StringSelectMenuOptionBuilder()
                .setLabel(CATEGORIES[k].label)
                .setValue(k)
                .setDefault(k === categoryKey)
            )
        );

    const btnRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('help_back')
            .setLabel('Home')
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId('help_prev')
            .setLabel('Previous')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(currentPage === 1),
        new ButtonBuilder()
            .setCustomId('help_page_num')
            .setLabel(`Page ${currentPage} / ${totalPages}`)
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(true),
        new ButtonBuilder()
            .setCustomId('help_next')
            .setLabel('Next')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(currentPage === totalPages)
    );

    container.addActionRowComponents(new ActionRowBuilder().addComponents(select));
    container.addActionRowComponents(btnRow);

    return container;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('Browse all bot commands by category.'),

    async execute(interaction) {
        const { user, client } = interaction;

        try {
            let currentCategory = 'overview';
            let currentPage = 1;

            const response = await interaction.editReply({
                flags: MessageFlags.IsComponentsV2,
                components: [buildHelpContainer(currentCategory, currentPage, client)]
            });

            const collector = response.createMessageComponentCollector({
                filter: i => i.user.id === user.id,
                time: 120_000,
            });

            collector.on('collect', async i => {
                try {
                    await i.deferUpdate();

                    if (i.customId === 'help_back') {
                        currentCategory = 'overview';
                        currentPage = 1;
                    } else if (i.customId === 'help_prev') {
                        currentPage = Math.max(1, currentPage - 1);
                    } else if (i.customId === 'help_next') {
                        currentPage = currentPage + 1;
                    } else if (i.customId === 'help_select_category') {
                        currentCategory = i.values[0];
                        currentPage = 1;
                    }

                    const updated = buildHelpContainer(currentCategory, currentPage, client);
                    await interaction.editReply({
                        flags: MessageFlags.IsComponentsV2,
                        components: [updated]
                    }).catch(() => null);
                } catch (err) {
                    console.error('[HELP INTERACTION ERROR]', err);
                }
            });

            collector.on('end', async () => {
                try {
                    const final = buildHelpContainer(currentCategory, currentPage, client);
                    for (const c of final.components || []) {
                        if (c.components) {
                            for (const comp of c.components) {
                                if (typeof comp.setDisabled === 'function') comp.setDisabled(true);
                            }
                        }
                        if (typeof c.setDisabled === 'function') c.setDisabled(true);
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
            console.error('[HELP ERROR]', err);
            const msg = { content: 'Failed to load help menu.', ephemeral: true };
            if (interaction.replied || interaction.deferred) await interaction.followUp(msg).catch(() => null);
            else await interaction.editReply(msg).catch(() => null);
        }
    }
};
