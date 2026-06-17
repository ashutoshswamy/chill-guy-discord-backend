const { Events } = require('discord.js');

module.exports = {
    name: Events.ClientReady,
    once: true,

    execute(client) {
        console.log(`[SUCCESS] Bot is online! Logged in as ${client.user.tag}`);

        if (client.user) {
            client.user.setActivity({
                name: 'just a chill guy 😎',
                type: 3, // ActivityType.Watching
            });
        }
    },
};
