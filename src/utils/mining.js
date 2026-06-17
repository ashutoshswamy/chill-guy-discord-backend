const PICKAXES = {
    'Wooden Pickaxe':    { rareBonus: 0.00, coinMult: 1.00, emoji: '',   cost: 0      },
    'Stone Pickaxe':     { rareBonus: 0.10, coinMult: 1.30, emoji: '',   cost: 3000   },
    'Iron Pickaxe':      { rareBonus: 0.20, coinMult: 1.60, emoji: '',   cost: 10000  },
    'Diamond Pickaxe':   { rareBonus: 0.35, coinMult: 2.00, emoji: '', cost: 30000  },
    'Netherite Pickaxe': { rareBonus: 0.50, coinMult: 2.75, emoji: '', cost: 75000  },
};

const ORES = [
    // Junk
    { name: 'Gravel',         rarity: 'junk',      emoji: '', baseValue: [1,  4],      qty: [1, 3]  },
    { name: 'Dirt Clump',     rarity: 'junk',      emoji: '', baseValue: [1,  3],      qty: [1, 5]  },
    { name: 'Coal Dust',      rarity: 'junk',      emoji: '', baseValue: [1,  6],      qty: [1, 4]  },
    // Common
    { name: 'Coal',           rarity: 'common',    emoji: '', baseValue: [20,  55],    qty: [1, 5]  },
    { name: 'Iron Ore',       rarity: 'common',    emoji: '', baseValue: [30,  70],    qty: [1, 4]  },
    { name: 'Copper Ore',     rarity: 'common',    emoji: '', baseValue: [25,  60],    qty: [1, 4]  },
    { name: 'Tin Ore',        rarity: 'common',    emoji: '', baseValue: [20,  50],    qty: [1, 4]  },
    // Uncommon
    { name: 'Silver Ore',     rarity: 'uncommon',  emoji: '', baseValue: [120, 280],   qty: [1, 3]  },
    { name: 'Gold Ore',       rarity: 'uncommon',  emoji: '', baseValue: [150, 320],   qty: [1, 3]  },
    { name: 'Quartz',         rarity: 'uncommon',  emoji: '', baseValue: [100, 240],   qty: [1, 3]  },
    { name: 'Amethyst',       rarity: 'uncommon',  emoji: '', baseValue: [130, 300],   qty: [1, 2]  },
    // Rare
    { name: 'Ruby',           rarity: 'rare',      emoji: '', baseValue: [600, 1100],  qty: [1, 2]  },
    { name: 'Emerald',        rarity: 'rare',      emoji: '', baseValue: [650, 1200],  qty: [1, 2]  },
    { name: 'Sapphire',       rarity: 'rare',      emoji: '', baseValue: [580, 1050],  qty: [1, 2]  },
    { name: 'Topaz',          rarity: 'rare',      emoji: '', baseValue: [500,  950],  qty: [1, 2]  },
    // Epic
    { name: 'Mithril',        rarity: 'epic',      emoji: '', baseValue: [2200, 4500], qty: [1, 1]  },
    { name: 'Titanium Ore',   rarity: 'epic',      emoji: '', baseValue: [2000, 4000], qty: [1, 1]  },
    { name: 'Void Crystal',   rarity: 'epic',      emoji: '', baseValue: [2500, 5000], qty: [1, 1]  },
    { name: 'Starstone',      rarity: 'epic',      emoji: '', baseValue: [1800, 3800], qty: [1, 1]  },
    // Legendary
    { name: 'Dragon Scale',   rarity: 'legendary', emoji: '', baseValue: [9000,  18000], qty: [1, 1] },
    { name: 'Celestite',      rarity: 'legendary', emoji: '', baseValue: [12000, 22000], qty: [1, 1] },
    { name: 'Primordial Core', rarity: 'legendary', emoji: '', baseValue: [15000, 28000], qty: [1, 1] },
];

const SELLABLE_ORES = new Set(ORES.filter(o => o.rarity !== 'junk').map(o => o.name));

const BASE_RARITY_WEIGHTS = {
    junk:      12,
    common:    43,
    uncommon:  27,
    rare:      12,
    epic:       5,
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

const RARITY_RANK = { junk: 0, common: 1, uncommon: 2, rare: 3, epic: 4, legendary: 5 };

const MINE_COOLDOWN_MS = 60 * 1000;

const MINE_FLAVOR = [
    'You descend into the dark tunnels...',
    'Your pickaxe rings against the stone...',
    'Dust fills the air as you chip away...',
    'You squeeze through a narrow passage...',
    'The lantern flickers as you dig deeper...',
    'A rumble echoes through the cavern...',
];

function randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function rollOre(pickaxeName = 'Wooden Pickaxe') {
    const pick     = PICKAXES[pickaxeName] || PICKAXES['Wooden Pickaxe'];
    const bonus    = pick.rareBonus;
    const weights  = { ...BASE_RARITY_WEIGHTS };

    if (bonus > 0) {
        const taken = Math.floor(weights.common * bonus) + Math.floor(weights.junk * bonus);
        weights.common    = Math.max(5, weights.common - Math.floor(weights.common * bonus));
        weights.junk      = Math.max(2, weights.junk   - Math.floor(weights.junk   * bonus));
        weights.uncommon += Math.floor(taken * 0.40);
        weights.rare     += Math.floor(taken * 0.33);
        weights.epic     += Math.floor(taken * 0.22);
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

    const pool = ORES.filter(o => o.rarity === rarity);
    const ore  = pool[Math.floor(Math.random() * pool.length)];
    const qty  = randInt(ore.qty[0], ore.qty[1]);
    const rawValue = randInt(ore.baseValue[0], ore.baseValue[1]) * qty;
    const value    = Math.floor(rawValue * pick.coinMult);

    return { ...ore, quantity: qty, value, pickaxe: pickaxeName, pickEmoji: pick.emoji };
}

function getBestPickaxeFromInventory(inventory) {
    const priority = ['Netherite Pickaxe', 'Diamond Pickaxe', 'Iron Pickaxe', 'Stone Pickaxe', 'Wooden Pickaxe'];
    for (const name of priority) {
        if (inventory.some(i => i.item_name === name && i.quantity > 0)) return name;
    }
    return 'Wooden Pickaxe';
}

function getOreValueFromInventory(itemName) {
    const ore = ORES.find(o => o.name === itemName);
    if (!ore) return 0;
    return Math.floor((ore.baseValue[0] + ore.baseValue[1]) / 2);
}

module.exports = {
    PICKAXES,
    ORES,
    SELLABLE_ORES,
    RARITY_COLORS,
    RARITY_LABELS,
    RARITY_RANK,
    MINE_COOLDOWN_MS,
    MINE_FLAVOR,
    rollOre,
    getBestPickaxeFromInventory,
    getOreValueFromInventory,
};
