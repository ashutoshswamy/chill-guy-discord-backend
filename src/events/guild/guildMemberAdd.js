const { Events } = require('discord.js');

module.exports = {
    name: Events.GuildMemberAdd,
    once: false,

    async execute(member) {
        const { guild } = member;

        try {
            const systemChannel = guild.systemChannel;
            if (!systemChannel) return;

            await systemChannel.send(`Welcome to **${guild.name}**, ${member}! Stay chill 😎`);
        } catch (err) {
            console.error('[GUILD MEMBER ADD ERROR]', err);
        }
    },
};
