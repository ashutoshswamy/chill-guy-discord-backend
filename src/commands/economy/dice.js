const {
    SlashCommandBuilder,
    ContainerBuilder, SectionBuilder, TextDisplayBuilder, ThumbnailBuilder,
    SeparatorBuilder, SeparatorSpacingSize, MessageFlags,
    ActionRowBuilder, ButtonBuilder, ButtonStyle
} = require('discord.js');
const db = require('../../utils/db');
const { XP_REWARDS } = require('../../utils/xp');
const { getEmoji } = require('../../utils/emojis');

const coin = getEmoji('coin');

const DICE_EMOJIS = {
    1: '⚀',
    2: '⚁',
    3: '⚂',
    4: '⚃',
    5: '⚄',
    6: '⚅'
};

const BET_LABELS = {
    'under7': 'Under 7 (2x)',
    'over7': 'Over 7 (2x)',
    'seven': 'Exactly 7 (5x)',
    'even': 'Even Sum (2x)',
    'odd': 'Odd Sum (2x)',
    'double': 'Doubles (6x)'
};

function getRollResult(d1, d2, betType) {
    const sum = d1 + d2;
    const isDouble = d1 === d2;

    switch (betType) {
        case 'under7':
            return { won: sum < 7, multiplier: 2, condition: 'Sum < 7' };
        case 'over7':
            return { won: sum > 7, multiplier: 2, condition: 'Sum > 7' };
        case 'seven':
            return { won: sum === 7, multiplier: 5, condition: 'Sum = 7' };
        case 'even':
            return { won: sum % 2 === 0, multiplier: 2, condition: 'Sum is Even' };
        case 'odd':
            return { won: sum % 2 !== 0, multiplier: 2, condition: 'Sum is Odd' };
        case 'double':
            return { won: isDouble, multiplier: 6, condition: 'Dice are Doubles' };
        default:
            return { won: false, multiplier: 0, condition: '' };
    }
}

const sleep = ms => new Promise(res => setTimeout(res, ms));

function buildDiceContainer(user, betAmount, d1, d2, betType, result, wallet, isRolling = false, isDisabled = false) {
    const title = isRolling ? 'Rolling Dice...' : result.won ? 'Winner!' : 'No luck!';
    
    let contentStr = '';
    if (isRolling) {
        contentStr = `**Rolling the dice...**\n\n` +
            `**Bet Type:** ${BET_LABELS[betType]}\n` +
            `**Bet Amount:** ${coin} ${betAmount.toLocaleString()} coins`;
    } else {
        const sum = d1 + d2;
        const diceDisplay = `[ ${DICE_EMOJIS[d1]} ] [ ${DICE_EMOJIS[d2]} ]  (Total: **${sum}**)`;
        
        contentStr = `${diceDisplay}\n\n` +
            `**Bet Type:** ${BET_LABELS[betType]} (Target: ${result.condition})\n` +
            `**Bet Amount:** ${coin} ${betAmount.toLocaleString()} coins\n` +
            `${result.won ? `**Won:** ${coin} +${(betAmount * (result.multiplier - 1)).toLocaleString()} coins (${result.multiplier}x)` : `**Lost:** ${coin} -${betAmount.toLocaleString()} coins`}\n` +
            `**Wallet:** ${coin} ${wallet.toLocaleString()} coins`;
    }

    const container = new ContainerBuilder()
        .addSectionComponents(
            new SectionBuilder()
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(`## Dice Duel - ${title}`)
                )
                .setThumbnailAccessory(new ThumbnailBuilder().setURL(user.displayAvatarURL({ forceStatic: true })))
        )
        .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(contentStr)
        );

    // Keep Roll Again button disabled when rolling or disabled on timeout
    container.addActionRowComponents(
        new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('dice_roll_again')
                .setLabel('Roll Again')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(isRolling || isDisabled)
        )
    );

    return {
        flags: MessageFlags.IsComponentsV2,
        components: [container]
    };
}

module.exports = {
    cooldown: 5,
    data: new SlashCommandBuilder()
        .setName('dice')
        .setDescription('Roll a pair of dice. Bet on Under/Over 7, Even/Odd, Exactly 7, or Doubles.')
        .addIntegerOption(opt =>
            opt.setName('amount')
                .setDescription('Amount to bet from your wallet')
                .setMinValue(10)
                .setRequired(true))
        .addStringOption(opt =>
            opt.setName('bet')
                .setDescription('Choose what to bet on')
                .setRequired(true)
                .addChoices(
                    { name: 'Under 7 (2x payout)', value: 'under7' },
                    { name: 'Over 7 (2x payout)', value: 'over7' },
                    { name: 'Exactly 7 (5x payout)', value: 'seven' },
                    { name: 'Even Sum (2x payout)', value: 'even' },
                    { name: 'Odd Sum (2x payout)', value: 'odd' },
                    { name: 'Doubles (6x payout)', value: 'double' }
                )),

    async execute(interaction) {
        const { user } = interaction;
        const amount = interaction.options.getInteger('amount');
        const betType = interaction.options.getString('bet');

        let lastState = {
            d1: 1, d2: 1,
            won: false, multiplier: 0, condition: '',
            wallet: 0
        };

        const playDice = async (activeInteraction, isButton, buttonInteraction) => {
            const profile = await db.getUser(user.id);
            if (profile.wallet < amount) {
                const msg = { content: `Not enough coins. You have ${coin} **${profile.wallet.toLocaleString()}** in wallet.`, ephemeral: true };
                if (isButton) {
                    await buttonInteraction.reply(msg);
                } else {
                    await activeInteraction.editReply(msg);
                }
                return null;
            }

            // Perform transaction/roll
            const d1 = Math.floor(Math.random() * 6) + 1;
            const d2 = Math.floor(Math.random() * 6) + 1;
            const result = getRollResult(d1, d2, betType);
            const net = result.won ? amount * (result.multiplier - 1) : -amount;

            await db.updateWallet(user.id, net);
            if (result.won) db.addXP(user.id, XP_REWARDS.gamblingWin).catch(() => null);
            const updated = await db.getUser(user.id);

            lastState = {
                d1, d2,
                won: result.won,
                multiplier: result.multiplier,
                condition: result.condition,
                wallet: updated.wallet
            };

            let acknowledged = false;
            const updateMessage = async (payload) => {
                if (isButton) {
                    if (!acknowledged) {
                        acknowledged = true;
                        await buttonInteraction.update(payload);
                    } else {
                        await buttonInteraction.editReply(payload);
                    }
                } else {
                    await activeInteraction.editReply(payload);
                }
            };

            // Frame 1: Rolling
            let payload = buildDiceContainer(user, amount, null, null, betType, null, null, true);
            await updateMessage(payload);
            await sleep(800);

            // Frame 2: Final roll result
            payload = buildDiceContainer(user, amount, d1, d2, betType, result, updated.wallet, false);
            await updateMessage(payload);

            return isButton ? buttonInteraction.message : await activeInteraction.fetchReply();
        };

        let currentCollector = null;

        const setupCollector = (message) => {
            if (currentCollector) {
                currentCollector.stop('user');
            }

            currentCollector = message.createMessageComponentCollector({
                filter: i => i.user.id === user.id && i.customId === 'dice_roll_again',
                time: 60_000
            });

            currentCollector.on('collect', async i => {
                try {
                    const nextMessage = await playDice(interaction, true, i);
                    if (nextMessage) {
                        setupCollector(nextMessage);
                    }
                } catch (err) {
                    console.error('[DICE COLLECT ERROR]', err);
                }
            });

            currentCollector.on('end', async (collected, reason) => {
                if (reason === 'user') return;
                try {
                    const result = { won: lastState.won, multiplier: lastState.multiplier, condition: lastState.condition };
                    const payload = buildDiceContainer(user, amount, lastState.d1, lastState.d2, betType, result, lastState.wallet, false, true);
                    await interaction.editReply(payload).catch(() => null);
                } catch (err) {
                    // Ignore
                }
            });
        };

        try {
            const message = await playDice(interaction, false, null);
            if (message) {
                setupCollector(message);
            }
        } catch (err) {
            console.error('[DICE ERROR]', err);
            const msg = { content: 'Something went wrong with the dice game.', ephemeral: true };
            if (interaction.replied || interaction.deferred) await interaction.followUp(msg).catch(() => null);
            else await interaction.editReply(msg).catch(() => null);
        }
    }
};
