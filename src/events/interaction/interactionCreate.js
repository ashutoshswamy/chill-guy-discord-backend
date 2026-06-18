const { Events } = require('discord.js');
const { checkCooldown } = require('../../utils/cooldowns');

function formatCooldown(seconds) {
    const s = parseFloat(seconds);
    if (s >= 3600) return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
    if (s >= 60)   return `${Math.floor(s / 60)}m ${Math.floor(s % 60)}s`;
    return `${s.toFixed(1)}s`;
}

module.exports = {
    name: Events.InteractionCreate,

    async execute(interaction, client) {
        if (interaction.isAutocomplete()) {
            const command = client.commands.get(interaction.commandName);
            if (command && command.autocomplete) {
                try {
                    await command.autocomplete(interaction);
                } catch (err) {
                    console.error(`[ERROR] Autocomplete failed for command /${interaction.commandName}:`, err);
                }
            }
            return;
        }

        if (!interaction.isChatInputCommand()) return;

        const command = client.commands.get(interaction.commandName);

        if (!command) {
            console.error(`[WARNING] No command matching /${interaction.commandName} was found.`);
            return;
        }

        if (!interaction.guild) {
            return interaction.reply({ content: 'This command can only be used inside a server.', ephemeral: true });
        }

        // Central cooldown check — commands declare `cooldown: <seconds>`
        if (command.cooldown) {
            const cd = checkCooldown(interaction.commandName, interaction.user.id, command.cooldown);
            if (cd.onCooldown) {
                return interaction.reply({
                    content: `You're on cooldown! Try again in **${formatCooldown(cd.remaining)}**.`,
                    ephemeral: true,
                });
            }
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
