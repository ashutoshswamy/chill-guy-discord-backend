const { Events } = require('discord.js');

module.exports = {
    name: Events.InteractionCreate,

    async execute(interaction, client) {
        if (!interaction.isChatInputCommand()) return;

        const command = client.commands.get(interaction.commandName);

        if (!command) {
            console.error(`[WARNING] No command matching /${interaction.commandName} was found.`);
            return;
        }

        if (!interaction.guild) {
            return interaction.reply({ content: 'This command can only be used inside a server.', ephemeral: true });
        }

        if (!command.noDefer) {
            try {
                await interaction.deferReply();
            } catch (err) {
                console.error(`[ERROR] Failed to auto-defer command /${interaction.commandName}:`, err);
                return;
            }
        }

        try {
            await command.execute(interaction);
        } catch (error) {
            console.error(`[ERROR] Error executing command /${interaction.commandName}:`, error);

            const errorMessage = { content: 'There was an error while executing this command!', ephemeral: true };

            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(errorMessage).catch(console.error);
            } else {
                await interaction.reply(errorMessage).catch(console.error);
            }
        }
    },
};
