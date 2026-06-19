const {
    SlashCommandBuilder,
    ContainerBuilder, SectionBuilder, TextDisplayBuilder, ThumbnailBuilder,
    SeparatorBuilder, SeparatorSpacingSize,
    ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags
} = require('discord.js');
const db = require('../../utils/db');
const { checkCooldown } = require('../../utils/cooldowns');
const { XP_REWARDS } = require('../../utils/xp');
const { getEmoji } = require('../../utils/emojis');

const coin = getEmoji('coin');

// In-memory active heist state per guild
const activeHeists = new Map();

const HEIST_TARGETS = [
    { name: 'City Bank', emoji: '🏦', baseReward: 5000,  minPlayers: 2, baseFail: 0.50 },
    { name: 'Casino Vault', emoji: '🎰', baseReward: 15000, minPlayers: 3, baseFail: 0.55 },
    { name: 'Diamond Exchange', emoji: '💎', baseReward: 35000, minPlayers: 4, baseFail: 0.65 },
    { name: 'Federal Reserve', emoji: '🏛️', baseReward: 75000, minPlayers: 5, baseFail: 0.70 },
];

const SUCCESS_LINES = [
    'The crew slipped in through the ventilation system — textbook execution.',
    'Inside man tipped off the vault combo. Flawless.',
    'Jammed the cameras, took the cash, vanished like ghosts.',
    'The guards never stood a chance. You walked out heroes.',
];

const FAIL_LINES = [
    'Silent alarm tripped. Police arrived in 3 minutes. Everyone scattered.',
    'The inside man sold you out. Ambush at the entrance.',
    'Vault was empty — someone tipped off the bank.',
    'Thermal sensors detected the crew. Mission abort.',
];

function buildJoinEmbed(heist, timeLeft) {
    const target = heist.target;
    const participants = [...heist.participants];
    const memberList = participants.length > 0
        ? participants.map(id => `<@${id}>`).join(', ')
        : '*Nobody yet...*';

    return new ContainerBuilder()
        .addSectionComponents(
            new SectionBuilder()
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        `## ${target.emoji} Heist: ${target.name}\n` +
                        `**Reward Pool:** ${coin} ${target.baseReward.toLocaleString()}\n` +
                        `**Min Players:** ${heist.minPlayers} | **Success Rate:** ${heist.successRate}%\n` +
                        `**Joining window:** ${timeLeft}s remaining`
                    )
                )
                .setThumbnailAccessory(new ThumbnailBuilder().setURL('https://cdn.discordapp.com/emojis/1516875454898765964.png').setDescription('heist'))
        )
        .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `**Crew (${participants.length}/${heist.minPlayers} min):**\n${memberList}`
            )
        );
}

function calcSuccessRate(participants, target, guildSettings) {
    // Base: 35% + 12% per player, capped at 85%
    const base = 35 + (participants * 12);
    return Math.min(85, base);
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('heist')
        .setDescription('Organize a group heist to rob a target.')
        .addSubcommand(sub =>
            sub.setName('start')
                .setDescription('Start a heist and recruit crew members.')
                .addStringOption(opt =>
                    opt.setName('target')
                        .setDescription('Choose a heist target')
                        .setRequired(true)
                        .addChoices(
                            { name: '🏦 City Bank — 5,000 reward', value: '0' },
                            { name: '🎰 Casino Vault — 15,000 reward', value: '1' },
                            { name: '💎 Diamond Exchange — 35,000 reward', value: '2' },
                            { name: '🏛️ Federal Reserve — 75,000 reward', value: '3' },
                        )))
        .addSubcommand(sub =>
            sub.setName('config')
                .setDescription('(Server Admin) Configure heist settings.')
                .addIntegerOption(opt =>
                    opt.setName('min_players')
                        .setDescription('Minimum players to start a heist (1-10)')
                        .setMinValue(1).setMaxValue(10))
                .addIntegerOption(opt =>
                    opt.setName('cooldown_mins')
                        .setDescription('Heist cooldown in minutes (10-1440)')
                        .setMinValue(10).setMaxValue(1440))),

    async execute(interaction) {
        const { user, guild } = interaction;
        const sub = interaction.options.getSubcommand();

        try {
            // ── CONFIG ──────────────────────────────────────────
            if (sub === 'config') {
                if (!interaction.memberPermissions?.has('ManageGuild') && !interaction.memberPermissions?.has('Administrator')) {
                    return interaction.editReply({ content: 'You need **Manage Server** permission to configure heist settings.', ephemeral: true });
                }

                const minPlayers   = interaction.options.getInteger('min_players');
                const cooldownMins = interaction.options.getInteger('cooldown_mins');

                const updates = {};
                if (minPlayers   != null) updates.heist_min_players   = minPlayers;
                if (cooldownMins != null) updates.heist_cooldown_mins = cooldownMins;

                if (Object.keys(updates).length === 0) {
                    return interaction.editReply({ content: 'Provide at least one setting to update.', ephemeral: true });
                }

                const settings = await db.updateGuildSettings(guild.id, updates);

                const container = new ContainerBuilder()
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(
                            `## Heist Config Updated\n` +
                            `**Min Players:** ${settings.heist_min_players}\n` +
                            `**Cooldown:** ${settings.heist_cooldown_mins} minutes`
                        )
                    );
                return interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [container] });
            }

            // ── START ──────────────────────────────────────────
            if (sub === 'start') {
                if (!guild) {
                    return interaction.editReply({ content: 'Heist can only be started in a server.', ephemeral: true });
                }

                // Check if heist already active in this guild
                if (activeHeists.has(guild.id)) {
                    return interaction.editReply({ content: 'A heist is already in progress in this server. Join it!', ephemeral: true });
                }

                // Personal cooldown
                const settings     = await db.getGuildSettings(guild.id);
                const cooldownSecs = (settings.heist_cooldown_mins || 60) * 60;
                const cdKey        = `heist_${guild.id}_${user.id}`;
                const cd           = checkCooldown(cdKey, user.id, cooldownSecs);
                if (cd.onCooldown) {
                    return interaction.editReply({ content: `Laying low. Wait **${cd.remaining}s** before starting another heist.`, ephemeral: true });
                }

                const targetIdx = parseInt(interaction.options.getString('target'));
                const target    = HEIST_TARGETS[targetIdx];
                const minPlayers = settings.heist_min_players || target.minPlayers;

                const heistState = {
                    guildId:     guild.id,
                    channelId:   interaction.channelId,
                    initiatorId: user.id,
                    target,
                    minPlayers,
                    participants: new Set([user.id]),
                    successRate:  calcSuccessRate(1, target, settings),
                    phase:        'recruiting',
                    startedAt:    Date.now(),
                };

                activeHeists.set(guild.id, heistState);

                const joinBtn = new ButtonBuilder()
                    .setCustomId(`heist_join_${guild.id}`)
                    .setLabel('Join Heist')
                    .setStyle(ButtonStyle.Success)
                    .setEmoji('🔫');

                const cancelBtn = new ButtonBuilder()
                    .setCustomId(`heist_cancel_${guild.id}`)
                    .setLabel('Cancel')
                    .setStyle(ButtonStyle.Danger);

                const row = new ActionRowBuilder().addComponents(joinBtn, cancelBtn);

                const WINDOW_SECS = 60;
                const container = buildJoinEmbed(heistState, WINDOW_SECS);

                const reply = await interaction.editReply({
                    flags: MessageFlags.IsComponentsV2,
                    components: [container, row],
                });

                // Fetch the reply message for collector
                const msg = await interaction.fetchReply();

                const collector = msg.createMessageComponentCollector({
                    time: WINDOW_SECS * 1000,
                });

                // Countdown update interval
                let countdown = WINDOW_SECS;
                const ticker = setInterval(async () => {
                    countdown -= 15;
                    if (countdown <= 0 || heistState.phase !== 'recruiting') {
                        clearInterval(ticker);
                        return;
                    }
                    heistState.successRate = calcSuccessRate(heistState.participants.size, target, settings);
                    const updated = buildJoinEmbed(heistState, countdown);
                    await interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [updated, row] }).catch(() => null);
                }, 15000);

                collector.on('collect', async (btnInteraction) => {
                    if (heistState.phase !== 'recruiting') {
                        await btnInteraction.reply({ content: 'Heist already in progress.', ephemeral: true });
                        return;
                    }

                    if (btnInteraction.customId === `heist_cancel_${guild.id}`) {
                        if (btnInteraction.user.id !== user.id) {
                            await btnInteraction.reply({ content: 'Only the heist initiator can cancel.', ephemeral: true });
                            return;
                        }
                        heistState.phase = 'cancelled';
                        activeHeists.delete(guild.id);
                        collector.stop('cancelled');
                        clearInterval(ticker);
                        await btnInteraction.update({
                            flags: MessageFlags.IsComponentsV2,
                            components: [
                                new ContainerBuilder().addTextDisplayComponents(
                                    new TextDisplayBuilder().setContent('## Heist Cancelled\nThe crew dispersed.')
                                )
                            ]
                        });
                        return;
                    }

                    if (btnInteraction.customId === `heist_join_${guild.id}`) {
                        if (heistState.participants.has(btnInteraction.user.id)) {
                            await btnInteraction.reply({ content: "You're already in the crew.", ephemeral: true });
                            return;
                        }

                        // Check user has at least 100 coins (skin in the game)
                        const joinerProfile = await db.getUser(btnInteraction.user.id).catch(() => null);
                        if (!joinerProfile || joinerProfile.wallet < 100) {
                            await btnInteraction.reply({ content: 'Need at least **100** coins in your wallet to join a heist.', ephemeral: true });
                            return;
                        }

                        heistState.participants.add(btnInteraction.user.id);
                        heistState.successRate = calcSuccessRate(heistState.participants.size, target, settings);
                        const updatedEmbed = buildJoinEmbed(heistState, Math.max(0, WINDOW_SECS - Math.floor((Date.now() - heistState.startedAt) / 1000)));
                        await btnInteraction.update({ flags: MessageFlags.IsComponentsV2, components: [updatedEmbed, row] });
                    }
                });

                collector.on('end', async (_collected, reason) => {
                    clearInterval(ticker);
                    if (reason === 'cancelled' || heistState.phase === 'cancelled') return;
                    if (heistState.phase !== 'recruiting') return;

                    heistState.phase = 'executing';
                    activeHeists.delete(guild.id);

                    const participants = [...heistState.participants];
                    if (participants.length < minPlayers) {
                        await interaction.editReply({
                            flags: MessageFlags.IsComponentsV2,
                            components: [
                                new ContainerBuilder()
                                    .addTextDisplayComponents(
                                        new TextDisplayBuilder().setContent(
                                            `## Heist Aborted — Not Enough Crew\nNeeded **${minPlayers}** players, only **${participants.length}** showed up.`
                                        )
                                    )
                            ]
                        }).catch(() => null);
                        return;
                    }

                    // Execute heist
                    const successRate = calcSuccessRate(participants.length, target, settings);
                    const success     = Math.random() * 100 < successRate;

                    if (success) {
                        const totalReward    = Math.floor(target.baseReward * (0.7 + Math.random() * 0.6));
                        const sharePerPerson = Math.floor(totalReward / participants.length);
                        const xpGain         = Math.floor(XP_REWARDS.robSuccess * 1.5);

                        await Promise.all(participants.map(id =>
                            db.updateWallet(id, sharePerPerson)
                                .then(() => db.addXP(id, xpGain).catch(() => null))
                                .catch(() => null)
                        ));

                        const story = SUCCESS_LINES[Math.floor(Math.random() * SUCCESS_LINES.length)];
                        const crew  = participants.map(id => `<@${id}>`).join(', ');

                        await interaction.editReply({
                            flags: MessageFlags.IsComponentsV2,
                            components: [
                                new ContainerBuilder()
                                    .addSectionComponents(
                                        new SectionBuilder()
                                            .addTextDisplayComponents(
                                                new TextDisplayBuilder().setContent(`## ${target.emoji} Heist Successful!`)
                                            )
                                            .setThumbnailAccessory(new ThumbnailBuilder().setURL(interaction.client.user.displayAvatarURL()))
                                    )
                                    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
                                    .addTextDisplayComponents(
                                        new TextDisplayBuilder().setContent(
                                            `*${story}*\n\n` +
                                            `**Target:** ${target.name}\n` +
                                            `**Total Haul:** ${coin} ${totalReward.toLocaleString()}\n` +
                                            `**Each Gets:** ${coin} ${sharePerPerson.toLocaleString()}\n\n` +
                                            `**Crew:** ${crew}`
                                        )
                                    )
                            ]
                        }).catch(() => null);

                    } else {
                        // Failed — each loses 10-20% of wallet
                        const lossResults = await Promise.all(participants.map(async id => {
                            const profile = await db.getUser(id).catch(() => null);
                            if (!profile) return { id, loss: 0 };
                            const lossPct = 0.10 + Math.random() * 0.10;
                            const loss    = Math.floor(profile.wallet * lossPct);
                            if (loss > 0) await db.updateWallet(id, -loss).catch(() => null);
                            return { id, loss };
                        }));

                        const totalLost = lossResults.reduce((s, r) => s + r.loss, 0);
                        const story     = FAIL_LINES[Math.floor(Math.random() * FAIL_LINES.length)];
                        const crew      = participants.map(id => `<@${id}>`).join(', ');

                        await interaction.editReply({
                            flags: MessageFlags.IsComponentsV2,
                            components: [
                                new ContainerBuilder()
                                    .addSectionComponents(
                                        new SectionBuilder()
                                            .addTextDisplayComponents(
                                                new TextDisplayBuilder().setContent(`## ${target.emoji} Heist Failed!`)
                                            )
                                            .setThumbnailAccessory(new ThumbnailBuilder().setURL(interaction.client.user.displayAvatarURL()))
                                    )
                                    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
                                    .addTextDisplayComponents(
                                        new TextDisplayBuilder().setContent(
                                            `*${story}*\n\n` +
                                            `**Target:** ${target.name}\n` +
                                            `**Total Lost:** ${coin} ${totalLost.toLocaleString()} (split by the crew)\n\n` +
                                            `**Crew:** ${crew}`
                                        )
                                    )
                            ]
                        }).catch(() => null);
                    }
                });
            }

        } catch (err) {
            console.error('[HEIST ERROR]', err);
            activeHeists.delete(guild?.id);
            return interaction.editReply({ content: `**Error:** ${err.message}`, ephemeral: true });
        }
    }
};
