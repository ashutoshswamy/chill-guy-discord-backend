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

const COLORS = [
    { name: 'Red', emoji: '', id: 'red', style: ButtonStyle.Danger },
    { name: 'Blue', emoji: '', id: 'blue', style: ButtonStyle.Primary },
    { name: 'Green', emoji: '', id: 'green', style: ButtonStyle.Success },
    { name: 'Yellow', emoji: '', id: 'yellow', style: ButtonStyle.Secondary } // Yellow uses Secondary style (greyish/yellow-ish in some clients, but standard buttons work)
];

function getRandomSequence(length = 4) {
    const seq = [];
    for (let i = 0; i < length; i++) {
        const choice = COLORS[Math.floor(Math.random() * COLORS.length)];
        seq.push(choice);
    }
    return seq;
}

function buildHackContainer(user, targetSeq, currentSeq, status, payout = 0, wallet = 0, timeRemaining = 15) {
    const isSuccess = status === 'success';
    const isFailed = status === 'failed';
    const isTimeout = status === 'timeout';
    const isLive = status === 'live';

    const targetDisplay = targetSeq.map(c => c.name.toUpperCase()).join(' - ');
    const currentDisplay = currentSeq.length > 0 
        ? currentSeq.map(c => c.name.toUpperCase()).join(' - ') 
        : '*Enter sequence...*';

    let header = 'Mainframe Hacking...';
    let contentStr = '';

    if (isLive) {
        contentStr = `**Bypass the Firewall!**\n` +
            `Match the target encryption key by tapping the color buttons in the exact order.\n\n` +
            `**Target Key:** ${targetDisplay}\n` +
            `**Your Input:** ${currentDisplay}\n` +
            `**Progress:** ${currentSeq.length} / ${targetSeq.length}\n` +
            `**Time Left:** ${timeRemaining}s`;
    } else if (isSuccess) {
        header = 'Hack Successful!';
        contentStr = `**Mainframe breached!**\n` +
            `You bypassed the security logs and routed local assets to your wallet.\n\n` +
            `**Target Key:** ${targetDisplay}\n` +
            `**Your Input:** ${currentDisplay}\n\n` +
            `**Earned:** ${coin} **+${payout.toLocaleString()}** coins\n` +
            `**Wallet:** ${coin} ${wallet.toLocaleString()} coins`;
    } else if (isFailed) {
        header = 'Hack Failed!';
        contentStr = `**Intrusion detected!**\n` +
            `You entered the wrong key sequence and the firewall shut down your terminal.\n\n` +
            `**Target Key:** ${targetDisplay}\n` +
            `**Your Input:** ${currentDisplay} [Failed]\n\n` +
            `-# No coins earned. Security logs have cleared. Try again later.`;
    } else if (isTimeout) {
        header = 'Hack Timeout!';
        contentStr = `**Connection timed out.**\n` +
            `You took too long to complete the bypass and the target system closed the connection.\n\n` +
            `**Target Key:** ${targetDisplay}\n` +
            `**Your Input:** ${currentDisplay}\n\n` +
            `-# No coins earned.`;
    }

    const container = new ContainerBuilder()
        .addSectionComponents(
            new SectionBuilder()
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(`## ${header}`)
                )
                .setThumbnailAccessory(new ThumbnailBuilder().setURL(user.displayAvatarURL({ forceStatic: true })))
        )
        .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(contentStr)
        );

    // Build the color buttons
    const row = new ActionRowBuilder();
    COLORS.forEach(c => {
        const btn = new ButtonBuilder()
            .setCustomId(`hack_btn_${c.id}`)
            .setLabel(c.name)
            .setStyle(c.style)
            .setDisabled(!isLive);
        if (c.emoji) btn.setEmoji(c.emoji);
        row.addComponents(btn);
    });
    container.addActionRowComponents(row);

    return container;
}

const COOLDOWN_MS = 600 * 1000;

module.exports = {
    data: new SlashCommandBuilder()
        .setName('hack')
        .setDescription('Breach a secure mainframe by matching the sequence. High payout, requires skill!'),

    async execute(interaction) {
        const { user } = interaction;

        const cd = await db.checkAndSetCooldown(user.id, 'hack', COOLDOWN_MS);
        if (cd.onCooldown) {
            const m = Math.floor(cd.remaining / 60000), s = Math.floor((cd.remaining % 60000) / 1000);
            return interaction.editReply({ content: `On cooldown! Try again in **${m}m ${s}s**.`, ephemeral: true });
        }

        try {
            const targetSeq = getRandomSequence(4);
            const currentSeq = [];
            let status = 'live';
            let timeRemaining = 15;

            const container = buildHackContainer(user, targetSeq, currentSeq, 'live', 0, 0, timeRemaining);
            const response = await interaction.editReply({
                flags: MessageFlags.IsComponentsV2,
                components: [container]
            });

            const collector = response.createMessageComponentCollector({
                filter: i => i.user.id === user.id && i.customId.startsWith('hack_btn_'),
                time: 15_000
            });

            // Countdown timer visual update
            const timerInterval = setInterval(async () => {
                if (status !== 'live') {
                    clearInterval(timerInterval);
                    return;
                }
                timeRemaining--;
                if (timeRemaining <= 0) {
                    clearInterval(timerInterval);
                    return;
                }
                const liveContainer = buildHackContainer(user, targetSeq, currentSeq, 'live', 0, 0, timeRemaining);
                await interaction.editReply({
                    flags: MessageFlags.IsComponentsV2,
                    components: [liveContainer]
                }).catch(() => null);
            }, 1000);

            collector.on('collect', async i => {
                await i.deferUpdate();

                if (status !== 'live') return;

                const colorId = i.customId.replace('hack_btn_', '');
                const chosenColor = COLORS.find(c => c.id === colorId);

                // Add to current sequence
                currentSeq.push(chosenColor);

                // Verify match
                const currentIndex = currentSeq.length - 1;
                if (chosenColor.id !== targetSeq[currentIndex].id) {
                    // Fail!
                    status = 'failed';
                    collector.stop('incorrect');
                    return;
                }

                // Check win condition
                if (currentSeq.length === targetSeq.length) {
                    // Win!
                    status = 'success';
                    collector.stop('success');
                    return;
                }

                // Continue playing
                const updatedContainer = buildHackContainer(user, targetSeq, currentSeq, 'live', 0, 0, timeRemaining);
                await interaction.editReply({
                    flags: MessageFlags.IsComponentsV2,
                    components: [updatedContainer]
                }).catch(() => null);
            });

            collector.on('end', async (collected, reason) => {
                clearInterval(timerInterval);

                let payout = 0;
                let wallet = 0;

                try {
                    if (reason === 'success' || status === 'success') {
                        status = 'success';
                        payout = Math.floor(Math.random() * 600) + 400; // 400 - 1000 coins
                        await db.updateWallet(user.id, payout);
                        db.addXP(user.id, XP_REWARDS.workPromote || 30).catch(() => null);
                        const profile = await db.getUser(user.id);
                        wallet = profile.wallet;
                    } else if (reason === 'time') {
                        status = 'timeout';
                    } else {
                        status = 'failed';
                    }

                    const finalContainer = buildHackContainer(user, targetSeq, currentSeq, status, payout, wallet, 0);
                    await interaction.editReply({
                        flags: MessageFlags.IsComponentsV2,
                        components: [finalContainer]
                    }).catch(() => null);
                } catch (dbErr) {
                    console.error('[HACK DB ERROR]', dbErr);
                }
            });

        } catch (err) {
            console.error('[HACK ERROR]', err);
            const msg = { content: 'Hack interface failure.', ephemeral: true };
            if (interaction.replied || interaction.deferred) await interaction.followUp(msg).catch(() => null);
            else await interaction.editReply(msg).catch(() => null);
        }
    }
};
