const {
    SlashCommandBuilder,
    ContainerBuilder, SectionBuilder, TextDisplayBuilder, ThumbnailBuilder,
    SeparatorBuilder, SeparatorSpacingSize, MessageFlags,
    ActionRowBuilder, ButtonBuilder, ButtonStyle
} = require('discord.js');
const db = require('../../utils/db');
const { checkCooldown } = require('../../utils/cooldowns');
const { XP_REWARDS } = require('../../utils/xp');
const { getEmoji } = require('../../utils/emojis');

const coin = getEmoji('coin');

const REELS = ['Cherry', 'Lemon', 'Orange', 'Bell', 'Star', 'Diamond', 'Seven'];
const SLOT_EMOJIS = {
    'Cherry': '🍒',
    'Lemon': '🍋',
    'Orange': '🍊',
    'Bell': '🔔',
    'Star': '⭐',
    'Diamond': '💎',
    'Seven': '7️⃣'
};
const WEIGHTS = [30, 25, 20, 12, 7, 4, 2]; // out of 100

// Generate weighted strips for physical reel simulation
const baseStrip = [];
for (let i = 0; i < REELS.length; i++) {
    const symbol = REELS[i];
    const weight = WEIGHTS[i];
    for (let w = 0; w < weight; w++) {
        baseStrip.push(symbol);
    }
}

function getShuffledStrip() {
    const arr = [...baseStrip];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

const STRIP1 = getShuffledStrip();
const STRIP2 = getShuffledStrip();
const STRIP3 = getShuffledStrip();

function getRandomBoard() {
    const keys = Object.keys(SLOT_EMOJIS);
    return {
        s1: keys[Math.floor(Math.random() * keys.length)],
        s2: keys[Math.floor(Math.random() * keys.length)],
        s3: keys[Math.floor(Math.random() * keys.length)]
    };
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

const sleep = ms => new Promise(res => setTimeout(res, ms));

function buildContainer(s1, s2, s3, statusText, user, amount, result, wallet, isDisabled) {
    const board = `[ ${SLOT_EMOJIS[s1]} ] [ ${SLOT_EMOJIS[s2]} ] [ ${SLOT_EMOJIS[s3]} ]`;

    let contentStr = `${board}\n\n**${statusText}**`;
    if (result !== null && wallet !== null) {
        contentStr += `\n\n` +
            `**Bet:** ${coin} ${amount.toLocaleString()} coins\n` +
            `**Earnings:** ${result.net > 0 ? `${coin} +${result.net.toLocaleString()} coins (${result.mult}x)` :
              result.net === 0 && result.mult > 0 ? `Break Even` :
              `${coin} -${amount.toLocaleString()} coins`}\n` +
            `**Wallet:** ${coin} ${wallet.toLocaleString()} coins`;
    }

    const container = new ContainerBuilder()
        .addSectionComponents(
            new SectionBuilder()
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(`## Slot Machine`)
                )
                .setThumbnailAccessory(new ThumbnailBuilder().setURL(user.displayAvatarURL({ forceStatic: true })))
        )
        .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(contentStr)
        );

    container.addActionRowComponents(
        new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('slots_spin_again')
                .setLabel('Spin Again')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(isDisabled)
        )
    );

    return {
        flags: MessageFlags.IsComponentsV2,
        components: [container]
    };
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

        let lastState = {
            s1: 'Cherry', s2: 'Cherry', s3: 'Cherry',
            label: '',
            net: 0, mult: 0,
            wallet: 0
        };

        const playSlots = async (activeInteraction, isButton, buttonInteraction) => {
            // 1. Cooldown Check
            const cd = checkCooldown('slots', user.id, 15);
            if (cd.onCooldown) {
                const msg = { content: `Slot machine cooling down. Wait **${cd.remaining}s**.`, ephemeral: true };
                if (isButton) {
                    await buttonInteraction.reply(msg);
                } else {
                    await activeInteraction.editReply(msg);
                }
                return null;
            }

            // 2. Balance Check
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

            // 3. Spin Results
            const idx1 = Math.floor(Math.random() * STRIP1.length);
            const idx2 = Math.floor(Math.random() * STRIP2.length);
            const idx3 = Math.floor(Math.random() * STRIP3.length);

            const s1 = STRIP1[idx1];
            const s2 = STRIP2[idx2];
            const s3 = STRIP3[idx3];

            const { mult, label } = getMultiplier(s1, s2, s3);
            const payout = Math.floor(amount * mult);
            const net = payout - amount;

            // 4. Update Database
            await db.updateWallet(user.id, net);
            if (net > 0) db.addXP(user.id, XP_REWARDS.gamblingWin).catch(() => null);
            const updated = await db.getUser(user.id);

            lastState = {
                s1, s2, s3,
                label,
                net, mult,
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

            // 5. Spin Animation (3 Frames)
            // Frame 1: All spinning
            const f1 = getRandomBoard();
            let payload = buildContainer(f1.s1, f1.s2, f1.s3, 'Spinning... [ - | - | - ]', user, amount, null, null, true);
            await updateMessage(payload);
            await sleep(600);

            // Frame 2: Reel 1 stopped, Reels 2 & 3 spinning
            const f2 = getRandomBoard();
            payload = buildContainer(s1, f2.s2, f2.s3, `Spinning... [ ${SLOT_EMOJIS[s1]} | - | - ]`, user, amount, null, null, true);
            await updateMessage(payload);
            await sleep(600);

            // Frame 3 (Final): All stopped
            payload = buildContainer(
                s1, s2, s3,
                `Result: ${label}`,
                user,
                amount,
                { net, mult },
                updated.wallet,
                false
            );
            await updateMessage(payload);

            return isButton ? buttonInteraction.message : await activeInteraction.fetchReply();
        };

        let currentCollector = null;

        const setupCollector = (message) => {
            if (currentCollector) {
                currentCollector.stop('user');
            }

            currentCollector = message.createMessageComponentCollector({
                filter: i => i.user.id === user.id && i.customId === 'slots_spin_again',
                time: 60_000
            });

            currentCollector.on('collect', async i => {
                try {
                    const nextMessage = await playSlots(interaction, true, i);
                    if (nextMessage) {
                        setupCollector(nextMessage);
                    }
                } catch (err) {
                    console.error('[SLOTS COLLECT ERROR]', err);
                }
            });

            currentCollector.on('end', async (collected, reason) => {
                if (reason === 'user') return;
                try {
                    const payload = buildContainer(
                        lastState.s1, lastState.s2, lastState.s3,
                        `Result: ${lastState.label}`,
                        user,
                        amount,
                        { net: lastState.net, mult: lastState.mult },
                        lastState.wallet,
                        true
                    );
                    await interaction.editReply(payload).catch(() => null);
                } catch (err) {
                    // Ignore
                }
            });
        };

        try {
            const message = await playSlots(interaction, false, null);
            if (message) {
                setupCollector(message);
            }
        } catch (err) {
            console.error('[SLOTS ERROR]', err);
            const msg = { content: 'Slot machine broke.', ephemeral: true };
            if (interaction.replied || interaction.deferred) await interaction.followUp(msg).catch(() => null);
            else await interaction.editReply(msg).catch(() => null);
        }
    }
};
