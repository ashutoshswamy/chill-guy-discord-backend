const {
    SlashCommandBuilder,
    ContainerBuilder, SectionBuilder, TextDisplayBuilder, ThumbnailBuilder,
    SeparatorBuilder, SeparatorSpacingSize, MessageFlags
} = require('discord.js');
const db = require('../../utils/db');
const { getLevelFromXP, getXPProgress, getRankTier, xpBar, getJobPayMultiplier } = require('../../utils/xp');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('rank')
        .setDescription("Check your (or another user's) global XP rank.")
        .addUserOption(opt =>
            opt.setName('user')
                .setDescription('User to check (defaults to yourself)')
                .setRequired(false)),

    async execute(interaction) {
        const target = interaction.options.getUser('user') || interaction.user;

        if (target.bot) {
            return interaction.editReply({ content: 'Bots have no rank.', ephemeral: true });
        }

        try {
            const profile = await db.getUser(target.id);
            const totalXP  = profile.xp || 0;
            const level    = getLevelFromXP(totalXP);
            const tier     = getRankTier(level);
            const progress = getXPProgress(totalXP, level);
            const jobMult  = getJobPayMultiplier(level);
            const pct      = progress.pct;

            const bar = xpBar(pct, 14);
            const nextInfo = level >= 9999
                ? 'MAX LEVEL'
                : `${progress.current.toLocaleString()} / ${progress.needed.toLocaleString()} XP`;

            const container = new ContainerBuilder()
                .addSectionComponents(
                    new SectionBuilder()
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent(
                                `## ${target.username} - Level ${level}\n${tier.name}`
                            )
                        )
                        .setThumbnailAccessory(new ThumbnailBuilder().setURL(target.displayAvatarURL({ forceStatic: true })))
                )
                .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        `**XP Progress to Level ${level + 1}**\n` +
                        `\`[${bar}]\` ${Math.round(pct * 100)}%\n` +
                        `${nextInfo}\n\n` +
                        `**Total XP:** ${totalXP.toLocaleString()}\n` +
                        `**Job Pay Bonus:** +${((jobMult - 1) * 100).toFixed(0)}% from level`
                    )
                );

            await interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [container] });

        } catch (err) {
            console.error('[RANK ERROR]', err);
            const msg = { content: 'Failed to fetch rank.', ephemeral: true };
            if (interaction.replied || interaction.deferred) await interaction.followUp(msg).catch(() => null);
            else await interaction.editReply(msg).catch(() => null);
        }
    }
};
