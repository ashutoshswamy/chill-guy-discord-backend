const {
    SlashCommandBuilder,
    ContainerBuilder, SectionBuilder, TextDisplayBuilder, ThumbnailBuilder,
    SeparatorBuilder, SeparatorSpacingSize, MessageFlags
} = require('discord.js');
const db = require('../../utils/db');
const { getEmoji } = require('../../utils/emojis');

const coin = getEmoji('coin');
const xp   = getEmoji('xp');

function buildProgressBar(progress, target, length = 10) {
    const fill = Math.min(length, Math.round((progress / target) * length));
    const empty = length - fill;
    return `\`${'█'.repeat(fill)}${'░'.repeat(empty)}\` ${progress}/${target}`;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('quest')
        .setDescription('View your daily quests and rewards.'),

    async execute(interaction) {
        const { user } = interaction;

        try {
            const activeQuests = await db.getActiveQuests(user.id);

            const container = new ContainerBuilder()
                .addSectionComponents(
                    new SectionBuilder()
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent(
                                `## Daily Quests — ${user.displayName}\n` +
                                `Complete daily tasks to automatically earn bonus coins and XP!`
                            )
                        )
                        .setThumbnailAccessory(new ThumbnailBuilder().setURL(user.displayAvatarURL({ forceStatic: true })))
                )
                .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));

            let body = '';
            for (const q of activeQuests) {
                const status = q.completed ? '**Completed**' : '**In Progress**';
                const progressLine = buildProgressBar(q.progress, q.target);
                
                body += `### ${q.description}\n` +
                        `· Status: ${status}\n` +
                        `· Progress: ${progressLine}\n` +
                        `· Reward: ${coin} **${q.reward_coins}** coins · ${xp} **${q.reward_xp}** XP\n\n`;
            }

            // Calculate hours until daily reset
            const expires = new Date(activeQuests[0].expires_at);
            const remaining = expires.getTime() - Date.now();
            const hours = Math.floor(remaining / 3600000);
            const minutes = Math.floor((remaining % 3600000) / 60000);

            body += `-# Quests reset in **${hours}h ${minutes}m**.`;

            container.addTextDisplayComponents(new TextDisplayBuilder().setContent(body.trim()));

            await interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [container] });

        } catch (err) {
            console.error('[QUESTS ERROR]', err);
            const msg = { content: 'Failed to load daily quests.', ephemeral: true };
            if (interaction.replied || interaction.deferred) await interaction.followUp(msg).catch(() => null);
            else await interaction.editReply(msg).catch(() => null);
        }
    }
};
