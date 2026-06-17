const {
    SlashCommandBuilder,
    ContainerBuilder, SectionBuilder, TextDisplayBuilder, ThumbnailBuilder,
    SeparatorBuilder, SeparatorSpacingSize, MessageFlags
} = require('discord.js');
const db = require('../../utils/db');
const { getEmoji } = require('../../utils/emojis');

const coin = getEmoji('coin');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('streak')
        .setDescription('View your current daily login and job streaks.')
        .addUserOption(opt =>
            opt.setName('user')
                .setDescription('User to view streaks for')
                .setRequired(false)),

    async execute(interaction) {
        const target = interaction.options.getUser('user') || interaction.user;
        const isSelf = target.id === interaction.user.id;

        if (target.bot) {
            return interaction.editReply({ content: 'Bots do not have streaks.', ephemeral: true });
        }

        try {
            const [streak, job] = await Promise.all([
                db.getUserStreak(target.id),
                db.getUserJob(target.id)
            ]);

            const container = new ContainerBuilder()
                .addSectionComponents(
                    new SectionBuilder()
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent(
                                `## Streaks: ${isSelf ? 'Your' : `${target.displayName}'s`}`
                            )
                        )
                        .setThumbnailAccessory(new ThumbnailBuilder().setURL(target.displayAvatarURL({ forceStatic: true })))
                )
                .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));

            // Daily Claim Streak
            const currentDaily = streak?.daily_streak || 0;
            const highestDaily = streak?.highest_streak || 0;
            let dailyDesc = `**Daily Claim Streak:** \`${currentDaily}\` days\n` +
                            `*Highest Record:* \`${highestDaily}\` days\n`;

            if (currentDaily > 0) {
                dailyDesc += `-# Keep claiming \`/daily\` every day to extend your streak!`;
            } else {
                dailyDesc += `-# Claim your first reward with \`/daily\` to start a streak!`;
            }

            container.addTextDisplayComponents(
                new TextDisplayBuilder().setContent(`### Login Streak\n${dailyDesc}`)
            );

            container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));

            // Job Streak
            const currentJob = job?.streak || 0;
            let jobDesc = `**Job Shift Streak:** \`${currentJob}\` shifts\n`;
            if (job) {
                jobDesc += `-# Work consecutively using \`/work\` to build up this streak!`;
            } else {
                jobDesc += `-# Unemployed. Apply for a job using \`/job apply\` to start a work streak!`;
            }

            container.addTextDisplayComponents(
                new TextDisplayBuilder().setContent(`### Career Streak\n${jobDesc}`)
            );

            await interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [container] });

        } catch (err) {
            console.error('[STREAK ERROR]', err);
            const msg = { content: 'Failed to load streak statistics.', ephemeral: true };
            if (interaction.replied || interaction.deferred) await interaction.followUp(msg).catch(() => null);
            else await interaction.editReply(msg).catch(() => null);
        }
    }
};
