const {
    SlashCommandBuilder,
    ContainerBuilder, SectionBuilder, TextDisplayBuilder, ThumbnailBuilder,
    SeparatorBuilder, SeparatorSpacingSize, MessageFlags
} = require('discord.js');
const db = require('../../utils/db');
const { XP_REWARDS } = require('../../utils/xp');
const { getEmoji } = require('../../utils/emojis');

const coin = getEmoji('coin');

const COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;
const MIN = 5000;
const MAX = 8000;

function formatRemaining(ms) {
    const d = Math.floor(ms / 86400000);
    const h = Math.floor((ms % 86400000) / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    return `${d}d ${h}h ${m}m`;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('weekly')
        .setDescription('Claim your weekly coin reward. Resets every 7 days.'),

    async execute(interaction) {
        const { user } = interaction;
        const payout = Math.floor(Math.random() * (MAX - MIN + 1)) + MIN;

        try {
            const result = await db.claimReward(user.id, 'weekly', COOLDOWN_MS, payout);

            if (result.onCooldown) {
                return interaction.editReply({
                    content: `Already claimed your weekly! Come back in **${formatRemaining(result.remaining)}**.`,
                    ephemeral: true
                });
            }

            db.addXP(user.id, XP_REWARDS.weekly).catch(() => null);

            const container = new ContainerBuilder()
                .addSectionComponents(
                    new SectionBuilder()
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent(
                                `## Weekly Reward\n${coin} **${result.payout.toLocaleString()}** coins added to your wallet!`
                            )
                        )
                        .setThumbnailAccessory(new ThumbnailBuilder().setURL(user.displayAvatarURL({ forceStatic: true })))
                )
                .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        `**Wallet:** ${coin} **${result.data.wallet.toLocaleString()}** coins\n` +
                        `-# Come back in 7 days for your next weekly!`
                    )
                );

            await interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [container] });

        } catch (err) {
            console.error('[WEEKLY ERROR]', err);
            const msg = { content: 'Failed to claim weekly reward.', ephemeral: true };
            if (interaction.replied || interaction.deferred) await interaction.followUp(msg).catch(() => null);
            else await interaction.editReply(msg).catch(() => null);
        }
    }
};
