const { Events } = require('discord.js');

module.exports = {
    name: Events.MessageCreate,
    once: false,

    async execute(message, client) {
        if (message.author.bot || !message.guild) return;
    },
};
