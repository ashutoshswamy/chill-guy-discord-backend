const {
    SlashCommandBuilder,
    ContainerBuilder, SectionBuilder, TextDisplayBuilder, ThumbnailBuilder,
    SeparatorBuilder, SeparatorSpacingSize,
    ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags
} = require('discord.js');
const db = require('../../utils/db');
const {
    getJob, getRank, isMaxRank,
    WORKS_PER_RANK, WORK_COOLDOWN_MS, MAX_STREAK, MAX_PRESTIGE,
    rollShiftEvent, calcStreakWindow, calcPayout, getPerk
} = require('../../utils/jobs');
const { XP_REWARDS, getJobPayMultiplier, getLevelFromXP, getRankTier, getXPProgress, xpBar } = require('../../utils/xp');
const { getEmoji } = require('../../utils/emojis');
const coin = getEmoji('coin');

function formatCooldown(ms) {
    const m = Math.floor(ms / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function streakBar(streak) {
    const filled = Math.min(streak, MAX_STREAK);
    const bar = '█'.repeat(filled) + '░'.repeat(MAX_STREAK - filled);
    return `\`${bar}\` ${filled}/${MAX_STREAK}`;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('work')
        .setDescription('Work your job and earn coins. 1 hour cooldown.'),

    async execute(interaction) {
        const { user } = interaction;

        try {
            const userJob = await db.getUserJob(user.id);

            if (!userJob) {
                return interaction.editReply({
                    content: 'You are unemployed! Use `/job apply` to get hired first.',
                    ephemeral: true
                });
            }

            // Cooldown check
            if (userJob.last_worked_at) {
                const elapsed = Date.now() - new Date(userJob.last_worked_at).getTime();
                if (elapsed < WORK_COOLDOWN_MS) {
                    return interaction.editReply({
                        content: `You need rest! Come back in **${formatCooldown(WORK_COOLDOWN_MS - elapsed)}**.`,
                        ephemeral: true
                    });
                }
            }

            const job = getJob(userJob.job_id);
            if (!job) return interaction.editReply({ content: 'Your job no longer exists. Use `/job resign`.', ephemeral: true });

            const currentRank    = getRank(job, userJob.rank);
            const streakWindow   = calcStreakWindow(userJob.rank);
            const prestige       = userJob.prestige || 0;

            // Streak logic
            const lastWorkedMs = userJob.streak_last_at ? new Date(userJob.streak_last_at).getTime() : 0;
            const timeSinceLast = Date.now() - lastWorkedMs;
            const streakBroken  = lastWorkedMs > 0 && timeSinceLast > streakWindow;
            const newStreak     = streakBroken ? 1 : Math.min((userJob.streak || 0) + 1, MAX_STREAK);

            // Roll shift event
            const event = rollShiftEvent(userJob.rank);
            const isCriminalFail = job.risk && Math.random() < job.risk;
            const effectiveMultiplier = isCriminalFail ? 0 : event.multiplier;

            // Level multiplier from global XP rank
            const userProfile  = await db.getUser(user.id);
            const userLevel    = userProfile.level || 1;
            const levelMult    = getJobPayMultiplier(userLevel);

            // Calculate payout
            let payout = calcPayout(currentRank.pay, userJob.rank, newStreak, prestige, effectiveMultiplier);
            const failed = effectiveMultiplier === 0;
            if (failed) payout = 0;
            else payout = Math.floor(payout * levelMult);

            // Promotion check
            const newRankWorkCount = userJob.rank_work_count + 1;
            const canPromote = !isMaxRank(job, userJob.rank) && newRankWorkCount >= WORKS_PER_RANK;
            const nextRankData = canPromote ? getRank(job, userJob.rank + 1) : null;
            const levelGated = canPromote && userLevel < (nextRankData?.levelReq ?? 0);
            const promoted  = canPromote && !levelGated;
            const finalRankWorkCount = levelGated ? WORKS_PER_RANK : newRankWorkCount;
            const newRank   = promoted ? userJob.rank + 1 : userJob.rank;
            const promoBonus = promoted ? getRank(job, newRank).bonus : 0;
            const totalPayout = payout + promoBonus;

            // Performance delta: jackpot=+3, bonus=+2, normal=+1, fail=-1
            const perfMap = { jackpot: 3, bonus: 2, normal: 1, fail: -1 };
            const perfDelta = failed ? -1 : (perfMap[event.id] || 1);

            // Write to DB
            await db.recordWork(user.id, totalPayout, promoted, newRank, newStreak, perfDelta, finalRankWorkCount);
            if (totalPayout > 0) await db.updateWallet(user.id, totalPayout);

            // Award XP
            const xpAmount = XP_REWARDS.work(userJob.rank) + (promoted ? XP_REWARDS.workPromote : 0);
            const xpResult = await db.addXP(user.id, xpAmount).catch(() => null);

            const updatedUser   = await db.getUser(user.id);
            const activeRank    = getRank(job, newRank);
            const worksAtRank   = promoted ? 1 : Math.min(newRankWorkCount, WORKS_PER_RANK);
            const maxed         = isMaxRank(job, newRank);
            const perk          = getPerk(newRank);

            // Work message
            const workMsg = failed
                ? (job.failMessages || [])[Math.floor(Math.random() * (job.failMessages?.length || 1))] || 'The shift went terribly wrong.'
                : job.workMessages[Math.floor(Math.random() * job.workMessages.length)];

            // Build body
            let earningsText = failed
                ? `**Result:** ${event.label} - ${coin} **0** coins earned`
                : `**Result:** ${event.label}\n**Earned:** ${coin} **+${payout.toLocaleString()}** coins`;
            if (promoBonus > 0) earningsText += `\n**Promotion Bonus:** ${coin} **+${promoBonus.toLocaleString()}** coins`;
            earningsText += `\n**Wallet:** ${coin} **${updatedUser.wallet.toLocaleString()}** coins`;

            // Streak text
            let streakText = streakBroken
                ? `**Streak Reset!** Back to 1\n${streakBar(1)}`
                : `**Streak:** ${newStreak === 1 ? 'Started!' : `+${(newStreak * 3)}% pay bonus`}\n${streakBar(newStreak)}`;
            if (prestige > 0) streakText += `\n**Prestige ${prestige}:** +${prestige * 10}% permanent bonus`;

            // Rank / progress
            let rankText = promoted
                ? `**PROMOTED → ${activeRank.title}**`
                : maxed
                    ? `**Rank:** MAX - ${activeRank.title}\n-# Use \`/job prestige\` to reset with a permanent +10% bonus`
                    : levelGated
                        ? `**Rank:** ${activeRank.title} - ${worksAtRank}/${WORKS_PER_RANK} shifts\n**Promotion Locked** - Need **Level ${nextRankData.levelReq}** to become **${nextRankData.title}** (you are Level ${userLevel})`
                        : `**Rank:** ${activeRank.title} - ${worksAtRank}/${WORKS_PER_RANK} shifts to **${getRank(job, userJob.rank + 1).title}**`;

            if (perk && promoted) rankText += `\n**Perk Unlocked:** ${perk.name} - ${perk.desc}`;

            // XP display
            const xpLevel    = xpResult?.newLevel || userLevel;
            const xpTier     = getRankTier(xpLevel);
            const xpProgress = getXPProgress(updatedUser.xp || 0, xpLevel);
            const levelUpLine = xpResult?.didLevel ? `\n**LEVEL UP → ${xpLevel}!**` : '';
            const xpText =
                `**Level ${xpLevel}** - ${xpTier.name}${levelUpLine}\n` +
                `**+${xpAmount} XP** earned\n` +
                `\`[${xpBar(xpProgress.pct, 12)}]\` ${xpProgress.current.toLocaleString()}/${xpProgress.needed.toLocaleString()} XP\n` +
                `-# Job pay boosted +${((getJobPayMultiplier(xpLevel) - 1) * 100).toFixed(0)}% from level`;

            const accentColor = failed ? 0xEF4444 : promoted ? 0xFFD700 : event.id === 'jackpot' ? 0x9B59B6 : event.id === 'bonus' ? 0x00FFCC : 0x5865F2;

            const container = new ContainerBuilder()
                .addSectionComponents(
                    new SectionBuilder()
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent(
                                `## Work Shift - ${currentRank.title}\n${workMsg}`
                            )
                        )
                        .setThumbnailAccessory(new ThumbnailBuilder().setURL(user.displayAvatarURL({ forceStatic: true })))
                )
                .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
                .addTextDisplayComponents(new TextDisplayBuilder().setContent(earningsText))
                .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
                .addTextDisplayComponents(new TextDisplayBuilder().setContent(streakText))
                .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
                .addTextDisplayComponents(new TextDisplayBuilder().setContent(rankText))
                .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
                .addTextDisplayComponents(new TextDisplayBuilder().setContent(xpText));

            // Overtime button - only on non-failed, non-jackpot shifts
            let overtimeEligible = !failed && payout > 0 && event.id !== 'jackpot';
            if (overtimeEligible) {
                container.addActionRowComponents(
                    new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setCustomId('work_overtime')
                            .setLabel('Work Overtime (30% win 2x / 70% lose 30%)')
                            .setStyle(ButtonStyle.Danger)
                    )
                );
            }

            const response = await interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [container] });

            if (!overtimeEligible) return;

            // Overtime collector - 30 second window
            const collector = response.createMessageComponentCollector({
                filter: i => i.user.id === user.id && i.customId === 'work_overtime',
                time: 30_000,
                max: 1
            });

            collector.on('collect', async i => {
                await i.deferUpdate();

                const win = Math.random() < 0.30;
                let overtimeGain = 0;

                if (win) {
                    overtimeGain = payout;
                    await db.updateWallet(user.id, overtimeGain);
                } else {
                    overtimeGain = -Math.floor(payout * 0.30);
                    await db.updateWallet(user.id, overtimeGain);
                }

                const afterUser = await db.getUser(user.id);
                const overtimeText = win
                    ? `**Overtime WIN!** ${coin} +**${overtimeGain.toLocaleString()}** coins`
                    : `**Overtime LOSS!** ${coin} -**${Math.abs(overtimeGain).toLocaleString()}** coins`;

                const updatedContainer = new ContainerBuilder()
                    .addSectionComponents(
                        new SectionBuilder()
                            .addTextDisplayComponents(
                                new TextDisplayBuilder().setContent(
                                    `## Work Shift - ${currentRank.title}\n${workMsg}`
                                )
                            )
                            .setThumbnailAccessory(new ThumbnailBuilder().setURL(user.displayAvatarURL({ forceStatic: true })))
                    )
                    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
                    .addTextDisplayComponents(new TextDisplayBuilder().setContent(earningsText))
                    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
                    .addTextDisplayComponents(new TextDisplayBuilder().setContent(
                        `${overtimeText}\n**Wallet:** ${coin} **${afterUser.wallet.toLocaleString()}** coins`
                    ))
                    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
                    .addTextDisplayComponents(new TextDisplayBuilder().setContent(rankText));

                await interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [updatedContainer] });
            });

            collector.on('end', async (_, reason) => {
                if (reason === 'time') {
                    // Disable overtime button
                    const disabledContainer = new ContainerBuilder()
                        .addSectionComponents(
                            new SectionBuilder()
                                .addTextDisplayComponents(
                                    new TextDisplayBuilder().setContent(
                                        `## Work Shift - ${currentRank.title}\n${workMsg}`
                                    )
                                )
                                .setThumbnailAccessory(new ThumbnailBuilder().setURL(user.displayAvatarURL({ forceStatic: true })))
                        )
                        .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
                        .addTextDisplayComponents(new TextDisplayBuilder().setContent(earningsText))
                        .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
                        .addTextDisplayComponents(new TextDisplayBuilder().setContent(streakText))
                        .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
                        .addTextDisplayComponents(new TextDisplayBuilder().setContent(rankText))
                        .addActionRowComponents(
                            new ActionRowBuilder().addComponents(
                                new ButtonBuilder()
                                    .setCustomId('work_overtime')
                                    .setLabel('Overtime expired')
                                    .setStyle(ButtonStyle.Danger)
                                    .setDisabled(true)
                            )
                        );
                    await interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [disabledContainer] }).catch(() => null);
                }
            });

        } catch (err) {
            console.error('[WORK ERROR]', err);
            const msg = { content: 'Work shift failed.', ephemeral: true };
            if (interaction.replied || interaction.deferred) await interaction.followUp(msg).catch(() => null);
            else await interaction.editReply(msg).catch(() => null);
        }
    }
};
