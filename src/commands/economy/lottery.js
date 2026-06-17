const {
    SlashCommandBuilder,
    ContainerBuilder, SectionBuilder, TextDisplayBuilder, ThumbnailBuilder,
    SeparatorBuilder, SeparatorSpacingSize, MessageFlags
} = require('discord.js');
const db = require('../../utils/db');
const { XP_REWARDS } = require('../../utils/xp');
const { getEmoji } = require('../../utils/emojis');

const coin = getEmoji('coin');

const TICKET_PRICE = 100;
const MAX_TICKETS_PER_BUY = 100;
const DRAW_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 hours

function msToHuman(ms) {
    const h = Math.floor(ms / 3_600_000);
    const m = Math.floor((ms % 3_600_000) / 60_000);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('lottery')
        .setDescription('Server lottery - buy tickets, draw winner every 24h.')
        .addSubcommand(sub =>
            sub.setName('buy')
                .setDescription(`Buy lottery tickets (${TICKET_PRICE} coins each).`)
                .addIntegerOption(opt =>
                    opt.setName('tickets')
                        .setDescription(`Number of tickets to buy (max ${MAX_TICKETS_PER_BUY})`)
                        .setMinValue(1)
                        .setMaxValue(MAX_TICKETS_PER_BUY)
                        .setRequired(true)))
        .addSubcommand(sub =>
            sub.setName('info')
                .setDescription('Check current lottery pot, round, and your tickets.'))
        .addSubcommand(sub =>
            sub.setName('draw')
                .setDescription('Draw the lottery winner (available 24h after last draw).')),

    async execute(interaction) {
        const { user } = interaction;
        const sub = interaction.options.getSubcommand();

        try {
            if (sub === 'info') {
                const state = await db.getLotteryState();
                const tickets = await db.getLotteryTickets(state.round);
                const myEntry = await db.getUserLotteryTickets(user.id, state.round);
                const totalTickets = tickets.reduce((s, t) => s + t.ticket_count, 0);
                const myTickets = myEntry?.ticket_count || 0;
                const participants = tickets.length;

                const lastDrawn = new Date(state.last_drawn_at).getTime();
                const nextDraw = lastDrawn + DRAW_COOLDOWN_MS;
                const now = Date.now();
                const canDraw = now >= nextDraw;
                const timeLeft = canDraw ? 'Ready now!' : msToHuman(nextDraw - now);

                const myOdds = totalTickets > 0 && myTickets > 0
                    ? `${((myTickets / totalTickets) * 100).toFixed(2)}%`
                    : '0%';

                const container = new ContainerBuilder()
                    .addSectionComponents(
                        new SectionBuilder()
                            .addTextDisplayComponents(
                                new TextDisplayBuilder().setContent(`## Lottery - Round #${state.round}`)
                            )
                            .setThumbnailAccessory(new ThumbnailBuilder().setURL(user.displayAvatarURL({ forceStatic: true })))
                    )
                    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(
                            `**Pot:** ${coin} ${state.pot.toLocaleString()} coins\n` +
                            `**Total Tickets Sold:** ${totalTickets.toLocaleString()}\n` +
                            `**Participants:** ${participants}\n` +
                            `**Your Tickets:** ${myTickets.toLocaleString()}\n` +
                            `**Your Win Chance:** ${myOdds}\n\n` +
                            `**Next Draw:** ${timeLeft}\n` +
                            `**Ticket Price:** ${coin} ${TICKET_PRICE} coins each`
                        )
                    );

                return interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [container] });
            }

            if (sub === 'buy') {
                const count = interaction.options.getInteger('tickets');
                const cost = count * TICKET_PRICE;

                const profile = await db.getUser(user.id);
                if (profile.wallet < cost) {
                    return interaction.editReply({
                        content: `Need ${coin} **${cost.toLocaleString()}** coins for ${count} ticket${count > 1 ? 's' : ''}. You have ${coin} **${profile.wallet.toLocaleString()}**.`,
                        ephemeral: true
                    });
                }

                const { pot, round } = await db.buyLotteryTickets(user.id, count, TICKET_PRICE);
                const updated = await db.getUser(user.id);
                const myEntry = await db.getUserLotteryTickets(user.id, round);
                const allTickets = await db.getLotteryTickets(round);
                const totalTickets = allTickets.reduce((s, t) => s + t.ticket_count, 0);
                const myTotal = myEntry?.ticket_count || count;
                const odds = ((myTotal / totalTickets) * 100).toFixed(2);

                const container = new ContainerBuilder()
                    .addSectionComponents(
                        new SectionBuilder()
                            .addTextDisplayComponents(
                                new TextDisplayBuilder().setContent(`## Lottery Tickets Purchased!`)
                            )
                            .setThumbnailAccessory(new ThumbnailBuilder().setURL(user.displayAvatarURL({ forceStatic: true })))
                    )
                    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(
                            `Bought **${count}** ticket${count > 1 ? 's' : ''} for ${coin} **${cost.toLocaleString()}** coins\n\n` +
                            `**Your Total Tickets (Round #${round}):** ${myTotal.toLocaleString()}\n` +
                            `**Your Win Chance:** ${odds}%\n` +
                            `**Current Pot:** ${coin} ${pot.toLocaleString()} coins\n` +
                            `**Wallet:** ${coin} ${updated.wallet.toLocaleString()} coins`
                        )
                    );

                return interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [container] });
            }

            if (sub === 'draw') {
                const state = await db.getLotteryState();
                const lastDrawn = new Date(state.last_drawn_at).getTime();
                const nextDraw = lastDrawn + DRAW_COOLDOWN_MS;
                const now = Date.now();

                if (now < nextDraw) {
                    return interaction.editReply({
                        content: `Draw not ready. Next draw in **${msToHuman(nextDraw - now)}**.`,
                        ephemeral: true
                    });
                }

                if (state.pot === 0) {
                    return interaction.editReply({
                        content: 'No tickets sold this round. Buy some tickets first!',
                        ephemeral: true
                    });
                }

                const result = await db.drawLottery();
                db.addXP(result.winnerId, XP_REWARDS.lotteryWin).catch(() => null);

                // Try to fetch winner username
                let winnerMention = `<@${result.winnerId}>`;

                const container = new ContainerBuilder()
                    .addSectionComponents(
                        new SectionBuilder()
                            .addTextDisplayComponents(
                                new TextDisplayBuilder().setContent(`## Lottery Draw - Round #${result.round}`)
                            )
                            .setThumbnailAccessory(new ThumbnailBuilder().setURL(user.displayAvatarURL({ forceStatic: true })))
                    )
                    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(
                            `**Winner:** ${winnerMention}\n\n` +
                            `**Prize:** ${coin} ${result.winnerPayout.toLocaleString()} coins\n` +
                            `**Total Pot:** ${coin} ${result.pot.toLocaleString()} coins\n` +
                            `**Winner's Tickets:** ${result.winnerTickets.toLocaleString()} / ${result.totalTickets.toLocaleString()}\n` +
                            `**Win Odds:** ${((result.winnerTickets / result.totalTickets) * 100).toFixed(2)}%\n\n` +
                            `_Round #${result.round + 1} has begun. Buy tickets with \`/lottery buy\`!_`
                        )
                    );

                return interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [container] });
            }

        } catch (err) {
            console.error('[LOTTERY ERROR]', err);
            const msg = { content: `Lottery error: ${err.message || 'Unknown error.'}`, ephemeral: true };
            if (interaction.replied || interaction.deferred) await interaction.followUp(msg).catch(() => null);
            else await interaction.editReply(msg).catch(() => null);
        }
    }
};
