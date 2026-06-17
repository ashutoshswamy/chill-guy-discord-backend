const {
    SlashCommandBuilder,
    ContainerBuilder, SectionBuilder, TextDisplayBuilder, ThumbnailBuilder,
    SeparatorBuilder, SeparatorSpacingSize, MessageFlags
} = require('discord.js');
const db = require('../../utils/db');
const { checkCooldown } = require('../../utils/cooldowns');
const { XP_REWARDS } = require('../../utils/xp');
const { getEmoji } = require('../../utils/emojis');

const coin = getEmoji('coin');

const SUCCESS_MSGS = [
    'You successfully cracked {target}\'s bank vault and transferred {coin} **{amount}** coins to your wallet.',
    'You bypassed the security protocols on {target}\'s bank account, siphoning {coin} **{amount}** coins.',
    'You drilled through the safety deposit boxes in {target}\'s bank branch, walking away with {coin} **{amount}** coins.',
];

const FAIL_MSGS = [
    'The bank security systems detected your breach. You were forced to pay a {coin} **{fine}** coin fee to settle the charges.',
    'The police arrested you inside {target}\'s bank vault. You paid a bail of {coin} **{fine}** coins.',
    'Your getaway driver panicked and left you behind. You dropped {coin} **{fine}** coins while bribing the local guards to escape.',
];

module.exports = {
    data: new SlashCommandBuilder()
        .setName('bankrob')
        .setDescription('Attempt to rob another user\'s bank. 15% success rate.')
        .addUserOption(opt =>
            opt.setName('target')
                .setDescription('User to rob')
                .setRequired(true)),

    async execute(interaction) {
        const { user } = interaction;
        const target = interaction.options.getUser('target');

        if (target.id === user.id) {
            return interaction.editReply({ content: 'Can\'t rob yourself.', ephemeral: true });
        }
        if (target.bot) {
            return interaction.editReply({ content: 'Bots have no bank accounts to steal from.', ephemeral: true });
        }

        const cd = checkCooldown(`bankrob_${user.id}`, target.id, 7200); // 2 hours target cooldown
        const globalCd = checkCooldown('bankrob', user.id, 3600); // 1 hour global cooldown
        
        if (globalCd.onCooldown) {
            return interaction.editReply({ content: `Lay low. Wait **${globalCd.remaining}s** before bank robbing again.`, ephemeral: true });
        }
        if (cd.onCooldown) {
            return interaction.editReply({ content: `Already bank robbed ${target.username} recently. Wait **${cd.remaining}s**.`, ephemeral: true });
        }

        try {
            const robberProfile = await db.getUser(user.id);
            const targetProfile = await db.getUser(target.id);

            if (targetProfile.bank < 500) {
                return interaction.editReply({ content: `${target.username} has too few coins in their bank (< 500 coins). Not worth the heist.`, ephemeral: true });
            }

            if (robberProfile.wallet < 300) {
                return interaction.editReply({ content: 'Need at least **300** coins in wallet to attempt a bank robbery (tools & gear cost).', ephemeral: true });
            }

            const success = Math.random() < 0.15; // 15% success rate

            let container;

            if (success) {
                const stealPercent = 0.05 + Math.random() * 0.10; // 5%-15%
                const stolen = Math.floor(targetProfile.bank * stealPercent);

                // Transfer target's bank coins to robber's wallet
                await db.updateBank(target.id, -stolen);
                await db.updateWallet(user.id, stolen);
                db.addXP(user.id, XP_REWARDS.robSuccess).catch(() => null);

                const updated = await db.getUser(user.id);
                const msg = SUCCESS_MSGS[Math.floor(Math.random() * SUCCESS_MSGS.length)]
                    .replace('{target}', target.username)
                    .replace('{amount}', stolen.toLocaleString())
                    .replace('{coin}', coin);

                container = new ContainerBuilder()
                    .addSectionComponents(
                        new SectionBuilder()
                            .addTextDisplayComponents(
                                new TextDisplayBuilder().setContent(`## Bank Heist Successful`)
                            )
                            .setThumbnailAccessory(new ThumbnailBuilder().setURL(user.displayAvatarURL({ forceStatic: true })))
                    )
                    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(
                            `${msg}\n\n` +
                            `**Stolen:** ${coin} +${stolen.toLocaleString()} coins (${Math.round(stealPercent * 100)}% of bank)\n` +
                            `**Your Wallet:** ${coin} ${updated.wallet.toLocaleString()} coins`
                        )
                    );
            } else {
                const finePercent = 0.10 + Math.random() * 0.15; // 10%-25%
                const fine = Math.floor(robberProfile.wallet * finePercent);
                const actualFine = Math.min(fine, robberProfile.wallet);

                await db.updateWallet(user.id, -actualFine);
                const updated = await db.getUser(user.id);

                const msg = FAIL_MSGS[Math.floor(Math.random() * FAIL_MSGS.length)]
                    .replace('{target}', target.username)
                    .replace('{fine}', actualFine.toLocaleString())
                    .replace('{coin}', coin);

                container = new ContainerBuilder()
                    .addSectionComponents(
                        new SectionBuilder()
                            .addTextDisplayComponents(
                                new TextDisplayBuilder().setContent(`## Bank Heist Failed`)
                            )
                            .setThumbnailAccessory(new ThumbnailBuilder().setURL(user.displayAvatarURL({ forceStatic: true })))
                    )
                    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(
                            `${msg}\n\n` +
                            `**Fine:** ${coin} -${actualFine.toLocaleString()} coins\n` +
                            `**Your Wallet:** ${coin} ${updated.wallet.toLocaleString()} coins`
                        )
                    );
            }

            await interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [container] });
        } catch (err) {
            console.error('[BANKROB ERROR]', err);
            const msg = { content: 'Bank robbery attempt failed.', ephemeral: true };
            if (interaction.replied || interaction.deferred) await interaction.followUp(msg).catch(() => null);
            else await interaction.editReply(msg).catch(() => null);
        }
    }
};
