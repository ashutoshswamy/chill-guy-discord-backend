const {
    SlashCommandBuilder,
    ContainerBuilder, SectionBuilder, TextDisplayBuilder, ThumbnailBuilder,
    SeparatorBuilder, SeparatorSpacingSize,
    ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags
} = require('discord.js');
const db = require('../../utils/db');
const { XP_REWARDS } = require('../../utils/xp');
const { getEmoji } = require('../../utils/emojis');

const coin = getEmoji('coin');

const SUITS = ['♠', '♥', '♦', '♣'];
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

function makeDeck() {
    const deck = [];
    for (const suit of SUITS)
        for (const rank of RANKS)
            deck.push({ suit, rank });
    return deck.sort(() => Math.random() - 0.5);
}

function cardValue(rank) {
    if (['J', 'Q', 'K'].includes(rank)) return 10;
    if (rank === 'A') return 11;
    return parseInt(rank);
}

function handTotal(hand) {
    let total = hand.reduce((s, c) => s + cardValue(c.rank), 0);
    let aces = hand.filter(c => c.rank === 'A').length;
    while (total > 21 && aces > 0) { total -= 10; aces--; }
    return total;
}

function formatHand(hand) {
    return hand.map(c => `\`${c.rank}${c.suit}\``).join(' ');
}

function buildEmbed(playerHand, dealerHand, hideDealer, user, amount, status = null) {
    const playerTotal = handTotal(playerHand);
    const dealerVisible = hideDealer ? [dealerHand[0]] : dealerHand;
    const dealerTotal = hideDealer ? cardValue(dealerHand[0].rank) : handTotal(dealerHand);

    let statusLine = '';
    if (status === 'win') statusLine = '\n\n**You win!**';
    else if (status === 'lose') statusLine = '\n\n**You lose!**';
    else if (status === 'push') statusLine = '\n\n**Push - bet returned!**';
    else if (status === 'blackjack') statusLine = '\n\n**Blackjack! 3:2 payout!**';
    else if (status === 'bust') statusLine = '\n\n**Bust! Over 21!**';

    const container = new ContainerBuilder()
        .addSectionComponents(
            new SectionBuilder()
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(`## Blackjack - Bet: ${amount.toLocaleString()}`)
                )
                .setThumbnailAccessory(new ThumbnailBuilder().setURL(user.displayAvatarURL({ forceStatic: true })))
        )
        .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `**Dealer** (${hideDealer ? dealerVisible[0].rank === 'A' ? '11' : cardValue(dealerVisible[0].rank) : dealerTotal}${hideDealer ? '+?' : ''})\n` +
                `${formatHand(dealerVisible)}${hideDealer ? ' `?`' : ''}\n\n` +
                `**Your Hand** (${playerTotal})\n` +
                `${formatHand(playerHand)}` +
                statusLine
            )
        );

    return container;
}

module.exports = {
    cooldown: 10,
    data: new SlashCommandBuilder()
        .setName('blackjack')
        .setDescription('Play blackjack against the dealer. Beat 21 or go bust.')
        .addIntegerOption(opt =>
            opt.setName('amount')
                .setDescription('Amount to bet from your wallet')
                .setMinValue(10)
                .setRequired(true)),

    async execute(interaction) {
        const { user } = interaction;
        const amount = interaction.options.getInteger('amount');

        try {
            const profile = await db.getUser(user.id);
            if (profile.wallet < amount) {
                return interaction.editReply({ content: `Not enough coins. You have ${coin} **${profile.wallet.toLocaleString()}** in wallet.`, ephemeral: true });
            }

            const deck = makeDeck();
            const playerHand = [deck.pop(), deck.pop()];
            const dealerHand = [deck.pop(), deck.pop()];

            // Natural blackjack check
            if (handTotal(playerHand) === 21) {
                const payout = Math.floor(amount * 1.5);
                await db.updateWallet(user.id, payout);
                db.updateQuestProgress(user.id, 'gamble').catch(() => null);
                const updated = await db.getUser(user.id);
                const container = buildEmbed(playerHand, dealerHand, false, user, amount, 'blackjack');
                container.addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(`**Payout:** ${coin} **+${payout.toLocaleString()}** coins\n**Wallet:** ${coin} **${updated.wallet.toLocaleString()}** coins`)
                );
                return interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [container] });
            }

            const container = buildEmbed(playerHand, dealerHand, true, user, amount);
            container.addActionRowComponents(
                new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('bj_hit').setLabel('Hit').setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId('bj_stand').setLabel('Stand').setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId('bj_double').setLabel('Double Down').setStyle(ButtonStyle.Danger)
                        .setDisabled(profile.wallet < amount * 2 || playerHand.length !== 2)
                )
            );

            const response = await interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [container] });

            const collector = response.createMessageComponentCollector({
                filter: i => i.user.id === user.id,
                time: 60_000
            });

            let doubled = false;

            async function endGame(status, finalPlayerHand, finalDealerHand, betAmount) {
                collector.stop();
                let net = 0;
                if (status === 'win' || status === 'blackjack') net = betAmount;
                else if (status === 'lose' || status === 'bust') net = -betAmount;
                // push: net = 0

                await db.updateWallet(user.id, net);
                db.updateQuestProgress(user.id, 'gamble').catch(() => null);
                if (net > 0) db.addXP(user.id, XP_REWARDS.gamblingWin).catch(() => null);
                const updated = await db.getUser(user.id);

                const final = buildEmbed(finalPlayerHand, finalDealerHand, false, user, betAmount, status);
                final.addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        `${net > 0 ? `**Won:** ${coin} **+${net.toLocaleString()}** coins` :
                          net < 0 ? `**Lost:** ${coin} **-${Math.abs(net).toLocaleString()}** coins` :
                          `**Returned:** ${coin} **${betAmount.toLocaleString()}** coins`}\n` +
                        `**Wallet:** ${coin} **${updated.wallet.toLocaleString()}** coins`
                    )
                );
                await interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [final] }).catch(() => null);
            }

            collector.on('collect', async i => {
                await i.deferUpdate();
                const currentBet = doubled ? amount * 2 : amount;
                const playerTotal = handTotal(playerHand);

                if (i.customId === 'bj_hit' || (i.customId === 'bj_double' && !doubled)) {
                    if (i.customId === 'bj_double') {
                        doubled = true;
                        playerHand.push(deck.pop());
                        const newTotal = handTotal(playerHand);
                        if (newTotal > 21) return endGame('bust', playerHand, dealerHand, amount * 2);

                        // After double, must stand
                        while (handTotal(dealerHand) < 17) dealerHand.push(deck.pop());
                        const dealerTotal = handTotal(dealerHand);
                        const pTotal = handTotal(playerHand);
                        if (dealerTotal > 21 || pTotal > dealerTotal) return endGame('win', playerHand, dealerHand, amount * 2);
                        if (pTotal === dealerTotal) return endGame('push', playerHand, dealerHand, amount * 2);
                        return endGame('lose', playerHand, dealerHand, amount * 2);
                    }

                    playerHand.push(deck.pop());
                    const newTotal = handTotal(playerHand);

                    if (newTotal > 21) return endGame('bust', playerHand, dealerHand, currentBet);

                    const updated = buildEmbed(playerHand, dealerHand, true, user, currentBet);
                    updated.addActionRowComponents(
                        new ActionRowBuilder().addComponents(
                            new ButtonBuilder().setCustomId('bj_hit').setLabel('Hit').setStyle(ButtonStyle.Primary),
                            new ButtonBuilder().setCustomId('bj_stand').setLabel('Stand').setStyle(ButtonStyle.Secondary),
                            new ButtonBuilder().setCustomId('bj_double').setLabel('Double Down').setStyle(ButtonStyle.Danger).setDisabled(true)
                        )
                    );
                    await interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [updated] }).catch(() => null);
                }

                if (i.customId === 'bj_stand') {
                    while (handTotal(dealerHand) < 17) dealerHand.push(deck.pop());
                    const dealerTotal = handTotal(dealerHand);
                    const pTotal = handTotal(playerHand);
                    if (dealerTotal > 21 || pTotal > dealerTotal) return endGame('win', playerHand, dealerHand, currentBet);
                    if (pTotal === dealerTotal) return endGame('push', playerHand, dealerHand, currentBet);
                    return endGame('lose', playerHand, dealerHand, currentBet);
                }
            });

            collector.on('end', async (_, reason) => {
                if (reason === 'time') {
                    // Auto-stand on timeout
                    while (handTotal(dealerHand) < 17) dealerHand.push(deck.pop());
                    const currentBet = doubled ? amount * 2 : amount;
                    const dealerTotal = handTotal(dealerHand);
                    const pTotal = handTotal(playerHand);
                    let status;
                    if (dealerTotal > 21 || pTotal > dealerTotal) status = 'win';
                    else if (pTotal === dealerTotal) status = 'push';
                    else status = 'lose';

                    await db.updateWallet(user.id, status === 'win' ? currentBet : status === 'lose' ? -currentBet : 0);
                    const updated = await db.getUser(user.id);
                    const final = buildEmbed(playerHand, dealerHand, false, user, currentBet, status);
                    final.addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(`*(Timed out - auto-stood)*\n**Wallet:** ${coin} **${updated.wallet.toLocaleString()}** coins`)
                    );
                    await interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [final] }).catch(() => null);
                }
            });

        } catch (err) {
            console.error('[BLACKJACK ERROR]', err);
            const msg = { content: 'Blackjack table crashed.', ephemeral: true };
            if (interaction.replied || interaction.deferred) await interaction.followUp(msg).catch(() => null);
            else await interaction.editReply(msg).catch(() => null);
        }
    }
};
