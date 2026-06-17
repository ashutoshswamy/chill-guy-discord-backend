const {
    SlashCommandBuilder,
    ContainerBuilder, SectionBuilder, TextDisplayBuilder, ThumbnailBuilder,
    SeparatorBuilder, SeparatorSpacingSize,
    ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags
} = require('discord.js');
const db = require('../../utils/db');

function formatRemaining(ms) {
    if (ms <= 0) return '**Ready**';
    const totalSecs = Math.floor(ms / 1000);
    const hrs = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;

    const parts = [];
    if (hrs > 0) parts.push(`${hrs}h`);
    if (mins > 0 || hrs > 0) parts.push(`${mins}m`);
    parts.push(`${secs}s`);
    return `**${parts.join(' ')}**`;
}

async function buildCooldownsContainer(targetUser) {
    const dbCooldowns = await db.getUserCooldowns(targetUser.id);
    const profile = await db.getUser(targetUser.id);
    const userJob = await db.getUserJob(targetUser.id);

    // 1. Grinding activities (Supabase user_cooldowns)
    const chopRow = dbCooldowns.find(cd => cd.action === 'chop');
    const digRow = dbCooldowns.find(cd => cd.action === 'dig');
    const fishRow = dbCooldowns.find(cd => cd.action === 'fish');
    const huntRow = dbCooldowns.find(cd => cd.action === 'hunt');
    const mineRow = dbCooldowns.find(cd => cd.action === 'mine');

    const chopRem = chopRow ? new Date(chopRow.expires_at).getTime() - Date.now() : 0;
    const digRem = digRow ? new Date(digRow.expires_at).getTime() - Date.now() : 0;
    const fishRem = fishRow ? new Date(fishRow.expires_at).getTime() - Date.now() : 0;
    const huntRem = huntRow ? new Date(huntRow.expires_at).getTime() - Date.now() : 0;
    const mineRem = mineRow ? new Date(mineRow.expires_at).getTime() - Date.now() : 0;

    // Work cooldown (1 hour from last_worked_at)
    let workRem = 0;
    if (userJob && userJob.last_worked_at) {
        workRem = (new Date(userJob.last_worked_at).getTime() + 60 * 60 * 1000) - Date.now();
    }

    // 2. Claims (Supabase users table)
    const dailyRem = profile.daily_claimed_at ? (new Date(profile.daily_claimed_at).getTime() + 24 * 60 * 60 * 1000) - Date.now() : 0;
    const weeklyRem = profile.weekly_claimed_at ? (new Date(profile.weekly_claimed_at).getTime() + 7 * 24 * 60 * 60 * 1000) - Date.now() : 0;
    const monthlyRem = profile.monthly_claimed_at ? (new Date(profile.monthly_claimed_at).getTime() + 30 * 24 * 60 * 60 * 1000) - Date.now() : 0;

    // 3. Minigames (In-memory cooldowns)
    const { cooldowns: memCooldowns } = require('../../utils/cooldowns');

    function getMemRem(action) {
        if (!memCooldowns.has(action)) return 0;
        const expiry = memCooldowns.get(action).get(targetUser.id);
        return expiry ? expiry - Date.now() : 0;
    }

    const minigames = [
        { name: 'Beg', key: 'beg' },
        { name: 'Blackjack', key: 'blackjack' },
        { name: 'Slots', key: 'slots' },
        { name: 'Coinflip', key: 'coinflip' },
        { name: 'Cockfight', key: 'cockfight' },
        { name: 'Rob', key: 'rob' },
        { name: 'Crash', key: 'crash' },
        { name: 'Roulette', key: 'roulette' },
        { name: 'RPS', key: 'rps' },
        { name: 'Scratchcard', key: 'scratchcard' },
        { name: 'Search', key: 'search' },
        { name: 'Mines', key: 'mines' },
        { name: 'Higher Lower', key: 'higherlower' },
        { name: 'Horse Race', key: 'horserace' }
    ];

    const grindingText =
        `**/chop:** ${formatRemaining(chopRem)}\n` +
        `**/dig:** ${formatRemaining(digRem)}\n` +
        `**/fish:** ${formatRemaining(fishRem)}\n` +
        `**/hunt:** ${formatRemaining(huntRem)}\n` +
        `**/mine:** ${formatRemaining(mineRem)}\n` +
        `**/work:** ${userJob ? formatRemaining(workRem) : '*Unemployed*'}`;

    const claimsText =
        `**/daily:** ${formatRemaining(dailyRem)}\n` +
        `**/weekly:** ${formatRemaining(weeklyRem)}\n` +
        `**/monthly:** ${formatRemaining(monthlyRem)}`;

    const activeMinigames = [];
    const readyMinigames = [];

    for (const game of minigames) {
        const rem = getMemRem(game.key);
        if (rem > 0) {
            activeMinigames.push(`**/${game.key}:** ${formatRemaining(rem)}`);
        } else {
            readyMinigames.push(`**/${game.key}:** ${formatRemaining(0)}`);
        }
    }

    const allMinigamesText = [...activeMinigames, ...readyMinigames].join('\n');

    const container = new ContainerBuilder()
        .addSectionComponents(
            new SectionBuilder()
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        `## Cooldowns: ${targetUser.username}\nReview your active action & reward cooldowns`
                    )
                )
                .setThumbnailAccessory(new ThumbnailBuilder().setURL(targetUser.displayAvatarURL({ forceStatic: true })))
        )
        .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `### Grinding & Jobs\n${grindingText}\n\n` +
                `### Claims & Rewards\n${claimsText}\n\n` +
                `### Games & Minigames\n${allMinigamesText}`
            )
        );

    return container;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('cooldowns')
        .setDescription("Check your active action and reward cooldowns.")
        .addUserOption(opt =>
            opt.setName('user')
                .setDescription('The user to check cooldowns for (defaults to yourself)')
                .setRequired(false)),

    async execute(interaction) {
        const targetUser = interaction.options.getUser('user') || interaction.user;
        const { user } = interaction;

        if (targetUser.bot) {
            return interaction.editReply({ content: 'Bots do not have cooldowns.', ephemeral: true });
        }

        try {
            const container = await buildCooldownsContainer(targetUser);

            // Add Refresh button (only works for the command executor for ease of use)
            container.addActionRowComponents(
                new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId('cooldowns_refresh')
                        .setLabel('Refresh')
                        .setStyle(ButtonStyle.Secondary)
                )
            );

            const response = await interaction.editReply({
                flags: MessageFlags.IsComponentsV2,
                components: [container]
            });

            const collector = response.createMessageComponentCollector({
                filter: i => i.user.id === user.id && i.customId === 'cooldowns_refresh',
                time: 120_000 // 2 minutes
            });

            collector.on('collect', async i => {
                const updated = await buildCooldownsContainer(targetUser);
                updated.addActionRowComponents(
                    new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setCustomId('cooldowns_refresh')
                            .setLabel('Refresh')
                            .setStyle(ButtonStyle.Secondary)
                    )
                );
                await i.update({ flags: MessageFlags.IsComponentsV2, components: [updated] }).catch(() => null);
            });

            collector.on('end', async () => {
                // Disable refresh button when collector expires
                const final = await buildCooldownsContainer(targetUser);
                final.addActionRowComponents(
                    new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setCustomId('cooldowns_refresh')
                            .setLabel('Refresh')
                            .setStyle(ButtonStyle.Secondary)
                            .setDisabled(true)
                    )
                );
                await interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [final] }).catch(() => null);
            });

        } catch (err) {
            console.error('[COOLDOWNS ERROR]', err);
            const msg = { content: 'Failed to retrieve cooldowns.', ephemeral: true };
            if (interaction.replied || interaction.deferred) await interaction.followUp(msg).catch(() => null);
            else await interaction.editReply(msg).catch(() => null);
        }
    }
};
