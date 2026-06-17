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
    'You snuck into {target}\'s place while they were AFK and lifted {coin} **{amount}** coins.',
    'You pickpocketed {target} at the market. Walked away with {coin} **{amount}** coins.',
    'You hacked {target}\'s digital wallet and transferred {coin} **{amount}** coins.',
    'While {target} was sleeping, you raided their stash for {coin} **{amount}** coins.',
];

const FAIL_MSGS = [
    '{target} caught you red-handed and called the cops. You paid a {coin} **{fine}** coin fine.',
    'You tripped an alarm at {target}\'s place. Lost {coin} **{fine}** coins to the authorities.',
    '{target} was awake and jumped you. You fled, dropping {coin} **{fine}** coins.',
    'Security caught you. You were fined {coin} **{fine}** coins for attempted robbery.',
];

module.exports = {
    data: new SlashCommandBuilder()
        .setName('rob')
        .setDescription('Attempt to rob another user\'s wallet. 40% success rate.')
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
            return interaction.editReply({ content: 'Bots have no coins to steal.', ephemeral: true });
        }

        const cd = checkCooldown(`rob_${user.id}`, target.id, 120);
        const globalCd = checkCooldown('rob', user.id, 60);
        if (globalCd.onCooldown) {
            return interaction.editReply({ content: `Lay low. Wait **${globalCd.remaining}s** before robbing again.`, ephemeral: true });
        }
        if (cd.onCooldown) {
            return interaction.editReply({ content: `Already robbed ${target.username} recently. Wait **${cd.remaining}s**.`, ephemeral: true });
        }

        try {
            const robberProfile = await db.getUser(user.id);
            const targetProfile = await db.getUser(target.id);

            if (targetProfile.wallet < 50) {
                return interaction.editReply({ content: `${target.username} is broke (< 50 coins in wallet). Not worth it.`, ephemeral: true });
            }

            if (robberProfile.wallet < 100) {
                return interaction.editReply({ content: 'Need at least **100** coins in wallet to attempt a rob (bail money).', ephemeral: true });
            }

            const success = Math.random() < 0.40;

            let container;

            if (success) {
                const stealPercent = 0.10 + Math.random() * 0.25; // 10%-35%
                const stolen = Math.floor(targetProfile.wallet * stealPercent);

                await db.updateWallet(target.id, -stolen);
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
                                new TextDisplayBuilder().setContent(`## Robbery Successful`)
                            )
                            .setThumbnailAccessory(new ThumbnailBuilder().setURL(user.displayAvatarURL({ forceStatic: true })))
                    )
                    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(
                            `${msg}\n\n` +
                            `**Stolen:** ${coin} +${stolen.toLocaleString()} coins (${Math.round(stealPercent * 100)}% of wallet)\n` +
                            `**Your Wallet:** ${coin} ${updated.wallet.toLocaleString()} coins`
                        )
                    );
            } else {
                const finePercent = 0.15 + Math.random() * 0.15; // 15%-30%
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
                                new TextDisplayBuilder().setContent(`## Robbery Failed`)
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
            console.error('[ROB ERROR]', err);
            const msg = { content: 'Rob attempt failed.', ephemeral: true };
            if (interaction.replied || interaction.deferred) await interaction.followUp(msg).catch(() => null);
            else await interaction.editReply(msg).catch(() => null);
        }
    }
};
