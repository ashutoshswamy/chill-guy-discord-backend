const { SlashCommandBuilder, ContainerBuilder, TextDisplayBuilder, MessageFlags } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ping')
        .setDescription('Check bot latency.'),

    async execute(interaction) {
        const ws = interaction.client.ws.ping;
        const container = new ContainerBuilder()
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(`## Pong!\nWebSocket latency: **${ws}ms**`)
            );
        await interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [container] });
    },
};
