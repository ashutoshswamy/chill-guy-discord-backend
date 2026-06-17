const {
    SlashCommandBuilder,
    ContainerBuilder, SectionBuilder, TextDisplayBuilder, ThumbnailBuilder,
    SeparatorBuilder, SeparatorSpacingSize, MessageFlags
} = require('discord.js');
const db   = require('../../utils/db');
const { getLevelFromXP, getXPProgress, getRankTier, xpBar } = require('../../utils/xp');
const { getJob, getRank }                                    = require('../../utils/jobs');
const { getPet, getRarityConfig, getEvolveStage }           = require('../../utils/pets');
const { getEmoji }                                           = require('../../utils/emojis');
const { getSellPrice }                                       = require('../../utils/items');

const coin = getEmoji('coin');
const xp   = getEmoji('xp');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('profile')
        .setDescription("View your (or another user's) full profile.")
        .addUserOption(opt =>
            opt.setName('user')
                .setDescription('User to view (defaults to yourself)')
                .setRequired(false)),

    async execute(interaction) {
        const target = interaction.options.getUser('user') || interaction.user;

        if (target.bot) {
            return interaction.editReply({ content: 'Bots don\'t have profiles.', ephemeral: true });
        }

        try {
            // ── Fetch all data in parallel ────────────────────────
            const [profile, activePet, userJob, rawInventory, portfolio] = await Promise.all([
                db.getUser(target.id),
                db.getActivePet(target.id),
                db.getUserJob(target.id),
                db.getInventory(target.id),
                db.getUserPortfolio(target.id),
            ]);

            // ── XP / Level ────────────────────────────────────────
            const totalXP  = profile.xp || 0;
            const level    = getLevelFromXP(totalXP);
            const tier     = getRankTier(level);
            const progress = getXPProgress(totalXP, level);
            const bar      = xpBar(progress.pct, 12);
            const nextInfo = level >= 9999
                ? 'MAX LEVEL'
                : `${progress.current.toLocaleString()} / ${progress.needed.toLocaleString()} ${xp}`;

            // ── Wealth ────────────────────────────────────────────
            const inventoryValue = rawInventory.reduce(
                (sum, inv) => sum + inv.quantity * getSellPrice(inv.item_name), 0
            );
            const stocksValue = portfolio.reduce((sum, h) => {
                const price = h.stocks ? h.stocks.current_price : 0;
                return sum + h.shares * price;
            }, 0);
            const netWorth = profile.wallet + profile.bank + inventoryValue + stocksValue;

            // ── Job ───────────────────────────────────────────────
            let jobLine = '*No job — use `/job apply` to get started!*';
            if (userJob) {
                const jobDef  = getJob(userJob.job_id);
                const rankDef = jobDef ? getRank(jobDef, userJob.rank) : null;
                const streak  = userJob.streak || 0;
                const prestige = userJob.prestige || 0;
                if (jobDef && rankDef) {
                    const prestigeStr = prestige > 0 ? ` — Prestige ${prestige}` : '';
                    jobLine =
                        `${jobDef.emoji} **${jobDef.name}** — ${rankDef.title}${prestigeStr}\n` +
                        `-# Streak: ${streak}  |  Works this rank: ${userJob.rank_work_count || 0}`;
                }
            }

            // ── Active Pet ────────────────────────────────────────
            let petLine = '*No active pet — use `/pet adopt` to get one!*';
            if (activePet) {
                const petDef   = getPet(activePet.pet_type);
                const rarCfg   = getRarityConfig(activePet.rarity);
                const evolve   = getEvolveStage(activePet.evolution_stage);
                if (petDef) {
                    petLine =
                        `${petDef.emoji} **${activePet.name}** *(${rarCfg.label} ${evolve.name})*\n` +
                        `-# Lv.${activePet.level}  HP: ${activePet.health}  Happiness: ${activePet.happiness}  Hunger: ${activePet.hunger}`;
                }
            }

            // ── Build Container ───────────────────────────────────
            const container = new ContainerBuilder()
                // Header: username + avatar
                .addSectionComponents(
                    new SectionBuilder()
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent(
                                `## ${target.username}\n` +
                                `**Level ${level}** · ${tier.name}`
                            )
                        )
                        .setThumbnailAccessory(
                            new ThumbnailBuilder().setURL(target.displayAvatarURL({ forceStatic: true }))
                        )
                )
                .addSeparatorComponents(
                    new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
                )
                // XP progress
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        `${xp} **XP**  \`[${bar}]\` ${Math.round(progress.pct * 100)}%\n` +
                        `${nextInfo}\n` +
                        `-# Total XP: ${totalXP.toLocaleString()}`
                    )
                )
                .addSeparatorComponents(
                    new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
                )
                // Wealth
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        `${coin} **Wallet:** ${profile.wallet.toLocaleString()}  ·  **Bank:** ${profile.bank.toLocaleString()}\n` +
                        `-# Net Worth: ${coin} ${netWorth.toLocaleString()}  |  Total Earned: ${coin} ${(profile.total_earned || 0).toLocaleString()}`
                    )
                )
                .addSeparatorComponents(
                    new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
                )
                // Job
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        `**Job**\n${jobLine}`
                    )
                )
                .addSeparatorComponents(
                    new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
                )
                // Active pet
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        `**Active Pet**\n${petLine}`
                    )
                );

            await interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [container] });

        } catch (err) {
            console.error('[PROFILE ERROR]', err);
            const msg = { content: 'Failed to load profile.', ephemeral: true };
            if (interaction.replied || interaction.deferred) await interaction.followUp(msg).catch(() => null);
            else await interaction.editReply(msg).catch(() => null);
        }
    },
};
