const {
    SlashCommandBuilder,
    ContainerBuilder, SectionBuilder, TextDisplayBuilder, ThumbnailBuilder,
    SeparatorBuilder, SeparatorSpacingSize, MessageFlags
} = require('discord.js');
const db = require('../../utils/db');
const { checkCooldown } = require('../../utils/cooldowns');
const { XP_REWARDS } = require('../../utils/xp');
const { getEmoji } = require('../../utils/emojis');

const coin = getEmoji('coin');

const REELS = ['Cherry', 'Lemon', 'Orange', 'Bell', 'Star', 'Diamond', 'Seven'];
const WEIGHTS = [30, 25, 20, 12, 7, 4, 2]; // out of 100

function spin() {
    const total = WEIGHTS.reduce((a, b) => a + b, 0);
    let r = Math.random() * total;
    for (let i = 0; i < REELS.length; i++) {
        r -= WEIGHTS[i];
        if (r <= 0) return REELS[i];
    }
    return REELS[0];
}

function getMultiplier(s1, s2, s3) {
    if (s1 === s2 && s2 === s3) {
        if (s1 === 'Seven')   return { mult: 50, label: 'JACKPOT! Triple Sevens!' };
        if (s1 === 'Diamond') return { mult: 20, label: 'Triple Diamonds!' };
        if (s1 === 'Star')    return { mult: 10, label: 'Triple Stars!' };
        if (s1 === 'Bell')    return { mult: 5,  label: 'Triple Bells!' };
        return { mult: 3, label: 'Three of a Kind!' };
    }
    if (s1 === s2 || s2 === s3 || s1 === s3) {
        return { mult: 1.5, label: 'Two of a Kind' };
    }
    if ([s1, s2, s3].includes('Seven')) {
        return { mult: 0.5, label: 'Lucky Seven bonus' };
    }
    return { mult: 0, label: 'No match' };
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('slots')
        .setDescription('Spin the slot machine. Match symbols to win big.')
        .addIntegerOption(opt =>
            opt.setName('amount')
                .setDescription('Amount to bet from your wallet')
                .setMinValue(10)
                .setRequired(true)),

    async execute(interaction) {
        const { user } = interaction;
        const amount = interaction.options.getInteger('amount');

        const cd = checkCooldown('slots', user.id, 15);
        if (cd.onCooldown) {
            return interaction.editReply({ content: `Slot machine cooling down. Wait **${cd.remaining}s**.`, ephemeral: true });
        }

        try {
            const profile = await db.getUser(user.id);
            if (profile.wallet < amount) {
                return interaction.editReply({ content: `Not enough coins. You have ${coin} **${profile.wallet.toLocaleString()}** in wallet.`, ephemeral: true });
            }

            const s1 = spin(), s2 = spin(), s3 = spin();
            const { mult, label } = getMultiplier(s1, s2, s3);
            const payout = Math.floor(amount * mult);
            const net = payout - amount;

            await db.updateWallet(user.id, net);
            if (net > 0) db.addXP(user.id, XP_REWARDS.gamblingWin).catch(() => null);
            const updated = await db.getUser(user.id);

            const won = net > 0;
            const broke = net === 0 && mult === 1.5;
            const resultLabel = mult >= 3 ? 'Slot Machine' : won ? 'Slot Machine' : mult > 0 ? 'Slot Machine' : 'Slot Machine';

            const container = new ContainerBuilder()
                .addSectionComponents(
                    new SectionBuilder()
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent(
                                `## Slot Machine`
                            )
                        )
                        .setThumbnailAccessory(new ThumbnailBuilder().setURL(user.displayAvatarURL({ forceStatic: true })))
                )
                .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        `┌─────────────────┐\n` +
                        `│  ${s1}  ${s2}  ${s3}  │\n` +
                        `└─────────────────┘\n\n` +
                        `${label}\n\n` +
                        `**Bet:** ${coin} ${amount.toLocaleString()} coins\n` +
                        `${net > 0 ? `**Won:** ${coin} +${net.toLocaleString()} coins (${mult}x)` :
                          net === 0 && mult > 0 ? `**Break Even:** +/-0 coins (${mult}x)` :
                          `**Lost:** ${coin} -${amount.toLocaleString()} coins`}\n` +
                        `**Wallet:** ${coin} ${updated.wallet.toLocaleString()} coins`
                    )
                );

            await interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [container] });
        } catch (err) {
            console.error('[SLOTS ERROR]', err);
            const msg = { content: 'Slot machine broke.', ephemeral: true };
            if (interaction.replied || interaction.deferred) await interaction.followUp(msg).catch(() => null);
            else await interaction.editReply(msg).catch(() => null);
        }
    }
};
