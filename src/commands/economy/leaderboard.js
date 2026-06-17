const {
    SlashCommandBuilder,
    ContainerBuilder, TextDisplayBuilder,
    SeparatorBuilder, SeparatorSpacingSize,
    ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags
} = require('discord.js');
const db  = require('../../utils/db');
const { getLevelFromXP, getRankTier } = require('../../utils/xp');
const { getEmoji }                    = require('../../utils/emojis');

const coin = getEmoji('coin');
const xp   = getEmoji('xp');

const MEDALS = ['**1.**', '**2.**', '**3.**'];
function pos(i) { return MEDALS[i] ?? `**${i + 1}.**`; }

// ── Resolve a display name purely from cache (no gateway requests) ──────────
function resolveName(userId, guild, scope) {
    if (scope === 'server' && guild) {
        const member = guild.members.cache.get(userId);
        if (member) return member.displayName;
    }
    // Try the users cache (populated from previous interactions)
    const user = guild?.client.users.cache.get(userId);
    if (user) return user.username;
    return `User …${userId.slice(-4)}`;
}

// ── Build button rows (lbt_ = type, lbs_ = scope to avoid ID collisions) ───
function buildButtons(activeType, activeScope, disabled = false) {
    const typeRow = new ActionRowBuilder().addComponents(
        ['xp', 'coins', 'networth'].map(t =>
            new ButtonBuilder()
                .setCustomId(`lbt_${t}_${activeScope}`)
                .setLabel(t === 'xp' ? 'XP' : t === 'coins' ? 'Coins' : 'Net Worth')
                .setStyle(t === activeType ? ButtonStyle.Primary : ButtonStyle.Secondary)
                .setDisabled(disabled || t === activeType)
        )
    );
    const scopeRow = new ActionRowBuilder().addComponents(
        ['server', 'global'].map(s =>
            new ButtonBuilder()
                .setCustomId(`lbs_${activeType}_${s}`)
                .setLabel(s === 'server' ? 'Server' : 'Global')
                .setStyle(s === activeScope ? ButtonStyle.Success : ButtonStyle.Secondary)
                .setDisabled(disabled || s === activeScope)
        )
    );
    return [typeRow, scopeRow];
}

// ── Build the leaderboard container ─────────────────────────────────────────
async function buildLeaderboard(type, scope, guild, callerId) {
    // For server scope use the member cache — no gateway fetch needed
    let userIds = null;
    if (scope === 'server') {
        if (!guild) { scope = 'global'; }
        else {
            const cached = guild.members.cache.filter(m => !m.user.bot);
            userIds = cached.map(m => m.id);
            if (userIds.length === 0) return { empty: true };
        }
    }

    const rows = await db.getLeaderboard(type, userIds, 10);
    if (!rows.length) return { empty: true };

    const lines = rows.map((row, i) => {
        // Use cache only — never trigger a gateway/REST fetch per row
        const displayName = resolveName(row.user_id, guild, scope);
        const isYou = row.user_id === callerId ? ' *(you)*' : '';

        if (type === 'xp') {
            const level = getLevelFromXP(row.xp || 0);
            const tier  = getRankTier(level);
            return `${pos(i)} **${displayName}**${isYou}\n` +
                   `-# ${xp} ${(row.xp || 0).toLocaleString()} XP · Level ${level} · ${tier.name}`;
        }
        if (type === 'coins') {
            const total = (row.wallet || 0) + (row.bank || 0);
            return `${pos(i)} **${displayName}**${isYou}\n` +
                   `-# ${coin} ${total.toLocaleString()} · Wallet: ${(row.wallet || 0).toLocaleString()} · Bank: ${(row.bank || 0).toLocaleString()}`;
        }
        if (type === 'networth') {
            const net = (row.wallet || 0) + (row.bank || 0);
            return `${pos(i)} **${displayName}**${isYou}\n` +
                   `-# ${coin} ${net.toLocaleString()} · Total Earned: ${(row.total_earned || 0).toLocaleString()}`;
        }
    });

    const scopeLabel = scope === 'server' ? guild.name : 'Global';
    const typeLabel  = type === 'xp' ? 'XP' : type === 'coins' ? 'Coins' : 'Net Worth';

    const container = new ContainerBuilder()
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `## ${typeLabel} Leaderboard — ${scopeLabel}\n` +
                `-# Top ${rows.length} players · ${scope === 'server' ? 'Server' : 'All servers'}`
            )
        )
        .addSeparatorComponents(
            new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
        )
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(lines.join('\n\n'))
        );

    return { container, empty: false };
}

// ── Command ──────────────────────────────────────────────────────────────────
module.exports = {
    data: new SlashCommandBuilder()
        .setName('leaderboard')
        .setDescription('View the top players on the server or globally.')
        .addStringOption(opt =>
            opt.setName('type')
                .setDescription('What to rank by (default: XP)')
                .setRequired(false)
                .addChoices(
                    { name: 'XP',        value: 'xp'       },
                    { name: 'Coins',     value: 'coins'     },
                    { name: 'Net Worth', value: 'networth'  }
                )
        )
        .addStringOption(opt =>
            opt.setName('scope')
                .setDescription('Server leaderboard or global (default: server)')
                .setRequired(false)
                .addChoices(
                    { name: 'Server', value: 'server' },
                    { name: 'Global', value: 'global' }
                )
        ),

    async execute(interaction) {
        let type  = interaction.options.getString('type')  || 'xp';
        let scope = interaction.options.getString('scope') || 'server';
        if (scope === 'server' && !interaction.guild) scope = 'global';

        // Track the last-rendered type/scope so collector.on('end') can disable
        // the right buttons without making any new network calls
        let lastType  = type;
        let lastScope = scope;

        try {
            const result = await buildLeaderboard(type, scope, interaction.guild, interaction.user.id);

            if (result.empty) {
                return interaction.editReply({
                    content: 'No data found for this leaderboard yet.',
                    flags: MessageFlags.Ephemeral,
                });
            }

            result.container.addActionRowComponents(...buildButtons(type, scope));

            const response = await interaction.editReply({
                flags: MessageFlags.IsComponentsV2,
                components: [result.container],
            });

            // ── Button collector ─────────────────────────────────
            const collector = response.createMessageComponentCollector({
                filter: i => i.user.id === interaction.user.id,
                time: 120_000,
            });

            collector.on('collect', async i => {
                // lbt_<type>_<scope>  → switching type  (part1=type, part2=scope)
                // lbs_<type>_<scope>  → switching scope (part1=type, part2=scope)
                const parts    = i.customId.split('_');
                const newType  = parts[1];
                const newScope = parts[2];

                try {
                    const updated = await buildLeaderboard(
                        newType, newScope, interaction.guild, interaction.user.id
                    );

                    if (updated.empty) {
                        return i.reply({
                            content: 'No data found for this leaderboard.',
                            flags: MessageFlags.Ephemeral,
                        });
                    }

                    updated.container.addActionRowComponents(...buildButtons(newType, newScope));
                    await i.update({ flags: MessageFlags.IsComponentsV2, components: [updated.container] });

                    lastType  = newType;
                    lastScope = newScope;
                } catch (err) {
                    console.error('[LEADERBOARD BUTTON ERROR]', err);
                    await i.reply({
                        content: 'Failed to update leaderboard.',
                        flags: MessageFlags.Ephemeral,
                    }).catch(() => null);
                }
            });

            collector.on('end', async () => {
                // Just disable the buttons in-place — no data re-fetch needed
                try {
                    const final = await buildLeaderboard(
                        lastType, lastScope, interaction.guild, interaction.user.id
                    );
                    if (final.empty) return;
                    final.container.addActionRowComponents(...buildButtons(lastType, lastScope, true));
                    await interaction.editReply({
                        flags: MessageFlags.IsComponentsV2,
                        components: [final.container],
                    }).catch(() => null);
                } catch { /* ignore — message may have been deleted */ }
            });

        } catch (err) {
            console.error('[LEADERBOARD ERROR]', err);
            const msg = { content: 'Failed to fetch leaderboard.', flags: MessageFlags.Ephemeral };
            if (interaction.replied || interaction.deferred) await interaction.followUp(msg).catch(() => null);
            else await interaction.editReply(msg).catch(() => null);
        }
    },
};
