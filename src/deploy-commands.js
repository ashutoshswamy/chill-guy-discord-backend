require('dotenv').config();
const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');

const commands = [];
const commandsPath = path.join(__dirname, 'commands');

if (!fs.existsSync(commandsPath)) {
    console.error(`[ERROR] Commands directory not found at: ${commandsPath}`);
    process.exit(1);
}

const commandFolders = fs.readdirSync(commandsPath);

for (const folder of commandFolders) {
    const folderPath = path.join(commandsPath, folder);

    if (!fs.statSync(folderPath).isDirectory()) continue;

    const commandFiles = fs.readdirSync(folderPath).filter(file => file.endsWith('.js'));

    for (const file of commandFiles) {
        const filePath = path.join(folderPath, file);
        const command = require(filePath);

        if ('data' in command && 'execute' in command) {
            commands.push(command.data.toJSON());
        } else {
            console.warn(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
        }
    }
}

const token = process.env.TOKEN;
const clientId = process.env.CLIENT_ID;
const guildId = process.env.GUILD_ID;

if (!token || token === 'your_bot_token_here') {
    console.error('[ERROR] Set your actual TOKEN in the .env file!');
    process.exit(1);
}

if (!clientId || clientId === 'your_client_id_here') {
    console.error('[ERROR] Set your actual CLIENT_ID in the .env file!');
    process.exit(1);
}

const rest = new REST({ version: '10' }).setToken(token);

(async () => {
    try {
        console.log(`Started refreshing ${commands.length} application (/) commands.`);

        let data;
        if (guildId && guildId !== 'your_testing_guild_id_here' && guildId.trim() !== '') {
            console.log(`Deploying commands to Guild ID: ${guildId}...`);
            data = await rest.put(
                Routes.applicationGuildCommands(clientId, guildId),
                { body: commands },
            );
            console.log(`Successfully reloaded ${data.length} application (/) commands for Guild: ${guildId}.`);
        } else {
            console.log('No valid GUILD_ID found. Deploying commands GLOBALLY...');
            console.log('Note: Global commands can take up to an hour to propagate.');
            data = await rest.put(
                Routes.applicationCommands(clientId),
                { body: commands },
            );
            console.log(`Successfully reloaded ${data.length} global application (/) commands.`);
        }
    } catch (error) {
        console.error('[ERROR] Failed to deploy application commands:');
        console.error(error);
    }
})();
