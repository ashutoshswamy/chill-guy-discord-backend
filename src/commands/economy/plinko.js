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

const MULTIPLIERS = [4.0, 2.0, 0.5, 0.5, 2.0, 4.0];

function generatePlinkoPath() {
    const path = [{ r: 0, idx: 0 }];
    let currentIdx = 0;
    for (let r = 1; r <= 5; r++) {
        const step = Math.random() < 0.5 ? 0 : 1;
        currentIdx += step;
        path.push({ r, idx: currentIdx });
    }
    return path;
}

function renderBoard(r, idx) {
    const peg = '·';
    const ball = '●';

    const row0 = `      ${(r === 0 && idx === 0) ? ball : peg}      `;
    
    const row1 = `     ${(r === 1 && idx === 0) ? ball : peg}   ${(r === 1 && idx === 1) ? ball : peg}     `;
    
    const row2 = `    ${(r === 2 && idx === 0) ? ball : peg}   ${(r === 2 && idx === 1) ? ball : peg}   ${(r === 2 && idx === 2) ? ball : peg}    `;
    
    const row3 = `   ${(r === 3 && idx === 0) ? ball : peg}   ${(r === 3 && idx === 1) ? ball : peg}   ${(r === 3 && idx === 2) ? ball : peg}   ${(r === 3 && idx === 3) ? ball : peg}   `;
    
    const row4 = `  ${(r === 4 && idx === 0) ? ball : peg}   ${(r === 4 && idx === 1) ? ball : peg}   ${(r === 4 && idx === 2) ? ball : peg}   ${(r === 4 && idx === 3) ? ball : peg}   ${(r === 4 && idx === 4) ? ball : peg}  `;

    const buckets = ['4x', ' 2x', ' .5', ' .5', ' 2x', '4x'];
    if (r === 5) {
        if (idx === 0) buckets[0] = '● ';
        else if (idx === 5) buckets[5] = ' ●';
        else buckets[idx] = ' ● ';
    }
    const row5 = `${buckets[0]}|${buckets[1]}|${buckets[2]}|${buckets[3]}|${buckets[4]}|${buckets[5]}`;

    return `\`\`\`\n${row0}\n${row1}\n${row2}\n${row3}\n${row4}\n${row5}\n\`\`\``;
}

const sleep = ms => new Promise(res => setTimeout(res, ms));

function buildPlinkoContainer(user, betAmount, boardString, mult = null, net = null, wallet = null, isDisabled = false) {
    let contentStr = `${boardString}`;

    if (mult !== null && net !== null && wallet !== null) {
        contentStr += `\n\n` +
            `**Bet:** ${coin} ${betAmount.toLocaleString()} coins\n` +
            `**Result:** ${mult}x\n` +
            `**Earnings:** ${net > 0 ? `${coin} +${net.toLocaleString()} coins` :
               net === 0 ? `Break Even` :
               `${coin} -${betAmount.toLocaleString()} coins`}\n` +
            `**Wallet:** ${coin} ${wallet.toLocaleString()} coins`;
    } else {
        contentStr += `\n\n` +
            `**Bet:** ${coin} ${betAmount.toLocaleString()} coins\n` +
            `**Status:** Ball dropping...`;
    }

    const container = new ContainerBuilder()
        .addSectionComponents(
            new SectionBuilder()
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(`## Plinko Board`)
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
                .setCustomId('plinko_drop_again')
                .setLabel('Drop Again')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(isDisabled)
        )
    );

    return {
        flags: MessageFlags.IsComponentsV2,
        components: [container]
    };
}

const COOLDOWN_MS = 15 * 1000;

module.exports = {
    data: new SlashCommandBuilder()
        .setName('plinko')
        .setDescription('Drop a ball down the Plinko board to win multipliers.')
        .addIntegerOption(opt =>
            opt.setName('amount')
                .setDescription('Amount to bet from your wallet')
                .setMinValue(10)
                .setRequired(true)),

    async execute(interaction) {
        const { user } = interaction;
        const amount = interaction.options.getInteger('amount');

        const cd = await db.checkAndSetCooldown(user.id, 'plinko', COOLDOWN_MS);
        if (cd.onCooldown) {
            const s = Math.ceil(cd.remaining / 1000);
            return interaction.editReply({ content: `On cooldown! Try again in **${s}s**.`, ephemeral: true });
        }

        let lastState = {
            boardString: '',
            mult: 0,
            net: 0,
            wallet: 0
        };

        const playPlinko = async (activeInteraction, isButton, buttonInteraction) => {
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

            const path = generatePlinkoPath();
            const finalNode = path[path.length - 1];
            const mult = MULTIPLIERS[finalNode.idx];
            const payout = Math.floor(amount * mult);
            const net = payout - amount;

            await db.updateWallet(user.id, net);
            if (net > 0) db.addXP(user.id, XP_REWARDS.gamblingWin).catch(() => null);
            const updated = await db.getUser(user.id);

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

            // Animate steps 0 to 4 (ball bouncing)
            for (let i = 0; i < path.length - 1; i++) {
                const step = path[i];
                const boardStr = renderBoard(step.r, step.idx);
                const payload = buildPlinkoContainer(user, amount, boardStr, null, null, null, true);
                await updateMessage(payload);
                await sleep(600);
            }

            // Step 5 (landing)
            const boardStr = renderBoard(finalNode.r, finalNode.idx);
            
            lastState = {
                boardString: boardStr,
                mult,
                net,
                wallet: updated.wallet
            };

            const payload = buildPlinkoContainer(user, amount, boardStr, mult, net, updated.wallet, false);
            await updateMessage(payload);

            return isButton ? buttonInteraction.message : await activeInteraction.fetchReply();
        };

        let currentCollector = null;

        const setupCollector = (message) => {
            if (currentCollector) {
                currentCollector.stop('user');
            }

            currentCollector = message.createMessageComponentCollector({
                filter: i => i.user.id === user.id && i.customId === 'plinko_drop_again',
                time: 60_000
            });

            currentCollector.on('collect', async i => {
                try {
                    const nextMessage = await playPlinko(interaction, true, i);
                    if (nextMessage) {
                        setupCollector(nextMessage);
                    }
                } catch (err) {
                    console.error('[PLINKO COLLECT ERROR]', err);
                }
            });

            currentCollector.on('end', async (collected, reason) => {
                if (reason === 'user') return;
                try {
                    const payload = buildPlinkoContainer(user, amount, lastState.boardString, lastState.mult, lastState.net, lastState.wallet, true);
                    await interaction.editReply(payload).catch(() => null);
                } catch (err) {
                    // Ignore
                }
            });
        };

        try {
            const message = await playPlinko(interaction, false, null);
            if (message) {
                setupCollector(message);
            }
        } catch (err) {
            console.error('[PLINKO ERROR]', err);
            const msg = { content: 'Something went wrong with the Plinko game.', ephemeral: true };
            if (interaction.replied || interaction.deferred) await interaction.followUp(msg).catch(() => null);
            else await interaction.editReply(msg).catch(() => null);
        }
    }
};
