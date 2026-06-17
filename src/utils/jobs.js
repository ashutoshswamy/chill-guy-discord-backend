const WORKS_PER_RANK    = 15;
const WORK_COOLDOWN_MS  = 60 * 60 * 1000;       // 1 hour
const STREAK_WINDOW_MS  = 2 * 60 * 60 * 1000;   // streak breaks if > 2h gap
const MAX_STREAK        = 10;
const STREAK_BONUS_PER  = 0.03;                  // +3% per streak level
const MAX_PRESTIGE      = 5;
const PRESTIGE_BONUS    = 0.10;                  // +10% permanent per prestige

// Shift event pool — weights sum to 100
const SHIFT_EVENTS = [
    { id: 'normal',   label: 'Normal Shift',     weight: 55, multiplier: 1.0  },
    { id: 'bonus',    label: 'Bonus Shift',       weight: 25, multiplier: 1.5  },
    { id: 'jackpot',  label: 'Jackpot Shift',     weight: 8,  multiplier: 3.0  },
    { id: 'fail',     label: 'Critical Fail',     weight: 12, multiplier: 0.0  },
];

// Rank perks — index matches rank index
const BASE_RANK_PERKS = [
    null,
    { name: 'Steady Income',   desc: '+5% flat pay per shift',                  payBonus: 0.05 },
    { name: 'Efficiency',      desc: '+10% flat pay, streak window → 2.5h',     payBonus: 0.10, streakWindow: 2.5 * 60 * 60 * 1000 },
    { name: 'Expert',          desc: '+20% flat pay, +5% bonus event weight',   payBonus: 0.20, bonusWeight: 5   },
    { name: 'Elite',           desc: '+30% flat pay, jackpot weight doubled',   payBonus: 0.30, jackpotDouble: true },
];

const JOBS = {
    janitor: {
        id: 'janitor', name: 'Janitor', emoji: '',
        description: 'Keep the place clean. Humble beginnings.',
        ranks: [
            { title: 'Trainee',            pay: [150, 300],   bonus: 0,     levelReq: 1  },
            { title: 'Junior Janitor',     pay: [280, 480],   bonus: 750,   levelReq: 5  },
            { title: 'Senior Janitor',     pay: [430, 680],   bonus: 1500,  levelReq: 10 },
            { title: 'Head Janitor',       pay: [600, 900],   bonus: 3000,  levelReq: 15 },
            { title: 'Sanitation Manager', pay: [800, 1200],  bonus: 6000,  levelReq: 20 },
        ],
        workMessages: [
            'You mopped the floors so hard the tiles asked for a break.',
            'You unclogged a drain that has been clogged since 2019.',
            'You cleaned the break room. Three people cried.',
            'You polished the lobby windows until they were invisible.',
            'You restocked the soap dispenser. Small win. Still a win.',
        ],
    },
    cook: {
        id: 'cook', name: 'Cook', emoji: '',
        description: 'From dishwasher to executive chef.',
        ranks: [
            { title: 'Dishwasher',     pay: [200, 400],   bonus: 0,     levelReq: 3  },
            { title: 'Line Cook',      pay: [380, 620],   bonus: 1000,  levelReq: 8  },
            { title: 'Sous Chef',      pay: [580, 900],   bonus: 2000,  levelReq: 15 },
            { title: 'Head Chef',      pay: [850, 1300],  bonus: 4000,  levelReq: 22 },
            { title: 'Executive Chef', pay: [1200, 1800], bonus: 8000,  levelReq: 30 },
        ],
        workMessages: [
            'You plated a dish so clean Gordon Ramsay shed a tear.',
            'You burned the onions. Nobody noticed. You noticed.',
            'You prepped 200 portions of chicken before noon.',
            'You invented a new sauce. The owner stole the recipe.',
            'You held the line during a Saturday dinner rush.',
        ],
    },
    developer: {
        id: 'developer', name: 'Developer', emoji: '',
        description: 'Write code, ship bugs, collect salary.',
        ranks: [
            { title: 'Junior Developer', pay: [500, 800],   bonus: 0,     levelReq: 10 },
            { title: 'Mid Developer',    pay: [800, 1200],  bonus: 2000,  levelReq: 18 },
            { title: 'Senior Developer', pay: [1200, 1800], bonus: 4500,  levelReq: 28 },
            { title: 'Tech Lead',        pay: [1700, 2600], bonus: 9000,  levelReq: 40 },
            { title: 'CTO',              pay: [2500, 4000], bonus: 20000, levelReq: 55 },
        ],
        workMessages: [
            'You pushed a hotfix at 2am. No tests. It works.',
            'You refactored legacy code from 2015.',
            'You attended three meetings that could have been emails.',
            'You fixed a bug by deleting 300 lines of code.',
            'You deployed to production on a Friday. You are fearless.',
        ],
    },
    doctor: {
        id: 'doctor', name: 'Doctor', emoji: '',
        description: 'Save lives, skip sleep.',
        ranks: [
            { title: 'Intern',            pay: [600, 900],   bonus: 0,     levelReq: 15 },
            { title: 'Resident',          pay: [900, 1400],  bonus: 2500,  levelReq: 28 },
            { title: 'Attending',         pay: [1400, 2100], bonus: 5500,  levelReq: 42 },
            { title: 'Specialist',        pay: [2000, 3000], bonus: 11000, levelReq: 58 },
            { title: 'Chief of Medicine', pay: [3000, 4500], bonus: 25000, levelReq: 75 },
        ],
        workMessages: [
            'You pulled a 36-hour shift. Coffee is a food group now.',
            'You diagnosed something four other doctors missed.',
            'You explained a diagnosis. Patient Googled it anyway.',
            'You performed a procedure in a hallway. It worked.',
            'You attended rounds, reviewed charts, and still ate lunch.',
        ],
    },
    lawyer: {
        id: 'lawyer', name: 'Lawyer', emoji: '',
        description: 'Bill by the hour. Every hour.',
        ranks: [
            { title: 'Paralegal',        pay: [500, 800],   bonus: 0,     levelReq: 12 },
            { title: 'Associate',        pay: [800, 1300],  bonus: 2000,  levelReq: 22 },
            { title: 'Senior Associate', pay: [1300, 2000], bonus: 4500,  levelReq: 35 },
            { title: 'Partner',          pay: [2000, 3000], bonus: 10000, levelReq: 50 },
            { title: 'Managing Partner', pay: [3000, 4500], bonus: 22000, levelReq: 65 },
        ],
        workMessages: [
            'You drafted a 40-page contract. One comma changed everything.',
            'You billed 14 hours. You worked 13. Close enough.',
            'You cross-examined a witness until they reconsidered life.',
            'You found a loophole nobody else saw.',
            'You settled out of court. Client is unhappy. Case is closed.',
        ],
    },
    streamer: {
        id: 'streamer', name: 'Streamer', emoji: '',
        description: 'Play games. Get paid. Easier said than done.',
        ranks: [
            { title: 'Lurker',       pay: [200, 450],   bonus: 0,     levelReq: 5  },
            { title: 'Regular',      pay: [400, 750],   bonus: 1000,  levelReq: 10 },
            { title: 'Affiliate',    pay: [700, 1100],  bonus: 2500,  levelReq: 18 },
            { title: 'Partner',      pay: [1100, 1700], bonus: 6000,  levelReq: 28 },
            { title: 'Megastreamer', pay: [1700, 2800], bonus: 15000, levelReq: 40 },
        ],
        workMessages: [
            'You went live to 3 viewers. One was your mom. She subbed.',
            'You did a 12-hour charity stream. Raised enough for a sandwich.',
            'You rage-quit on stream. Clip went viral. +500 followers.',
            'You hit a personal best speedrun. Chat missed it.',
            'You hosted another streamer. They did not notice.',
        ],
    },
    criminal: {
        id: 'criminal', name: 'Criminal', emoji: '',
        description: 'High risk. High reward. Do not get caught.',
        risk: 0.25,
        ranks: [
            { title: 'Pickpocket',  pay: [300,  700],  bonus: 0,     levelReq: 8  },
            { title: 'Thug',        pay: [600,  1200], bonus: 1500,  levelReq: 15 },
            { title: 'Gangster',    pay: [1100, 2000], bonus: 4000,  levelReq: 25 },
            { title: 'Crime Boss',  pay: [1800, 3200], bonus: 10000, levelReq: 38 },
            { title: 'Kingpin',     pay: [2800, 5000], bonus: 25000, levelReq: 55 },
        ],
        workMessages: [
            'You lifted a wallet on the subway. Easy money.',
            'You ran a protection racket for three local shops.',
            'You fenced stolen goods through a contact who asks no questions.',
            'You coordinated a heist. Split went smooth. Almost.',
            'You brokered a deal between two crews. Both paid you.',
        ],
        failMessages: [
            'You got caught by an off-duty cop. Lost your haul.',
            'The deal went sideways. You barely escaped.',
            'Someone tipped off the police. You ran. Lost everything.',
            'Your fence got raided. You walked away with nothing.',
        ],
    },
};

function getJob(jobId) {
    return JOBS[jobId] || null;
}

function getRank(job, rankIndex) {
    return job.ranks[Math.min(rankIndex, job.ranks.length - 1)];
}

function isMaxRank(job, rankIndex) {
    return rankIndex >= job.ranks.length - 1;
}

function getJobList() {
    return Object.values(JOBS);
}

function getPerk(rankIndex) {
    return BASE_RANK_PERKS[rankIndex] || null;
}

function rollShiftEvent(rankIndex) {
    const perk = BASE_RANK_PERKS[rankIndex];
    const pool = SHIFT_EVENTS.map(e => ({ ...e }));

    if (perk?.bonusWeight) {
        const bonus = pool.find(e => e.id === 'bonus');
        if (bonus) bonus.weight += perk.bonusWeight;
    }
    if (perk?.jackpotDouble) {
        const jackpot = pool.find(e => e.id === 'jackpot');
        if (jackpot) jackpot.weight *= 2;
    }

    const total = pool.reduce((s, e) => s + e.weight, 0);
    let roll = Math.random() * total;
    for (const event of pool) {
        roll -= event.weight;
        if (roll <= 0) return event;
    }
    return pool[0];
}

function calcStreakWindow(rankIndex) {
    const perk = BASE_RANK_PERKS[rankIndex];
    return perk?.streakWindow || STREAK_WINDOW_MS;
}

function calcPayout(basePay, rankIndex, streak, prestige, eventMultiplier) {
    const [min, max] = basePay;
    const base = Math.floor(Math.random() * (max - min + 1)) + min;

    const perk = BASE_RANK_PERKS[rankIndex];
    const rankBonus    = base * (perk?.payBonus || 0);
    const streakBonus  = base * (Math.min(streak, MAX_STREAK) * STREAK_BONUS_PER);
    const prestigeBonus = base * (Math.min(prestige, MAX_PRESTIGE) * PRESTIGE_BONUS);

    const subtotal = Math.floor(base + rankBonus + streakBonus + prestigeBonus);
    return Math.floor(subtotal * eventMultiplier);
}

module.exports = {
    JOBS,
    WORKS_PER_RANK,
    WORK_COOLDOWN_MS,
    STREAK_WINDOW_MS,
    MAX_STREAK,
    MAX_PRESTIGE,
    PRESTIGE_BONUS,
    STREAK_BONUS_PER,
    getJob,
    getRank,
    isMaxRank,
    getJobList,
    getPerk,
    rollShiftEvent,
    calcStreakWindow,
    calcPayout,
};
