const {
    SlashCommandBuilder,
    ActionRowBuilder, ButtonBuilder, ButtonStyle,
    ContainerBuilder, TextDisplayBuilder, MessageFlags
} = require('discord.js');
const db = require('../../utils/db');
const { getEmoji } = require('../../utils/emojis');

const coin = getEmoji('coin');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('resetprofile')
        .setDescription('Wipe your entire profile and start fresh. This cannot be undone.'),

    async execute(interaction) {
        const userId = interaction.user.id;

        const container = new ContainerBuilder()
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `## Reset Profile\n` +
                    `**This will permanently delete:**\n` +
                    `- All coins (wallet + bank)\n` +
                    `- All XP and levels\n` +
                    `- Entire inventory\n` +
                    `- All pets\n` +
                    `- Job progress\n` +
                    `- Stock holdings\n` +
                    `- Streaks and cooldowns\n\n` +
                    `You will start with ${coin} **1,000** coins. **This cannot be undone.**`
                )
            )
            .addActionRowComponents(
                new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId('reset_confirm')
                        .setLabel('Yes, reset everything')
                        .setStyle(ButtonStyle.Danger),
                    new ButtonBuilder()
                        .setCustomId('reset_cancel')
                        .setLabel('Cancel')
                        .setStyle(ButtonStyle.Secondary)
                )
            );

        const response = await interaction.editReply({
            flags: MessageFlags.IsComponentsV2,
            components: [container]
        });

        const collector = response.createMessageComponentCollector({
            filter: i => i.user.id === userId && (i.customId === 'reset_confirm' || i.customId === 'reset_cancel'),
            max: 1,
            time: 30_000
        });

        collector.on('collect', async i => {
            await i.deferUpdate();

            if (i.customId === 'reset_cancel') {
                const cancelled = new ContainerBuilder().addTextDisplayComponents(
                    new TextDisplayBuilder().setContent('Reset cancelled.')
                );
                await interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [cancelled] });
                return;
            }

            // Wipe all user data
            const { supabase } = db;
            await Promise.all([
                supabase.from('inventory').delete().eq('user_id', userId),
                supabase.from('user_pets').delete().eq('user_id', userId),
                supabase.from('user_jobs').delete().eq('user_id', userId),
                supabase.from('user_stocks').delete().eq('user_id', userId),
                supabase.from('user_cooldowns').delete().eq('user_id', userId),
                supabase.from('user_streaks').delete().eq('user_id', userId),
                supabase.from('user_quests').delete().eq('user_id', userId),
                supabase.from('lottery_tickets').delete().eq('user_id', userId),
            ]);

            // Reset user row to defaults
            await supabase
                .from('users')
                .update({
                    wallet:             1000,
                    bank:               0,
                    total_earned:       1000,
                    xp:                 0,
                    level:              1,
                    daily_claimed_at:   null,
                    weekly_claimed_at:  null,
                    monthly_claimed_at: null,
                })
                .eq('user_id', userId);

            // Clear in-memory cooldowns
            const { cooldowns } = require('../../utils/cooldowns');
            for (const userMap of cooldowns.values()) userMap.delete(userId);

            const done = new ContainerBuilder().addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `Profile reset. You have ${coin} **1,000** coins. Good luck!`
                )
            );
            await interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [done] });
        });

        collector.on('end', async (collected) => {
            if (collected.size === 0) {
                const timedOut = new ContainerBuilder().addTextDisplayComponents(
                    new TextDisplayBuilder().setContent('Reset timed out. No changes made.')
                );
                await interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [timedOut] }).catch(() => null);
            }
        });
    },
};
