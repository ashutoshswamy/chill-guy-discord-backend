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

const CHOICES = ['rock', 'paper', 'scissors'];
const EMOJI = { rock: 'Rock', paper: 'Paper', scissors: 'Scissors' };

function getResult(player, bot) {
    if (player === bot) return 'tie';
    if (
        (player === 'rock'     && bot === 'scissors') ||
        (player === 'scissors' && bot === 'paper')   ||
        (player === 'paper'    && bot === 'rock')
    ) return 'win';
    return 'lose';
}

module.exports = {
    cooldown: 5,
    data: new SlashCommandBuilder()
        .setName('rps')
        .setDescription('Rock Paper Scissors against the bot. Win = 2x, tie = refund.')
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

            const container = new ContainerBuilder()
                .addSectionComponents(
                    new SectionBuilder()
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent(
                                `## Rock Paper Scissors\nBet: ${coin} **${amount.toLocaleString()}** coins - Pick your move!`
                            )
                        )
                        .setThumbnailAccessory(new ThumbnailBuilder().setURL(user.displayAvatarURL({ forceStatic: true })))
                )
                .addActionRowComponents(
                    new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId('rps_rock').setLabel('Rock').setStyle(ButtonStyle.Secondary),
                        new ButtonBuilder().setCustomId('rps_paper').setLabel('Paper').setStyle(ButtonStyle.Secondary),
                        new ButtonBuilder().setCustomId('rps_scissors').setLabel('Scissors').setStyle(ButtonStyle.Secondary),
                    )
                );

            const response = await interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [container] });

            const collector = response.createMessageComponentCollector({
                filter: i => i.user.id === user.id,
                time: 30_000,
                max: 1,
            });

            collector.on('collect', async i => {
                await i.deferUpdate();

                const playerChoice = i.customId.replace('rps_', '');
                const botChoice = CHOICES[Math.floor(Math.random() * 3)];
                const result = getResult(playerChoice, botChoice);

                let net = 0;
                if (result === 'win') net = amount;
                else if (result === 'lose') net = -amount;

                await db.updateWallet(user.id, net);
                if (result === 'win') db.addXP(user.id, XP_REWARDS.gamblingWin).catch(() => null);
                const updated = await db.getUser(user.id);

                const resultLabel = result === 'win' ? 'You Win!' : result === 'lose' ? 'You Lose!' : 'Tie!';

                const final = new ContainerBuilder()
                    .addSectionComponents(
                        new SectionBuilder()
                            .addTextDisplayComponents(
                                new TextDisplayBuilder().setContent(`## ${resultLabel}`)
                            )
                            .setThumbnailAccessory(new ThumbnailBuilder().setURL(user.displayAvatarURL({ forceStatic: true })))
                    )
                    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(
                            `${EMOJI[playerChoice]} **You:** ${playerChoice}\n` +
                            `${EMOJI[botChoice]} **Bot:** ${botChoice}\n\n` +
                            `${result === 'win'  ? `**Won:** ${coin} +${amount.toLocaleString()} coins` :
                               result === 'lose' ? `**Lost:** ${coin} -${amount.toLocaleString()} coins` :
                                                   `**Returned:** ${coin} ${amount.toLocaleString()} coins`}\n` +
                            `**Wallet:** ${coin} ${updated.wallet.toLocaleString()} coins`
                        )
                    );

                await interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [final] }).catch(() => null);
            });

            collector.on('end', async (_, reason) => {
                if (reason === 'time') {
                    const expired = new ContainerBuilder()
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent('RPS expired - no move made, no coins lost.')
                        );
                    await interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [expired] }).catch(() => null);
                }
            });

        } catch (err) {
            console.error('[RPS ERROR]', err);
            const msg = { content: 'RPS failed.', ephemeral: true };
            if (interaction.replied || interaction.deferred) await interaction.followUp(msg).catch(() => null);
            else await interaction.editReply(msg).catch(() => null);
        }
    }
};
