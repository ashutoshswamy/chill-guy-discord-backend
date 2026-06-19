const {
    SlashCommandBuilder,
    ContainerBuilder, SectionBuilder, TextDisplayBuilder, ThumbnailBuilder,
    SeparatorBuilder, SeparatorSpacingSize, MessageFlags
} = require('discord.js');
const db = require('../../utils/db');
const { getEmoji } = require('../../utils/emojis');

const coin = getEmoji('coin');

function formatTimeLeft(dueAt) {
    const ms = new Date(dueAt).getTime() - Date.now();
    if (ms <= 0) return 'OVERDUE';
    const days  = Math.floor(ms / (86400000));
    const hours = Math.floor((ms % 86400000) / 3600000);
    const mins  = Math.floor((ms % 3600000) / 60000);
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
}

function lateInfo(loan) {
    const now = Date.now();
    const due = new Date(loan.due_at).getTime();
    if (now <= due) return null;
    const daysLate = Math.floor((now - due) / 86400000);
    const latePenalty = Math.floor(loan.principal * 0.02 * daysLate);
    const effectiveRemaining = Math.min(loan.remaining + latePenalty, loan.principal * 3);
    return { daysLate, latePenalty, effectiveRemaining };
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('loan')
        .setDescription('Borrow coins and manage your loans.')
        .addSubcommand(sub =>
            sub.setName('borrow')
                .setDescription('Take out a loan.')
                .addIntegerOption(opt =>
                    opt.setName('amount').setDescription('Amount to borrow').setRequired(true).setMinValue(100)))
        .addSubcommand(sub =>
            sub.setName('repay')
                .setDescription('Repay your active loan (partial or full).')
                .addIntegerOption(opt =>
                    opt.setName('amount').setDescription('Amount to repay').setRequired(true).setMinValue(1)))
        .addSubcommand(sub =>
            sub.setName('status')
                .setDescription('View your current loan status.'))
        .addSubcommand(sub =>
            sub.setName('history')
                .setDescription('View your loan history.')),

    async execute(interaction) {
        const { user } = interaction;
        const sub = interaction.options.getSubcommand();

        try {
            // Check for defaulted loans on every loan interaction
            const defaultResult = await db.checkAndDefaultLoan(user.id).catch(() => null);
            if (defaultResult?.defaulted) {
                await interaction.editReply({
                    content: `⚠️ **Loan Defaulted!** Your loan was past due. A **20% wallet penalty** (${coin} ${defaultResult.penalty.toLocaleString()}) was collected. Your credit is now flagged.`,
                    ephemeral: true,
                });
                // Don't block — show message then continue to requested sub
            }

            if (sub === 'borrow') {
                const amount = interaction.options.getInteger('amount');
                const guildId = interaction.guildId;

                // Get server loan config
                const settings = guildId
                    ? await db.getGuildSettings(guildId)
                    : { loan_interest_rate: 10, loan_max_amount: 10000, loan_term_days: 7 };

                // Block if existing active loan
                const existing = await db.getActiveLoan(user.id);
                if (existing) {
                    return interaction.editReply({
                        content: `You already have an active loan of ${coin} **${existing.principal.toLocaleString()}** coins. Repay it first.`,
                        ephemeral: true,
                    });
                }

                // Block if previously defaulted
                const history = await db.getUserLoanHistory(user.id, 10);
                const everDefaulted = history.some(l => l.defaulted);
                if (everDefaulted) {
                    const lastDefault = history.find(l => l.defaulted);
                    const cooloffMs = 7 * 24 * 60 * 60 * 1000;
                    const elapsed = Date.now() - new Date(lastDefault.defaulted_at).getTime();
                    if (elapsed < cooloffMs) {
                        const remaining = Math.ceil((cooloffMs - elapsed) / 86400000);
                        return interaction.editReply({
                            content: `Your credit is **flagged** from a previous default. You must wait **${remaining} more day(s)** before borrowing again.`,
                            ephemeral: true,
                        });
                    }
                }

                const maxAmount = Number(settings.loan_max_amount);
                if (amount > maxAmount) {
                    return interaction.editReply({
                        content: `Max loan amount for this server is ${coin} **${maxAmount.toLocaleString()}** coins.`,
                        ephemeral: true,
                    });
                }

                const interestRate = Number(settings.loan_interest_rate);
                const termDays     = Number(settings.loan_term_days);
                const interestAmt  = Math.floor(amount * (interestRate / 100));
                const totalOwed    = amount + interestAmt;
                const dueDate      = new Date(Date.now() + termDays * 24 * 60 * 60 * 1000);

                const loan = await db.takeLoan(user.id, amount, interestRate, termDays);
                const profile = await db.getUser(user.id);

                const container = new ContainerBuilder()
                    .addSectionComponents(
                        new SectionBuilder()
                            .addTextDisplayComponents(
                                new TextDisplayBuilder().setContent(`## Loan Approved`)
                            )
                            .setThumbnailAccessory(new ThumbnailBuilder().setURL(user.displayAvatarURL({ forceStatic: true })))
                    )
                    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(
                            `${coin} **${amount.toLocaleString()}** coins have been deposited to your wallet.\n\n` +
                            `**Principal:** ${coin} ${amount.toLocaleString()}\n` +
                            `**Interest (${interestRate}%):** ${coin} ${interestAmt.toLocaleString()}\n` +
                            `**Total Owed:** ${coin} ${totalOwed.toLocaleString()}\n` +
                            `**Due Date:** <t:${Math.floor(dueDate.getTime() / 1000)}:F> (${termDays} days)\n\n` +
                            `**New Wallet:** ${coin} ${profile.wallet.toLocaleString()}\n\n` +
                            `> ⚠️ Late payments incur **+2% per day** penalty. Defaulting triggers a **20% wallet seizure**.`
                        )
                    );

                return interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [container] });
            }

            if (sub === 'repay') {
                const amount  = interaction.options.getInteger('amount');
                const loan    = await db.getActiveLoan(user.id);

                if (!loan) {
                    return interaction.editReply({ content: 'You have no active loan to repay.', ephemeral: true });
                }

                const late = lateInfo(loan);
                const effectiveRemaining = late ? late.effectiveRemaining : loan.remaining;

                const result = await db.repayLoan(loan.id, user.id, amount);
                const profile = await db.getUser(user.id);

                let statusLine = result.paidOff
                    ? `\n\n✅ **Loan fully paid off!** Your credit record is clean.`
                    : `\n\n**Remaining Owed:** ${coin} ${result.remaining.toLocaleString()}`;

                const container = new ContainerBuilder()
                    .addSectionComponents(
                        new SectionBuilder()
                            .addTextDisplayComponents(
                                new TextDisplayBuilder().setContent(`## Loan Repayment`)
                            )
                            .setThumbnailAccessory(new ThumbnailBuilder().setURL(user.displayAvatarURL({ forceStatic: true })))
                    )
                    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(
                            `Paid ${coin} **${result.payAmount.toLocaleString()}** coins toward your loan.` +
                            statusLine +
                            `\n**Wallet:** ${coin} ${profile.wallet.toLocaleString()}`
                        )
                    );

                return interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [container] });
            }

            if (sub === 'status') {
                const loan = await db.getActiveLoan(user.id);

                if (!loan) {
                    const history = await db.getUserLoanHistory(user.id, 1);
                    const lastLoan = history[0];
                    const msg = lastLoan
                        ? `No active loan. Last loan: ${coin} ${lastLoan.principal.toLocaleString()} — **${lastLoan.paid_off ? 'Paid Off' : 'Defaulted'}**.`
                        : 'You have no loan history. Use `/loan borrow` to take a loan.';
                    return interaction.editReply({ content: msg, ephemeral: true });
                }

                const late = lateInfo(loan);
                const effectiveRemaining = late ? late.effectiveRemaining : loan.remaining;
                const timeLeft = formatTimeLeft(loan.due_at);
                const progressPct = Math.round((loan.amount_paid / loan.total_owed) * 100);
                const progressBar = '█'.repeat(Math.floor(progressPct / 10)) + '░'.repeat(10 - Math.floor(progressPct / 10));

                let lateWarning = '';
                if (late) {
                    lateWarning = `\n\n⚠️ **OVERDUE by ${late.daysLate} day(s)!**\n` +
                        `Late penalty: ${coin} ${late.latePenalty.toLocaleString()} added\n` +
                        `Effective remaining: ${coin} ${late.effectiveRemaining.toLocaleString()}`;
                }

                const container = new ContainerBuilder()
                    .addSectionComponents(
                        new SectionBuilder()
                            .addTextDisplayComponents(
                                new TextDisplayBuilder().setContent(`## Loan Status`)
                            )
                            .setThumbnailAccessory(new ThumbnailBuilder().setURL(user.displayAvatarURL({ forceStatic: true })))
                    )
                    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(
                            `**Principal:** ${coin} ${loan.principal.toLocaleString()}\n` +
                            `**Interest (${loan.interest_rate}%):** ${coin} ${loan.interest_amt.toLocaleString()}\n` +
                            `**Total Owed:** ${coin} ${loan.total_owed.toLocaleString()}\n` +
                            `**Amount Paid:** ${coin} ${loan.amount_paid.toLocaleString()}\n` +
                            `**Remaining:** ${coin} ${effectiveRemaining.toLocaleString()}\n\n` +
                            `**Progress:** \`${progressBar}\` ${progressPct}%\n` +
                            `**Due:** <t:${Math.floor(new Date(loan.due_at).getTime() / 1000)}:R> (${timeLeft})` +
                            lateWarning +
                            `\n\nUse \`/loan repay\` to make a payment.`
                        )
                    );

                return interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [container] });
            }

            if (sub === 'history') {
                const history = await db.getUserLoanHistory(user.id, 5);

                if (history.length === 0) {
                    return interaction.editReply({ content: 'No loan history found.', ephemeral: true });
                }

                const lines = history.map((l, i) => {
                    const status = l.paid_off ? '✅ Paid' : l.defaulted ? '❌ Defaulted' : '🔄 Active';
                    const date = `<t:${Math.floor(new Date(l.taken_at).getTime() / 1000)}:d>`;
                    return `**${i + 1}.** ${coin} ${l.principal.toLocaleString()} @ ${l.interest_rate}% — ${status} — ${date}`;
                }).join('\n');

                const container = new ContainerBuilder()
                    .addSectionComponents(
                        new SectionBuilder()
                            .addTextDisplayComponents(
                                new TextDisplayBuilder().setContent(`## Loan History`)
                            )
                            .setThumbnailAccessory(new ThumbnailBuilder().setURL(user.displayAvatarURL({ forceStatic: true })))
                    )
                    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(lines)
                    );

                return interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [container] });
            }

        } catch (err) {
            console.error('[LOAN ERROR]', err);
            return interaction.editReply({ content: `**Error:** ${err.message}`, ephemeral: true });
        }
    }
};
