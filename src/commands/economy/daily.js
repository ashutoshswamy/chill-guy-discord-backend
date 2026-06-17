const {
    SlashCommandBuilder,
    ContainerBuilder, SectionBuilder, TextDisplayBuilder, ThumbnailBuilder,
    SeparatorBuilder, SeparatorSpacingSize, MessageFlags
} = require('discord.js');
const db = require('../../utils/db');
const { XP_REWARDS } = require('../../utils/xp');
const { getEmoji } = require('../../utils/emojis');

const coin = getEmoji('coin');

const COOLDOWN_MS = 24 * 60 * 60 * 1000;
const MIN = 500;
const MAX = 1000;

function formatRemaining(ms) {
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    return `${h}h ${m}m ${s}s`;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('daily')
        .setDescription('Claim your daily coin reward. Resets every 24 hours.'),

    async execute(interaction) {
        const { user } = interaction;
        const payout = Math.floor(Math.random() * (MAX - MIN + 1)) + MIN;

        try {
            const result = await db.claimReward(user.id, 'daily', COOLDOWN_MS, payout);

            if (result.onCooldown) {
                return interaction.editReply({
                    content: `Already claimed your daily! Come back in **${formatRemaining(result.remaining)}**.`,
                    ephemeral: true
                });
            }

            db.addXP(user.id, XP_REWARDS.daily).catch(() => null);

            const container = new ContainerBuilder()
                .addSectionComponents(
                    new SectionBuilder()
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent(
                                `## Daily Reward\n${coin} **${result.payout.toLocaleString()}** coins added to your wallet!`
                            )
                        )
                        .setThumbnailAccessory(new ThumbnailBuilder().setURL(user.displayAvatarURL({ forceStatic: true })))
                )
                .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        `**Wallet:** ${coin} **${result.data.wallet.toLocaleString()}** coins\n` +
                        `-# Come back in 24 hours for your next daily!`
                    )
                );

            await interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [container] });

        } catch (err) {
            console.error('[DAILY ERROR]', err);
            const msg = { content: 'Failed to claim daily reward.', ephemeral: true };
            if (interaction.replied || interaction.deferred) await interaction.followUp(msg).catch(() => null);
            else await interaction.editReply(msg).catch(() => null);
        }
    }
};
