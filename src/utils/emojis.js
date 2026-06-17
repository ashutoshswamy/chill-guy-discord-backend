const EMOJIS = {
    "coin": "<:chillcoin:1516875454898765964>",
    "xp": "<:chillxp:1516927254586724392>"
};

function getEmoji(name) {
    if (!name) return '';
    return EMOJIS[name.toLowerCase().trim()] || '';
}

module.exports = { EMOJIS, getEmoji };
