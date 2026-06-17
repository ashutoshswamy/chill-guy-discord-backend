const {
    SlashCommandBuilder,
    ContainerBuilder, SectionBuilder, TextDisplayBuilder, ThumbnailBuilder,
    SeparatorBuilder, SeparatorSpacingSize,
    ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags
} = require('discord.js');
const db = require('../../utils/db');
const { checkCooldown } = require('../../utils/cooldowns');
const { XP_REWARDS } = require('../../utils/xp');
const { getEmoji } = require('../../utils/emojis');

const coin = getEmoji('coin');

const CRIMES = {
    shoplift: {
        name: 'Shoplifting',
        successChance: 0.85,
        minCoins: 60,
        maxCoins: 150,
        fine: 30,
        successMessages: [
            'You snuck some premium snacks and energy drinks under your jacket. Sold them to a neighbor for **{amount}** coins.',
            'You grabbed a designer shirt and walked right past the sleeping guard. Sold it online for **{amount}** coins.'
        ],
        failMessages: [
            'The cashier saw you pocketing a candy bar. You paid a fine of {fine} coins to avoid the police.',
            'The anti-theft gates beeped as you walked out. You dropped some cash worth {fine} coins while running.'
        ]
    },
    atm: {
        name: 'ATM Hacking',
        successChance: 0.55,
        minCoins: 250,
        maxCoins: 600,
        fine: 150,
        successMessages: [
            'You attached a card skimmer to the local ATM and harvested **{amount}** coins.',
            'You successfully bypassed the ATM’s hardware diagnostic mode and forced it to spit out **{amount}** coins!'
        ],
        failMessages: [
            'A security guard caught you tampering with the card reader. You bribed them with {fine} coins to look the other way.',
            'The ATM locked up and captured your tools. The system recovery cost you {fine} coins.'
        ]
    },
    gta: {
        name: 'Grand Theft Auto',
        successChance: 0.35,
        minCoins: 700,
        maxCoins: 1800,
        fine: 450,
        successMessages: [
            'You hotwired a parked sports car and delivered it to the chop shop, netting **{amount}** coins.',
            'You jacked a luxury SUV and sold its premium sound system and parts for **{amount}** coins.'
        ],
        failMessages: [
            'The car alarm started blaring, alerting the neighbors. In your rush to escape, you dropped your wallet containing {fine} coins.',
            'A police cruiser spotted you driving a stolen vehicle. You had to abandon it and pay {fine} coins to clear your record.'
        ]
    },
    heist: {
        name: 'Casino Heist',
        successChance: 0.15,
        minCoins: 2500,
        maxCoins: 6000,
        fine: 1500,
        successMessages: [
            'You cracked the casino vault using a drill and escaped in a getaway chopper with **{amount}** coins!',
            'You hacked the casino’s mainframe during a distraction, routing **{amount}** coins into your offshore account.'
        ],
        failMessages: [
            'Silent alarms went off inside the vault room. You got cornered by security and had to pay a massive bail of {fine} coins.',
            'Your hacker teammate disconnected halfway through the heist. You were forced to ditch the loot and pay {fine} coins to the fixer.'
        ]
    }
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('crime')
        .setDescription('Commit a crime for high rewards. High risk can lead to heavy fines!'),

    async execute(interaction) {
        const { user } = interaction;

        const cd = checkCooldown('crime', user.id, 45);
        if (cd.onCooldown) {
            return interaction.editReply({ content: `The cops are patrolling! Wait **${cd.remaining}s** before planning another crime.`, ephemeral: true });
        }

        try {
            const container = new ContainerBuilder()
                .addSectionComponents(
                    new SectionBuilder()
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent(
                                `## Syndicate Board\nChoose your operation below. High risk offers greater payouts but carries severe fines.`
                            )
                        )
                        .setThumbnailAccessory(new ThumbnailBuilder().setURL(user.displayAvatarURL({ forceStatic: true })))
                );

            const buttons = Object.keys(CRIMES).map(key => {
                const crime = CRIMES[key];
                const chancePct = Math.round(crime.successChance * 100);
                return new ButtonBuilder()
                    .setCustomId(`crime_op_${key}`)
                    .setLabel(`${crime.name} (${chancePct}% Win)`)
                    .setStyle(ButtonStyle.Primary);
            });

            // Put buttons in action row
            container.addActionRowComponents(new ActionRowBuilder().addComponents(buttons));

            const response = await interaction.editReply({
                flags: MessageFlags.IsComponentsV2,
                components: [container]
            });

            const collector = response.createMessageComponentCollector({
                filter: i => i.user.id === user.id,
                time: 30_000
            });

            collector.on('collect', async i => {
                await i.deferUpdate();
                collector.stop('selected');

                const key = i.customId.replace('crime_op_', '');
                const op = CRIMES[key];

                const success = Math.random() < op.successChance;
                let resultMsg = '';
                let details = '';

                if (success) {
                    const payout = Math.floor(Math.random() * (op.maxCoins - op.minCoins + 1)) + op.minCoins;
                    await db.updateWallet(user.id, payout);
                    db.addXP(user.id, XP_REWARDS.robSuccess || 30).catch(() => null);

                    const rawMsg = op.successMessages[Math.floor(Math.random() * op.successMessages.length)];
                    resultMsg = rawMsg.replace('{amount}', `${coin} ${payout.toLocaleString()}`);
                    details = `**Payout:** ${coin} **+${payout.toLocaleString()}** coins`;
                } else {
                    const fine = op.fine;
                    await db.updateWallet(user.id, -fine);
                    const rawMsg = op.failMessages[Math.floor(Math.random() * op.failMessages.length)];
                    resultMsg = rawMsg.replace('{fine}', `${coin} ${fine.toLocaleString()}`);
                    details = `**Result:** Operation Failed.\n**Fine Paid:** ${coin} **-${fine.toLocaleString()}** coins`;
                }

                const updated = await db.getUser(user.id);
                details += `\n**Wallet:** ${coin} ${updated.wallet.toLocaleString()} coins`;

                const finalContainer = new ContainerBuilder()
                    .addSectionComponents(
                        new SectionBuilder()
                            .addTextDisplayComponents(
                                new TextDisplayBuilder().setContent(
                                    `## Crime: ${op.name}\n${resultMsg}`
                                )
                            )
                            .setThumbnailAccessory(new ThumbnailBuilder().setURL(user.displayAvatarURL({ forceStatic: true })))
                    )
                    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
                    .addTextDisplayComponents(new TextDisplayBuilder().setContent(details));

                // Re-render disabled buttons showing result color for the chosen button
                const disabledButtons = Object.keys(CRIMES).map(k => {
                    const isChoice = k === key;
                    let style = ButtonStyle.Secondary;
                    if (isChoice) {
                        style = success ? ButtonStyle.Success : ButtonStyle.Danger;
                    }
                    return new ButtonBuilder()
                        .setCustomId(`crime_op_dis_${k}`)
                        .setLabel(CRIMES[k].name)
                        .setStyle(style)
                        .setDisabled(true);
                });

                finalContainer.addActionRowComponents(new ActionRowBuilder().addComponents(disabledButtons));

                await interaction.editReply({
                    flags: MessageFlags.IsComponentsV2,
                    components: [finalContainer]
                }).catch(() => null);
            });

            collector.on('end', async (_, reason) => {
                if (reason === 'time') {
                    const finalContainer = new ContainerBuilder()
                        .addSectionComponents(
                            new SectionBuilder()
                                .addTextDisplayComponents(
                                    new TextDisplayBuilder().setContent(`## Syndicate Board\n*(Timed out - no operation selected)*`)
                                )
                        );

                    const disabledButtons = Object.keys(CRIMES).map(k =>
                        new ButtonBuilder()
                            .setCustomId(`crime_op_dis_${k}`)
                            .setLabel(CRIMES[k].name)
                            .setStyle(ButtonStyle.Secondary)
                            .setDisabled(true)
                    );

                    finalContainer.addActionRowComponents(new ActionRowBuilder().addComponents(disabledButtons));
                    await interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [finalContainer] }).catch(() => null);
                }
            });

        } catch (err) {
            console.error('[CRIME ERROR]', err);
            const msg = { content: 'Syndicate command failed.', ephemeral: true };
            if (interaction.replied || interaction.deferred) await interaction.followUp(msg).catch(() => null);
            else await interaction.editReply(msg).catch(() => null);
        }
    }
};
