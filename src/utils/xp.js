// XP needed to go from level N to N+1: 100 + (N * 50)
// Total XP to reach level N: sum(i=0..N-1) of (100 + i*50) = 100N + 25N(N-1)

const RANK_TIERS = [
    { minLevel: 100, name: 'Mythic',   emoji: '' },
    { minLevel: 75,  name: 'Legend',   emoji: '' },
    { minLevel: 50,  name: 'Emerald',  emoji: '' },
    { minLevel: 35,  name: 'Diamond',  emoji: '' },
    { minLevel: 20,  name: 'Gold',     emoji: '' },
    { minLevel: 10,  name: 'Silver',   emoji: '' },
    { minLevel: 5,   name: 'Bronze',   emoji: '' },
    { minLevel: 1,   name: 'Sprout',   emoji: '' },
];

// XP rewards per activity
const XP_REWARDS = {
    work:         (rank) => 40 + rank * 8,
    workPromote:  30,
    daily:        50,
    weekly:       150,
    monthly:      400,
    beg:          10,
    gamblingWin:  20,
    robSuccess:   30,
    lotteryWin:   150,
};

function xpToReachLevel(level) {
    if (level <= 1) return 0;
    const n = level - 1;
    return 100 * n + 25 * n * (n - 1);
}

function xpForNextLevel(level) {
    return 100 + (level - 1) * 50;
}

function getLevelFromXP(totalXP) {
    let level = 1;
    while (totalXP >= xpToReachLevel(level + 1)) {
        level++;
        if (level >= 9999) break;
    }
    return level;
}

function getXPProgress(totalXP, level) {
    const startXP = xpToReachLevel(level);
    const needed  = xpForNextLevel(level);
    const current = totalXP - startXP;
    return { current, needed, pct: Math.min(current / needed, 1) };
}

function getRankTier(level) {
    for (const tier of RANK_TIERS) {
        if (level >= tier.minLevel) return tier;
    }
    return RANK_TIERS[RANK_TIERS.length - 1];
}

function xpBar(pct, len = 12) {
    const filled = Math.round(pct * len);
    return '█'.repeat(filled) + '░'.repeat(len - filled);
}

// Job pay multiplier: +1% per level
function getJobPayMultiplier(level) {
    return 1 + (level * 0.01);
}

module.exports = {
    XP_REWARDS,
    xpToReachLevel,
    xpForNextLevel,
    getLevelFromXP,
    getXPProgress,
    getRankTier,
    xpBar,
    getJobPayMultiplier,
};
