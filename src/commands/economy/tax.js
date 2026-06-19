const {
    SlashCommandBuilder,
    ContainerBuilder, SectionBuilder, TextDisplayBuilder, ThumbnailBuilder,
    SeparatorBuilder, SeparatorSpacingSize, MessageFlags
} = require('discord.js');
const db = require('../../utils/db');
const { getEmoji } = require('../../utils/emojis');

const coin = getEmoji('coin');

function isServerAdmin(interaction) {
    return interaction.memberPermissions?.has('ManageGuild') ||
           interaction.memberPermissions?.has('Administrator');
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('tax')
        .setDescription('View or manage the server tax system.')
        .addSubcommand(sub =>
            sub.setName('info')
                .setDescription('View the current tax rate and settings.'))
        .addSubcommand(sub =>
            sub.setName('set')
                .setDescription('(Server Admin) Set the tax rate.')
                .addNumberOption(opt =>
                    opt.setName('rate')
                        .setDescription('Tax rate as a percentage (0-50)')
                        .setRequired(true)
                        .setMinValue(0)
                        .setMaxValue(50))
                .addBooleanOption(opt =>
                    opt.setName('enabled')
                        .setDescription('Enable or disable the tax system')
                        .setRequired(false)))
        .addSubcommand(sub =>
            sub.setName('collect')
                .setDescription('(Server Admin) Collect taxes from all registered server members.')
                .addBooleanOption(opt =>
                    opt.setName('bank_only')
                        .setDescription('Only tax bank balances (default: wallet only)')
                        .setRequired(false))),

    async execute(interaction) {
        const { user, guild } = interaction;
        const sub = interaction.options.getSubcommand();

        if (!guild) {
            return interaction.editReply({ content: 'Tax commands only work in a server.', ephemeral: true });
        }

        try {
            const settings = await db.getGuildSettings(guild.id);

            // ── INFO ──────────────────────────────────────────
            if (sub === 'info') {
                const status   = settings.tax_enabled ? '🟢 **Enabled**' : '🔴 **Disabled**';
                const rate     = Number(settings.tax_rate).toFixed(1);

                const container = new ContainerBuilder()
                    .addSectionComponents(
                        new SectionBuilder()
                            .addTextDisplayComponents(
                                new TextDisplayBuilder().setContent(`## Tax System — ${guild.name}`)
                            )
                            .setThumbnailAccessory(
                                new ThumbnailBuilder().setURL(guild.iconURL({ forceStatic: true }) || interaction.client.user.displayAvatarURL())
                            )
                    )
                    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(
                            `**Status:** ${status}\n` +
                            `**Tax Rate:** ${rate}%\n\n` +
                            `When tax is collected, **${rate}%** is deducted from each member's wallet balance.\n` +
                            `Server admins can use \`/tax collect\` to trigger a collection.`
                        )
                    );

                return interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [container] });
            }

            // ── SET ──────────────────────────────────────────
            if (sub === 'set') {
                if (!isServerAdmin(interaction)) {
                    return interaction.editReply({ content: 'You need **Manage Server** permission to change tax settings.', ephemeral: true });
                }

                const rate    = interaction.options.getNumber('rate');
                const enabled = interaction.options.getBoolean('enabled');

                const updates = { tax_rate: rate };
                if (enabled !== null) updates.tax_enabled = enabled;

                const updated = await db.updateGuildSettings(guild.id, updates);

                const container = new ContainerBuilder()
                    .addSectionComponents(
                        new SectionBuilder()
                            .addTextDisplayComponents(
                                new TextDisplayBuilder().setContent(`## Tax Settings Updated`)
                            )
                            .setThumbnailAccessory(new ThumbnailBuilder().setURL(user.displayAvatarURL({ forceStatic: true })))
                    )
                    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(
                            `**Tax Rate:** ${Number(updated.tax_rate).toFixed(1)}%\n` +
                            `**Status:** ${updated.tax_enabled ? '🟢 Enabled' : '🔴 Disabled'}`
                        )
                    );

                return interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [container] });
            }

            // ── COLLECT ──────────────────────────────────────
            if (sub === 'collect') {
                if (!isServerAdmin(interaction)) {
                    return interaction.editReply({ content: 'You need **Manage Server** permission to collect taxes.', ephemeral: true });
                }

                if (!settings.tax_enabled) {
                    return interaction.editReply({
                        content: `Tax is currently **disabled** for this server. Enable it with \`/tax set rate:<value> enabled:True\`.`,
                        ephemeral: true,
                    });
                }

                await interaction.editReply({ content: '⏳ Collecting taxes from server members...' });

                const taxRate  = Number(settings.tax_rate) / 100;
                const bankOnly = interaction.options.getBoolean('bank_only') ?? false;

                // Fetch guild members
                await guild.members.fetch();
                const memberIds = guild.members.cache
                    .filter(m => !m.user.bot)
                    .map(m => m.user.id);

                if (memberIds.length === 0) {
                    return interaction.editReply({ content: 'No eligible members found.', ephemeral: true });
                }

                let taxed = 0;
                let totalCollected = 0;
                let skipped = 0;

                // Process in batches to avoid rate limits
                for (const memberId of memberIds) {
                    try {
                        const profile = await db.getUser(memberId);
                        let taxableBalance = bankOnly ? profile.bank : profile.wallet;
                        const taxAmt = Math.floor(taxableBalance * taxRate);

                        if (taxAmt <= 0) { skipped++; continue; }

                        if (bankOnly) {
                            // Deduct from bank directly
                            await db.supabase
                                .from('users')
                                .update({ bank: Math.max(0, profile.bank - taxAmt) })
                                .eq('user_id', memberId);
                        } else {
                            await db.updateWallet(memberId, -taxAmt);
                        }

                        totalCollected += taxAmt;
                        taxed++;
                    } catch {
                        skipped++;
                    }
                }

                const container = new ContainerBuilder()
                    .addSectionComponents(
                        new SectionBuilder()
                            .addTextDisplayComponents(
                                new TextDisplayBuilder().setContent(`## 🏛️ Tax Collection Complete`)
                            )
                            .setThumbnailAccessory(
                                new ThumbnailBuilder().setURL(guild.iconURL({ forceStatic: true }) || interaction.client.user.displayAvatarURL())
                            )
                    )
                    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(
                            `**Tax Rate:** ${(taxRate * 100).toFixed(1)}%\n` +
                            `**Source:** ${bankOnly ? 'Bank' : 'Wallet'}\n` +
                            `**Members Taxed:** ${taxed}\n` +
                            `**Members Skipped:** ${skipped} (no balance)\n` +
                            `**Total Collected:** ${coin} ${totalCollected.toLocaleString()} coins\n\n` +
                            `> Taxes collected and removed from the economy.`
                        )
                    );

                return interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [container] });
            }

        } catch (err) {
            console.error('[TAX ERROR]', err);
            return interaction.editReply({ content: `**Error:** ${err.message}`, ephemeral: true });
        }
    }
};
