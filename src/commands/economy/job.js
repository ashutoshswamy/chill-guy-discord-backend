const {
    SlashCommandBuilder,
    ContainerBuilder, SectionBuilder, TextDisplayBuilder, ThumbnailBuilder,
    SeparatorBuilder, SeparatorSpacingSize, MessageFlags,
    ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, StringSelectMenuOptionBuilder
} = require('discord.js');
const db = require('../../utils/db');
const { getJob, getRank, isMaxRank, getJobList, getPerk, WORKS_PER_RANK, MAX_PRESTIGE, STREAK_BONUS_PER, MAX_STREAK } = require('../../utils/jobs');
const { getLevelFromXP } = require('../../utils/xp');
const { getEmoji } = require('../../utils/emojis');

const coin = getEmoji('coin');

function splitContent(text, max = 3900) {
    if (text.length <= max) return [text];
    const chunks = [];
    const lines = text.split('\n');
    let current = '';
    for (const line of lines) {
        if ((current + '\n' + line).length > max) {
            if (current) chunks.push(current);
            current = line;
        } else {
            current = current ? current + '\n' + line : line;
        }
    }
    if (current) chunks.push(current);
    return chunks;
}

function buildJobListContainer(page, user) {
    const jobs = getJobList();
    const itemsPerPage = 2;
    const totalPages = Math.max(1, Math.ceil(jobs.length / itemsPerPage));
    const currentPage = Math.max(1, Math.min(page, totalPages));

    const pageJobs = jobs.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    let listText = '';
    for (const job of pageJobs) {
        const entry = job.ranks[0];
        const top = job.ranks[job.ranks.length - 1];
        listText +=
            `### ${job.name}\n` +
            `${job.description}\n` +
            `**Min Level:** Level ${entry.levelReq} | ` +
            `**Entry Pay:** ${coin} ${entry.pay[0].toLocaleString()}–${entry.pay[1].toLocaleString()} | ` +
            `**Max Pay:** ${coin} ${top.pay[0].toLocaleString()}–${top.pay[1].toLocaleString()}\n` +
            `**Ranks:** ${job.ranks.map(r => `${r.title} *(L${r.levelReq})*`).join(' → ')}\n` +
            (job.risk ? `**Risk:** ${(job.risk * 100).toFixed(0)}% chance of failed shift\n` : '') +
            '\n';
    }

    const container = new ContainerBuilder()
        .addSectionComponents(
            new SectionBuilder()
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        `## Available Jobs\nShowing ${jobs.length ? (currentPage - 1) * itemsPerPage + 1 : 0}–${Math.min(currentPage * itemsPerPage, jobs.length)} of ${jobs.length} career paths`
                    )
                )
                .setThumbnailAccessory(new ThumbnailBuilder().setURL(user.displayAvatarURL({ forceStatic: true })))
        )
        .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(listText.trim()))
        .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));

    // Select Row to apply directly
    const select = new StringSelectMenuBuilder()
        .setCustomId('job_select_apply')
        .setPlaceholder('Quick Apply for a Job')
        .addOptions(
            jobs.map(j => new StringSelectMenuOptionBuilder()
                .setLabel(j.name)
                .setValue(j.id)
            )
        );

    // Buttons row
    const btnRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('job_prev')
            .setLabel('Previous')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(currentPage === 1),
        new ButtonBuilder()
            .setCustomId('job_page_num')
            .setLabel(`Page ${currentPage} / ${totalPages}`)
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(true),
        new ButtonBuilder()
            .setCustomId('job_next')
            .setLabel('Next')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(currentPage === totalPages)
    );

    container.addActionRowComponents(new ActionRowBuilder().addComponents(select));
    container.addActionRowComponents(btnRow);

    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            `-# Use \`/job apply <job>\` to start your career path.`
        )
    );

    return container;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('job')
        .setDescription('Job system - apply, resign, view stats, or browse listings.')
        .addSubcommand(sub =>
            sub.setName('list')
                .setDescription('Browse all available jobs.'))
        .addSubcommand(sub =>
            sub.setName('apply')
                .setDescription('Apply for a job.')
                .addStringOption(opt =>
                    opt.setName('job')
                        .setDescription('Job to apply for')
                        .setRequired(true)
                        .addChoices(
                            ...getJobList().map(j => ({ name: `${j.name}`, value: j.id }))
                        )))
        .addSubcommand(sub =>
            sub.setName('resign')
                .setDescription('Resign from your current job. Progress will be lost.'))
        .addSubcommand(sub =>
            sub.setName('info')
                .setDescription('View your current job and career stats.'))
        .addSubcommand(sub =>
            sub.setName('prestige')
                .setDescription('Prestige at max rank - reset to rank 0 with a permanent +10% pay multiplier.')),

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();
        const { user } = interaction;

        // ─── LIST ────────────────────────────────────────────────
        if (sub === 'list') {
            let currentPage = 1;

            const response = await interaction.editReply({
                flags: MessageFlags.IsComponentsV2,
                components: [buildJobListContainer(currentPage, user)]
            });

            const collector = response.createMessageComponentCollector({
                filter: i => i.user.id === user.id,
                time: 120_000,
            });

            collector.on('collect', async i => {
                try {
                    if (i.customId === 'job_prev') {
                        await i.deferUpdate();
                        currentPage = Math.max(1, currentPage - 1);
                        const updated = buildJobListContainer(currentPage, user);
                        await interaction.editReply({
                            flags: MessageFlags.IsComponentsV2,
                            components: [updated]
                        }).catch(() => null);
                    } else if (i.customId === 'job_next') {
                        await i.deferUpdate();
                        currentPage = currentPage + 1;
                        const updated = buildJobListContainer(currentPage, user);
                        await interaction.editReply({
                            flags: MessageFlags.IsComponentsV2,
                            components: [updated]
                        }).catch(() => null);
                    } else if (i.customId === 'job_select_apply') {
                        const jobId = i.values[0];
                        const job = getJob(jobId);
                        if (!job) {
                            return i.reply({ content: 'Invalid job.', ephemeral: true }).catch(() => null);
                        }

                        const existing = await db.getUserJob(user.id);
                        if (existing) {
                            const currentJob = getJob(existing.job_id);
                            return i.reply({
                                content: `You are already employed as a **${getRank(currentJob, existing.rank).title}** at **${currentJob.name}**. Resign first with \`/job resign\`.`,
                                ephemeral: true
                            }).catch(() => null);
                        }

                        const userProfile = await db.getUser(user.id);
                        const userLevel = userProfile.level || 1;
                        const minLevel = job.ranks[0].levelReq;
                        if (userLevel < minLevel) {
                            return i.reply({
                                content: `You need to be **Level ${minLevel}** to apply for **${job.name}**. You are currently **Level ${userLevel}**.\n-# Earn XP through \`/work\`, \`/daily\`, gambling wins, and more.`,
                                ephemeral: true
                            }).catch(() => null);
                        }

                        await db.applyJob(user.id, jobId);
                        const startRank = job.ranks[0];

                        const hiredContainer = new ContainerBuilder()
                            .addSectionComponents(
                                new SectionBuilder()
                                    .addTextDisplayComponents(
                                        new TextDisplayBuilder().setContent(
                                            `## Hired: ${job.name}\nWelcome aboard! Use \`/work\` every hour to earn coins and get promoted.`
                                        )
                                    )
                                    .setThumbnailAccessory(new ThumbnailBuilder().setURL(user.displayAvatarURL({ forceStatic: true })))
                            )
                            .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
                            .addTextDisplayComponents(
                                new TextDisplayBuilder().setContent(
                                    `**Starting Rank:** ${startRank.title}\n` +
                                    `**Starting Pay:** ${coin} ${startRank.pay[0].toLocaleString()}–${startRank.pay[1].toLocaleString()} per shift\n` +
                                    `**Promotion:** Every ${WORKS_PER_RANK} shifts\n` +
                                    `**Max Rank:** ${job.ranks[job.ranks.length - 1].title}`
                                )
                            );

                        collector.stop();
                        await i.deferUpdate();
                        await interaction.editReply({
                            flags: MessageFlags.IsComponentsV2,
                            components: [hiredContainer]
                        }).catch(() => null);
                    }
                } catch (err) {
                    console.error('[JOB LIST INTERACTION ERROR]', err);
                }
            });

            collector.on('end', async () => {
                try {
                    // If collector stops naturally, disable the options
                    const final = buildJobListContainer(currentPage, user);
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

            return;
        }

        // ─── APPLY ───────────────────────────────────────────────
        if (sub === 'apply') {
            const jobId = interaction.options.getString('job');
            const job = getJob(jobId);
            if (!job) return interaction.editReply({ content: 'Invalid job.', ephemeral: true });

            const existing = await db.getUserJob(user.id);
            if (existing) {
                const currentJob = getJob(existing.job_id);
                return interaction.editReply({
                    content: `You are already employed as a **${getRank(currentJob, existing.rank).title}** at **${currentJob.name}**. Resign first with \`/job resign\`.`,
                    ephemeral: true
                });
            }

            const userProfile = await db.getUser(user.id);
            const userLevel = userProfile.level || 1;
            const minLevel = job.ranks[0].levelReq;
            if (userLevel < minLevel) {
                return interaction.editReply({
                    content: `You need to be **Level ${minLevel}** to apply for **${job.name}**. You are currently **Level ${userLevel}**.\n-# Earn XP through \`/work\`, \`/daily\`, gambling wins, and more.`,
                    ephemeral: true
                });
            }

            await db.applyJob(user.id, jobId);
            const startRank = job.ranks[0];

            const container = new ContainerBuilder()
                .addSectionComponents(
                    new SectionBuilder()
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent(
                                `## Hired: ${job.name}\nWelcome aboard! Use \`/work\` every hour to earn coins and get promoted.`
                            )
                        )
                        .setThumbnailAccessory(new ThumbnailBuilder().setURL(user.displayAvatarURL({ forceStatic: true })))
                )
                .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        `**Starting Rank:** ${startRank.title}\n` +
                        `**Starting Pay:** ${coin} ${startRank.pay[0].toLocaleString()}–${startRank.pay[1].toLocaleString()} per shift\n` +
                        `**Promotion:** Every ${WORKS_PER_RANK} shifts\n` +
                        `**Max Rank:** ${job.ranks[job.ranks.length - 1].title}`
                    )
                );

            return interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [container] });
        }

        // ─── RESIGN ──────────────────────────────────────────────
        if (sub === 'resign') {
            const existing = await db.getUserJob(user.id);
            if (!existing) {
                return interaction.editReply({ content: 'You are not employed.', ephemeral: true });
            }

            const job = getJob(existing.job_id);
            const rank = getRank(job, existing.rank);
            await db.resignJob(user.id);

            const container = new ContainerBuilder()
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        `## Resigned\nYou left your position as **${rank.title}** at **${job.name}**.\n\n` +
                        `Total shifts worked: **${existing.total_work_count}** | Total earned: ${coin} **${existing.total_earned.toLocaleString()}** coins\n\n` +
                        `-# Use \`/job apply\` to start a new career.`
                    )
                );

            return interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [container] });
        }

        // ─── INFO ────────────────────────────────────────────────
        if (sub === 'info') {
            const existing = await db.getUserJob(user.id);
            if (!existing) {
                return interaction.editReply({
                    content: 'You are unemployed. Use `/job apply` to get hired.',
                    ephemeral: true
                });
            }

            const job    = getJob(existing.job_id);
            const rank   = getRank(job, existing.rank);
            const maxed  = isMaxRank(job, existing.rank);
            const perk   = getPerk(existing.rank);
            const prestige = existing.prestige || 0;
            const streak   = existing.streak || 0;

            const hiredDate = new Date(existing.hired_at).toLocaleDateString('en-US', {
                year: 'numeric', month: 'long', day: 'numeric'
            });

            const userProfile = await db.getUser(user.id);
            const userLevel = userProfile.level || 1;
            const nextRankInfo = maxed ? null : job.ranks[existing.rank + 1];
            const levelGatedInfo = nextRankInfo && userLevel < nextRankInfo.levelReq;

            let progressText = maxed
                ? `**Rank:** MAX - ${rank.title}\n-# Use \`/job prestige\` for +10% permanent bonus (${prestige}/${MAX_PRESTIGE} used)`
                : `**Rank:** ${rank.title}\n**Progress:** ${existing.rank_work_count}/${WORKS_PER_RANK} shifts → **${nextRankInfo.title}**\n**Promotion Bonus:** ${coin} ${nextRankInfo.bonus.toLocaleString()} coins` +
                  (levelGatedInfo ? `\n**Promotion Locked** - Need **Level ${nextRankInfo.levelReq}** (you are Level ${userLevel})` : `\nLevel requirement met (Level ${userLevel}/${nextRankInfo.levelReq})`);

            const perkLine = perk ? `**Active Perk:** ${perk.name} - ${perk.desc}` : '**Perk:** None (reach rank 1)';
            const prestigeLine = prestige > 0 ? `**Prestige ${prestige}/${MAX_PRESTIGE}:** +${prestige * 10}% permanent pay bonus` : '';
            const streakLine = `**Streak:** ${streak}/${MAX_STREAK} (+${(streak * STREAK_BONUS_PER * 100).toFixed(0)}% bonus)`;
            const perfLine = `**Performance Score:** ${(existing.performance_score || 0).toLocaleString()} pts`;

            const container = new ContainerBuilder()
                .addSectionComponents(
                    new SectionBuilder()
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent(
                                `## Career Stats - ${job.name}`
                            )
                        )
                        .setThumbnailAccessory(new ThumbnailBuilder().setURL(user.displayAvatarURL({ forceStatic: true })))
                )
                .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        `${progressText}\n` +
                        `**Pay Range:** ${coin} ${rank.pay[0].toLocaleString()}–${rank.pay[1].toLocaleString()} per shift\n` +
                        `${perkLine}\n` +
                        `${streakLine}\n` +
                        (prestigeLine ? `${prestigeLine}\n` : '') +
                        `${perfLine}\n` +
                        `**Total Shifts:** ${existing.total_work_count} | **Total Earned:** ${coin} ${existing.total_earned.toLocaleString()} coins\n` +
                        `**Hired:** ${hiredDate}`
                    )
                );

            return interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [container] });
        }

        // ─── PRESTIGE ────────────────────────────────────────────
        if (sub === 'prestige') {
            const existing = await db.getUserJob(user.id);
            if (!existing) return interaction.editReply({ content: 'You are not employed.', ephemeral: true });

            const job = getJob(existing.job_id);
            if (!isMaxRank(job, existing.rank)) {
                return interaction.editReply({
                    content: `You must reach max rank (**${job.ranks[job.ranks.length - 1].title}**) before prestiging.`,
                    ephemeral: true
                });
            }

            const currentPrestige = existing.prestige || 0;
            if (currentPrestige >= MAX_PRESTIGE) {
                return interaction.editReply({
                    content: `You have reached the maximum prestige level (**${MAX_PRESTIGE}**). You are a legend.`,
                    ephemeral: true
                });
            }

            const result = await db.prestigeJob(user.id);
            const newPrestige = result.prestige;

            const container = new ContainerBuilder()
                .addSectionComponents(
                    new SectionBuilder()
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent(
                                `## Prestige ${newPrestige} Achieved!\nYou reset your **${job.name}** career for a permanent reward.`
                            )
                        )
                        .setThumbnailAccessory(new ThumbnailBuilder().setURL(user.displayAvatarURL({ forceStatic: true })))
                )
                .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        `**Permanent Pay Multiplier:** +${newPrestige * 10}% on every shift\n` +
                        `**Rank Reset:** Back to **${job.ranks[0].title}**\n` +
                        `**Prestiges Remaining:** ${MAX_PRESTIGE - newPrestige}\n\n` +
                        `-# Grind back to max rank to prestige again.`
                    )
                );

            return interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [container] });
        }
    }
};
