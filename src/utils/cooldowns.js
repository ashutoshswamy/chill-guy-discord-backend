const cooldowns = new Map();

setInterval(() => {
    const now = Date.now();
    for (const [cmd, userMap] of cooldowns) {
        for (const [userId, expiry] of userMap) {
            if (expiry < now) userMap.delete(userId);
        }
        if (userMap.size === 0) cooldowns.delete(cmd);
    }
}, 10 * 60 * 1000);

function checkCooldown(commandName, userId, seconds) {
    if (!cooldowns.has(commandName)) cooldowns.set(commandName, new Map());
    const cmdMap = cooldowns.get(commandName);
    const now = Date.now();
    const cooldownMs = seconds * 1000;

    const expiry = cmdMap.get(userId);
    if (expiry && now < expiry) {
        const remaining = ((expiry - now) / 1000).toFixed(1);
        return { onCooldown: true, remaining };
    }

    cmdMap.set(userId, now + cooldownMs);
    return { onCooldown: false };
}

function getCooldownRemaining(commandName, userId) {
    if (!cooldowns.has(commandName)) return 0;
    const expiry = cooldowns.get(commandName).get(userId);
    if (!expiry) return 0;
    const remaining = expiry - Date.now();
    return remaining > 0 ? remaining : 0;
}

module.exports = { checkCooldown, getCooldownRemaining, cooldowns };
