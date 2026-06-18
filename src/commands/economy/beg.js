const {
    SlashCommandBuilder,
    ContainerBuilder, SectionBuilder, TextDisplayBuilder, ThumbnailBuilder,
    SeparatorBuilder, SeparatorSpacingSize, MessageFlags
} = require('discord.js');
const db = require('../../utils/db');
const { XP_REWARDS } = require('../../utils/xp');
const { getEmoji } = require('../../utils/emojis');

const coin = getEmoji('coin');

const BEG_RESPONSES = [
    'A kind stranger tossed you **{amount}** coins.',
    'You rattled a cup outside a café and collected **{amount}** coins.',
    'Someone felt bad for you and handed over **{amount}** coins.',
    'An old man thought you were a street performer and tipped **{amount}** coins.',
    'You found **{amount}** coins under a park bench. Nobody saw.',
    'A rich streamer walked by and dropped **{amount}** coins on your head.',
    'You held a sign that said "will chill for coins" and earned **{amount}** coins.',
];

const JUNK_ITEMS = ['Old Boot', 'Junk Seaweed', 'Common Worm'];

module.exports = {
    cooldown: 45,
    data: new SlashCommandBuilder()
        .setName('beg')
        .setDescription('Beg for spare change. Small payouts, 45s cooldown.'),

    async execute(interaction) {
        const { user } = interaction;

        try {
            const payout = Math.floor(Math.random() * 101) + 20;
            await db.updateWallet(user.id, payout);
            db.addXP(user.id, XP_REWARDS.beg).catch(() => null);

            let itemAwarded = null;
            if (Math.random() < 0.15) {
                itemAwarded = JUNK_ITEMS[Math.floor(Math.random() * JUNK_ITEMS.length)];
                await db.addItem(user.id, itemAwarded);
            }

            const text = BEG_RESPONSES[Math.floor(Math.random() * BEG_RESPONSES.length)]
                .replace('{amount}', `${coin} ${payout.toLocaleString()}`);

            let details = `**Coins Pocketed:** ${coin} **+${payout.toLocaleString()}** coins`;
            if (itemAwarded) details += `\n**Bonus Item:** **${itemAwarded}** added to inventory`;

            const container = new ContainerBuilder()
                .addSectionComponents(
                    new SectionBuilder()
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent(`## Begging\n${text}`)
                        )
                        .setThumbnailAccessory(new ThumbnailBuilder().setURL(user.displayAvatarURL({ forceStatic: true })))
                )
                .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
                .addTextDisplayComponents(new TextDisplayBuilder().setContent(details));

            await interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [container] });

        } catch (err) {
            console.error('[BEG ERROR]', err);
            const msg = { content: 'Failed to collect coins.', ephemeral: true };
            if (interaction.replied || interaction.deferred) await interaction.followUp(msg).catch(() => null);
            else await interaction.editReply(msg).catch(() => null);
        }
    }
};
