const {
    SlashCommandBuilder,
    ContainerBuilder, SectionBuilder, TextDisplayBuilder, ThumbnailBuilder,
    SeparatorBuilder, SeparatorSpacingSize, ActionRowBuilder, ButtonBuilder,
    ButtonStyle, MessageFlags
} = require('discord.js');
const db = require('../../utils/db');
const { XP_REWARDS } = require('../../utils/xp');
const { getEmoji } = require('../../utils/emojis');

const coin = getEmoji('coin');
const BOT_ID = '1516531192353263738';
const VOTE_URL = `https://top.gg/bot/${BOT_ID}/vote`;
const COOLDOWN_MS = 12 * 60 * 60 * 1000;
const MIN = 1500;
const MAX = 2500;
const VOTE_XP = 75;

function formatRemaining(ms) {
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    return `${h}h ${m}m`;
}

async function checkVoted(userId) {
    const token = process.env.TOPGG_TOKEN;
    if (!token) return null; // can't verify

    const res = await fetch(
        `https://top.gg/api/bots/${BOT_ID}/check?userId=${userId}`,
        { headers: { Authorization: token } }
    );
    if (!res.ok) return null;
    const json = await res.json();
    return json.voted === 1;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('vote-reward')
        .setDescription('Claim your reward after voting for Chill Guy on top.gg.'),

    async execute(interaction) {
        const { user } = interaction;

        try {
            const voted = await checkVoted(user.id);

            if (voted === false) {
                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setLabel('Vote on top.gg')
                        .setURL(VOTE_URL)
                        .setStyle(ButtonStyle.Link)
                );
                return interaction.editReply({
                    content: `You haven't voted yet! Vote on top.gg first, then come back to claim your reward.`,
                    components: [row],
                    ephemeral: true,
                });
            }

            // voted === null means no token configured — skip verification, use cooldown as gate
            const cooldown = await db.checkAndSetCooldown(user.id, 'vote_reward', COOLDOWN_MS);

            if (cooldown.onCooldown) {
                return interaction.editReply({
                    content: `Already claimed your vote reward! Come back in **${formatRemaining(cooldown.remaining)}**.`,
                    ephemeral: true,
                });
            }

            const payout = Math.floor(Math.random() * (MAX - MIN + 1)) + MIN;
            const userData = await db.updateWallet(user.id, payout);
            db.addXP(user.id, VOTE_XP).catch(() => null);

            const container = new ContainerBuilder()
                .addSectionComponents(
                    new SectionBuilder()
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent(
                                `## Vote Reward Claimed!\n${coin} **${payout.toLocaleString()}** coins + ✨ **${VOTE_XP} XP** added!`
                            )
                        )
                        .setThumbnailAccessory(new ThumbnailBuilder().setURL(user.displayAvatarURL({ forceStatic: true })))
                )
                .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        `**Wallet:** ${coin} **${userData.wallet.toLocaleString()}** coins\n` +
                        `-# Vote again in 12 hours for another reward!`
                    )
                );

            await interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [container] });

        } catch (err) {
            console.error('[VOTE-REWARD ERROR]', err);
            const msg = { content: 'Failed to claim vote reward.', ephemeral: true };
            if (interaction.replied || interaction.deferred) await interaction.followUp(msg).catch(() => null);
            else await interaction.editReply(msg).catch(() => null);
        }
    },
};
