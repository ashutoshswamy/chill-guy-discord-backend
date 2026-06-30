const {
    SlashCommandBuilder,
    ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize,
    ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags
} = require('discord.js');

const BOT_ID = '1516531192353263738';
const VOTE_URL = `https://top.gg/bot/${BOT_ID}/vote`;

module.exports = {
    data: new SlashCommandBuilder()
        .setName('vote')
        .setDescription('Vote for Chill Guy on top.gg and earn rewards!'),

    async execute(interaction) {
        const container = new ContainerBuilder()
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `## Vote for Chill Guy!\n` +
                    `Support the bot by voting on **top.gg** every **12 hours**.\n\n` +
                    `**Rewards per vote:**\n` +
                    `> 🪙 **1,500 – 2,500** coins\n` +
                    `> ✨ **75** XP\n\n` +
                    `-# After voting, use \`/vote-reward\` to claim your reward!`
                )
            )
            .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(`-# Every vote helps the bot grow — thank you!`)
            );

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setLabel('Vote on top.gg')
                .setURL(VOTE_URL)
                .setStyle(ButtonStyle.Link)
        );

        await interaction.editReply({
            flags: MessageFlags.IsComponentsV2,
            components: [container, row],
        });
    },
};
