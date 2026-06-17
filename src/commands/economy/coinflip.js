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

module.exports = {
    data: new SlashCommandBuilder()
        .setName('coinflip')
        .setDescription('Bet on heads or tails. 50/50 odds, 2x payout.')
        .addIntegerOption(opt =>
            opt.setName('amount')
                .setDescription('Amount to bet from your wallet')
                .setMinValue(10)
                .setRequired(true))
        .addStringOption(opt =>
            opt.setName('choice')
                .setDescription('Heads or tails?')
                .setRequired(true)
                .addChoices(
                    { name: 'Heads', value: 'heads' },
                    { name: 'Tails', value: 'tails' }
                )),

    async execute(interaction) {
        const { user } = interaction;
        const amount = interaction.options.getInteger('amount');
        const choice = interaction.options.getString('choice');

        const cd = checkCooldown('coinflip', user.id, 10);
        if (cd.onCooldown) {
            return interaction.editReply({ content: `Chill. Wait **${cd.remaining}s** before flipping again.`, ephemeral: true });
        }

        try {
            const profile = await db.getUser(user.id);
            if (profile.wallet < amount) {
                return interaction.editReply({ content: `Not enough coins. You have ${coin} **${profile.wallet.toLocaleString()}** in wallet.`, ephemeral: true });
            }

            const result = Math.random() < 0.5 ? 'heads' : 'tails';
            const won = result === choice;
            await db.updateWallet(user.id, won ? amount : -amount);
            if (won) db.addXP(user.id, XP_REWARDS.gamblingWin).catch(() => null);
            const updated = await db.getUser(user.id);

            const container = new ContainerBuilder()
                .addSectionComponents(
                    new SectionBuilder()
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent(
                                `## Coin Flip - ${won ? 'You Won!' : 'You Lost!'}`
                            )
                        )
                        .setThumbnailAccessory(new ThumbnailBuilder().setURL(user.displayAvatarURL({ forceStatic: true })))
                )
                .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        `**Result:** ${result.charAt(0).toUpperCase() + result.slice(1)}\n` +
                        `**Your Pick:** ${choice.charAt(0).toUpperCase() + choice.slice(1)}\n` +
                        `${won ? `**Won:** ${coin} **+${amount.toLocaleString()}** coins` : `**Lost:** ${coin} **-${amount.toLocaleString()}** coins`}\n` +
                        `**Wallet:** ${coin} **${updated.wallet.toLocaleString()}** coins`
                    )
                );

            await interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [container] });
        } catch (err) {
            console.error('[COINFLIP ERROR]', err);
            const msg = { content: 'Coin flip failed.', ephemeral: true };
            if (interaction.replied || interaction.deferred) await interaction.followUp(msg).catch(() => null);
            else await interaction.editReply(msg).catch(() => null);
        }
    }
};
