const RODS = {
    'Basic Rod':    { rareBonus: 0.00, coinMult: 1.00, emoji: '',   cost: 0    },
    'Advanced Rod': { rareBonus: 0.10, coinMult: 1.25, emoji: '',    cost: 2500 },
    'Golden Rod':   { rareBonus: 0.20, coinMult: 1.50, emoji: '',  cost: 8000 },
    'Blessed Rod':  { rareBonus: 0.35, coinMult: 2.00, emoji: '',  cost: 25000 },
};

const FISH = [
    // Junk
    { name: 'Old Boot',    rarity: 'junk',      emoji: '', baseValue: [1,  5],     weight: [0.3, 1.5]   },
    { name: 'Rusty Can',   rarity: 'junk',      emoji: '', baseValue: [1,  3],     weight: [0.1, 0.5]   },
    { name: 'Seaweed',     rarity: 'junk',      emoji: '', baseValue: [1,  10],    weight: [0.1, 1.0]   },
    // Common
    { name: 'Goldfish',    rarity: 'common',    emoji: '', baseValue: [30,  80],   weight: [0.1, 0.3]   },
    { name: 'Bass',        rarity: 'common',    emoji: '', baseValue: [40, 100],   weight: [0.5, 1.5]   },
    { name: 'Catfish',     rarity: 'common',    emoji: '', baseValue: [35,  90],   weight: [0.8, 2.5]   },
    { name: 'Carp',        rarity: 'common',    emoji: '', baseValue: [25,  70],   weight: [1.0, 3.0]   },
    { name: 'Trout',       rarity: 'common',    emoji: '', baseValue: [50, 110],   weight: [0.3, 1.0]   },
    // Uncommon
    { name: 'Salmon',      rarity: 'uncommon',  emoji: '', baseValue: [150, 300],  weight: [1.5, 4.0]   },
    { name: 'Pike',        rarity: 'uncommon',  emoji: '', baseValue: [120, 280],  weight: [2.0, 5.0]   },
    { name: 'Perch',       rarity: 'uncommon',  emoji: '', baseValue: [100, 250],  weight: [0.5, 1.5]   },
    { name: 'Tench',       rarity: 'uncommon',  emoji: '', baseValue: [110, 260],  weight: [1.0, 3.0]   },
    { name: 'Bream',       rarity: 'uncommon',  emoji: '', baseValue: [130, 290],  weight: [1.0, 2.5]   },
    // Rare
    { name: 'Swordfish',   rarity: 'rare',      emoji: '', baseValue: [500,  900], weight: [30,  80]    },
    { name: 'Tuna',        rarity: 'rare',      emoji: '', baseValue: [600, 1000], weight: [50, 150]    },
    { name: 'Mahi-Mahi',   rarity: 'rare',      emoji: '', baseValue: [450,  850], weight: [10,  30]    },
    { name: 'Red Snapper', rarity: 'rare',      emoji: '', baseValue: [480,  880], weight: [5,   15]    },
    { name: 'Grouper',     rarity: 'rare',      emoji: '', baseValue: [520,  950], weight: [8,   25]    },
    // Epic
    { name: 'Shark',       rarity: 'epic',      emoji: '', baseValue: [2000, 4000], weight: [100, 300]  },
    { name: 'Giant Squid', rarity: 'epic',      emoji: '', baseValue: [1800, 3500], weight: [50,  200]  },
    { name: 'Barracuda',   rarity: 'epic',      emoji: '', baseValue: [1500, 3000], weight: [15,   50]  },
    { name: 'Tarpon',      rarity: 'epic',      emoji: '', baseValue: [1600, 3200], weight: [20,   80]  },
    // Legendary
    { name: 'Kraken',      rarity: 'legendary', emoji: '', baseValue: [8000,  15000], weight: [500, 1500] },
    { name: 'Dragon Fish', rarity: 'legendary', emoji: '', baseValue: [10000, 20000], weight: [200,  800] },
    { name: 'Leviathan',   rarity: 'legendary', emoji: '', baseValue: [15000, 25000], weight: [1000, 3000] },
];

// Sellable fish names (no junk)
const SELLABLE_FISH = new Set(FISH.filter(f => f.rarity !== 'junk').map(f => f.name));

const BASE_RARITY_WEIGHTS = {
    junk:      15,
    common:    45,
    uncommon:  25,
    rare:      10,
    epic:       4,
    legendary:  1,
};

const RARITY_COLORS = {
    junk:      0x808080,
    common:    0x95A5A6,
    uncommon:  0x2ECC71,
    rare:      0x3498DB,
    epic:      0x9B59B6,
    legendary: 0xFFD700,
};

const RARITY_LABELS = {
    junk:      'Junk',
    common:    'Common',
    uncommon:  'Uncommon',
    rare:      'Rare',
    epic:      'Epic',
    legendary: 'Legendary',
};

const FISH_COOLDOWN_MS = 45 * 1000;

const FISH_CAST_LINES = [
    'You cast your line into the shimmering water...',
    'The bobber hits the surface with a gentle plop...',
    'You flick your rod and wait patiently...',
    'You find a quiet spot and cast out...',
    'The line sails across the water...',
];

function rand(min, max) {
    return Math.random() * (max - min) + min;
}

function rollFish(rodName = 'Basic Rod') {
    const rod = RODS[rodName] || RODS['Basic Rod'];
    const rareBonus = rod.rareBonus;

    const weights = { ...BASE_RARITY_WEIGHTS };

    if (rareBonus > 0) {
        const taken = Math.floor(weights.common * rareBonus) + Math.floor(weights.junk * rareBonus);
        weights.common    = Math.max(5, weights.common - Math.floor(weights.common * rareBonus));
        weights.junk      = Math.max(2, weights.junk   - Math.floor(weights.junk   * rareBonus));
        weights.uncommon += Math.floor(taken * 0.40);
        weights.rare     += Math.floor(taken * 0.35);
        weights.epic     += Math.floor(taken * 0.20);
        weights.legendary += Math.floor(taken * 0.05);
    }

    const entries = Object.entries(weights);
    const total   = entries.reduce((s, [, w]) => s + w, 0);
    let   roll    = Math.random() * total;
    let   rarity  = 'common';

    for (const [r, w] of entries) {
        roll -= w;
        if (roll <= 0) { rarity = r; break; }
    }

    const pool = FISH.filter(f => f.rarity === rarity);
    const fish = pool[Math.floor(Math.random() * pool.length)];

    const weight   = parseFloat(rand(fish.weight[0], fish.weight[1]).toFixed(2));
    const rawValue = Math.floor(rand(fish.baseValue[0], fish.baseValue[1]));
    const value    = Math.floor(rawValue * rod.coinMult);

    return { ...fish, weight, value, rod: rodName, rodEmoji: rod.emoji };
}

function getBestRodFromInventory(inventory) {
    const priority = ['Blessed Rod', 'Golden Rod', 'Advanced Rod', 'Basic Rod'];
    for (const rodName of priority) {
        if (inventory.some(i => i.item_name === rodName && i.quantity > 0)) return rodName;
    }
    return 'Basic Rod';
}

function getFishValueFromInventory(itemName) {
    const fish = FISH.find(f => f.name === itemName);
    if (!fish) return 0;
    return Math.floor((fish.baseValue[0] + fish.baseValue[1]) / 2);
}

module.exports = {
    RODS,
    FISH,
    SELLABLE_FISH,
    RARITY_COLORS,
    RARITY_LABELS,
    FISH_COOLDOWN_MS,
    FISH_CAST_LINES,
    rollFish,
    getBestRodFromInventory,
    getFishValueFromInventory,
};
