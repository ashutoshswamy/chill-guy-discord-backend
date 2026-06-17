require('dotenv').config();
const { Client, GatewayIntentBits, Collection } = require('discord.js');
const http = require('http');

const PORT = process.env.PORT || 3000;
http.createServer((req, res) => res.end('OK')).listen(PORT);

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ],
});

client.commands = new Collection();

console.log('Initializing bot handlers...');
require('./handlers/commandHandler')(client);
require('./handlers/eventHandler')(client);

client.on('error', error => {
    console.error('[DISCORD CLIENT ERROR]', error);
});

process.on('unhandledRejection', error => {
    console.error('[UNHANDLED REJECTION]', error);
});

process.on('uncaughtException', error => {
    console.error('[UNCAUGHT EXCEPTION]', error);
    process.exit(1);
});

function gracefulShutdown(signal) {
    console.log(`[SHUTDOWN] ${signal} received — closing gracefully`);
    client.destroy();
    process.exit(0);
}
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

if (!process.env.TOKEN || process.env.TOKEN === 'your_bot_token_here') {
    console.error('[ERROR] Set your actual bot TOKEN in the .env file!');
    process.exit(1);
}

client.login(process.env.TOKEN).catch(err => {
    console.error('[ERROR] Failed to log in. Check your TOKEN in .env.');
    console.error(err);
});
