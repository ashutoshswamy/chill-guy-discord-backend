const {
    SlashCommandBuilder,
    ContainerBuilder, SectionBuilder, TextDisplayBuilder, ThumbnailBuilder,
    SeparatorBuilder, SeparatorSpacingSize, MessageFlags
} = require('discord.js');
const db = require('../../utils/db');
const { XP_REWARDS } = require('../../utils/xp');
const { getEmoji } = require('../../utils/emojis');

const coin = getEmoji('coin');

const RED_NUMS = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];
const BLACK_NUMS = [2,4,6,8,10,11,13,15,17,20,22,24,26,28,29,31,33,35];

function numColor(n) {
    if (n === 0) return 'green';
    if (RED_NUMS.includes(n)) return 'red';
    return 'black';
}

function colorEmoji(color) {
    if (color === 'red') return 'Red';
    if (color === 'black') return 'Black';
    return 'Green';
}

const COOLDOWN_MS = 5 * 1000;

module.exports = {
    data: new SlashCommandBuilder()
        .setName('roulette')
        .setDescription('Spin the roulette wheel. Red/Black (2x), Green (14x), Number 0-36 (36x).')
        .addIntegerOption(opt =>
            opt.setName('amount')
                .setDescription('Amount to bet from your wallet')
                .setMinValue(10)
                .setRequired(true))
        .addStringOption(opt =>
            opt.setName('bet')
                .setDescription('red, black, green, or a number 0-36')
                .setRequired(true)),

    async execute(interaction) {
        const { user } = interaction;
        const amount = interaction.options.getInteger('amount');
        const betInput = interaction.options.getString('bet').toLowerCase().trim();

        let betType = null;
        let betNumber = null;

        if (betInput === 'red' || betInput === 'black' || betInput === 'green') {
            betType = betInput;
        } else {
            const n = parseInt(betInput);
            if (isNaN(n) || n < 0 || n > 36) {
                return interaction.editReply({ content: 'Invalid bet. Use `red`, `black`, `green`, or a number `0`–`36`.', ephemeral: true });
            }
            betType = 'number';
            betNumber = n;
        }

        const cd = await db.checkAndSetCooldown(user.id, 'roulette', COOLDOWN_MS);
        if (cd.onCooldown) {
            const s = Math.ceil(cd.remaining / 1000);
            return interaction.editReply({ content: `On cooldown! Try again in **${s}s**.`, ephemeral: true });
        }

        try {
            const profile = await db.getUser(user.id);
            if (profile.wallet < amount) {
                return interaction.editReply({ content: `Not enough coins. You have ${coin} **${profile.wallet.toLocaleString()}** in wallet.`, ephemeral: true });
            }

            const result = Math.floor(Math.random() * 37); // 0-36
            const resultColor = numColor(result);
            const resultEmoji = colorEmoji(resultColor);

            let won = false;
            let multiplier = 0;

            if (betType === 'number' && betNumber === result) {
                won = true;
                multiplier = 36;
            } else if (betType === 'red' && resultColor === 'red') {
                won = true;
                multiplier = 2;
            } else if (betType === 'black' && resultColor === 'black') {
                won = true;
                multiplier = 2;
            } else if (betType === 'green' && resultColor === 'green') {
                won = true;
                multiplier = 14;
            }

            const net = won ? amount * (multiplier - 1) : -amount;
            await db.updateWallet(user.id, net);
            if (won) db.addXP(user.id, XP_REWARDS.gamblingWin).catch(() => null);
            const updated = await db.getUser(user.id);

            const betDisplay = betType === 'number' ? `Number **${betNumber}**` : betType.charAt(0).toUpperCase() + betType.slice(1);

            const container = new ContainerBuilder()
                .addSectionComponents(
                    new SectionBuilder()
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent(
                                `## Roulette - ${won ? 'Winner!' : 'No luck!'}`
                            )
                        )
                        .setThumbnailAccessory(new ThumbnailBuilder().setURL(user.displayAvatarURL({ forceStatic: true })))
                )
                .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        `**Result:** ${resultEmoji} **${result}** (${resultColor})\n` +
                        `**Your Bet:** ${betDisplay}\n` +
                        `**Bet Amount:** ${coin} ${amount.toLocaleString()} coins\n` +
                        `${won ? `**Won:** ${coin} +${(amount * (multiplier - 1)).toLocaleString()} coins (${multiplier}x)` : `**Lost:** ${coin} -${amount.toLocaleString()} coins`}\n` +
                        `**Wallet:** ${coin} ${updated.wallet.toLocaleString()} coins`
                    )
                );

            await interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [container] });
        } catch (err) {
            console.error('[ROULETTE ERROR]', err);
            const msg = { content: 'Roulette wheel broke.', ephemeral: true };
            if (interaction.replied || interaction.deferred) await interaction.followUp(msg).catch(() => null);
            else await interaction.editReply(msg).catch(() => null);
        }
    }
};
