const QUEST_POOL = [
    {
        id: 'work_daily',
        description: 'Perform /work 2 times today',
        type: 'work',
        target: 2,
        rewardCoins: 1500,
        rewardXP: 100
    },
    {
        id: 'fish_daily',
        description: 'Cast /fish 5 times today',
        type: 'fish',
        target: 5,
        rewardCoins: 1200,
        rewardXP: 80
    },
    {
        id: 'mine_daily',
        description: 'Swing your pickaxe in /mine 5 times today',
        type: 'mine',
        target: 5,
        rewardCoins: 1200,
        rewardXP: 80
    },
    {
        id: 'gamble_daily',
        description: 'Play any gambling command 5 times today',
        type: 'gamble',
        target: 5,
        rewardCoins: 1000,
        rewardXP: 60
    },
    {
        id: 'trivia_daily',
        description: 'Correctly answer /trivia 2 times today',
        type: 'trivia',
        target: 2,
        rewardCoins: 1200,
        rewardXP: 80
    }
];

function generateQuestsForUser() {
    // Pick 3 random distinct quests
    const shuffled = [...QUEST_POOL].sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, 3);
    const expiresAt = new Date();
    expiresAt.setHours(24, 0, 0, 0); // End of current day

    return selected.map(q => ({
        quest_id: q.id,
        description: q.description,
        quest_type: q.type,
        progress: 0,
        target: q.target,
        reward_coins: q.rewardCoins,
        reward_xp: q.rewardXP,
        completed: false,
        expires_at: expiresAt.toISOString()
    }));
}

module.exports = { QUEST_POOL, generateQuestsForUser };
