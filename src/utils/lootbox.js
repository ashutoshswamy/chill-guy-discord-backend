// ── Tier definitions ──────────────────────────────────────────
const LOOTBOX_TIERS = {
    'Common Lootbox':    { emoji: '', color: 0x9E9E9E, tier: 'common',    dropWeight: 60, sell: 500   },
    'Uncommon Lootbox':  { emoji: '', color: 0x4CAF50, tier: 'uncommon',  dropWeight: 25, sell: 1500  },
    'Rare Lootbox':      { emoji: '', color: 0x2196F3, tier: 'rare',      dropWeight: 10, sell: 4000  },
    'Epic Lootbox':      { emoji: '', color: 0x9C27B0, tier: 'epic',      dropWeight: 4,  sell: 12000 },
    'Legendary Lootbox': { emoji: '', color: 0xFFD700, tier: 'legendary', dropWeight: 1,  sell: 40000 },
};

// ── New lootbox-exclusive collectible items ───────────────────
const LOOTBOX_ITEMS = [
    { name: 'Cloth Scrap',     emoji: '', rarity: 'common',    sell: 120   },
    { name: 'Iron Chunk',      emoji: '', rarity: 'common',    sell: 200   },
    { name: 'Mysterious Rune', emoji: '', rarity: 'uncommon',  sell: 600   },
    { name: 'Steel Ingot',     emoji: '', rarity: 'uncommon',  sell: 900   },
    { name: 'Mana Crystal',    emoji: '', rarity: 'rare',      sell: 2800  },
    { name: 'Shadow Essence',  emoji: '', rarity: 'rare',      sell: 3500  },
    { name: 'Void Shard',      emoji: '', rarity: 'epic',      sell: 7000  },
    { name: 'Dragon Heart',    emoji: '', rarity: 'epic',      sell: 9500  },
    { name: 'Phoenix Feather', emoji: '', rarity: 'legendary', sell: 18000 },
    { name: 'Cosmic Dust',     emoji: '', rarity: 'legendary', sell: 25000 },
];

// ── Per-tier reward tables ────────────────────────────────────
const TIER_REWARDS = {
    common: {
        minCoins: 100, maxCoins: 600,
        minXP: 20, maxXP: 60,
        items: ['Cloth Scrap', 'Iron Chunk'],
        itemCount: 1,
        consumableChance: 0,
        consumables: [],
    },
    uncommon: {
        minCoins: 600, maxCoins: 2000,
        minXP: 60, maxXP: 180,
        items: ['Mysterious Rune', 'Steel Ingot'],
        itemCount: 1,
        consumableChance: 0.20,
        consumables: ['XP Potion'],
    },
    rare: {
        minCoins: 2000, maxCoins: 7000,
        minXP: 180, maxXP: 450,
        items: ['Mana Crystal', 'Shadow Essence'],
        itemCount: 1,
        consumableChance: 0.35,
        consumables: ['Work Gloves', 'XP Potion'],
    },
    epic: {
        minCoins: 7000, maxCoins: 18000,
        minXP: 450, maxXP: 900,
        items: ['Void Shard', 'Dragon Heart'],
        itemCount: 1,
        consumableChance: 0.60,
        consumables: ['Coin Bomb', 'Work Gloves', 'XP Potion'],
    },
    legendary: {
        minCoins: 18000, maxCoins: 50000,
        minXP: 900, maxXP: 2500,
        items: ['Phoenix Feather', 'Cosmic Dust'],
        itemCount: 2,
        consumableChance: 1,
        consumables: ['XP Potion', 'Work Gloves', 'Coin Bomb'],
        guaranteedConsumableCount: 2,
    },
};

// ── Drop logic ────────────────────────────────────────────────

const DROP_CHANCE = 0.20;

function tryDropLootbox() {
    if (Math.random() > DROP_CHANCE) return null;

    const tiers  = Object.keys(LOOTBOX_TIERS);
    const total  = tiers.reduce((s, t) => s + LOOTBOX_TIERS[t].dropWeight, 0);
    let   roll   = Math.random() * total;

    for (const name of tiers) {
        roll -= LOOTBOX_TIERS[name].dropWeight;
        if (roll <= 0) return name;
    }
    return tiers[0];
}

// ── Open logic ────────────────────────────────────────────────

function openLootbox(tierName) {
    const tierDef = LOOTBOX_TIERS[tierName];
    if (!tierDef) throw new Error(`Unknown lootbox: ${tierName}`);

    const r       = TIER_REWARDS[tierDef.tier];
    const results = [];

    const coins = Math.floor(Math.random() * (r.maxCoins - r.minCoins + 1)) + r.minCoins;
    results.push({ type: 'coins', amount: coins });

    const xp = Math.floor(Math.random() * (r.maxXP - r.minXP + 1)) + r.minXP;
    results.push({ type: 'xp', amount: xp });

    const shuffledItems = [...r.items].sort(() => Math.random() - 0.5);
    for (let i = 0; i < r.itemCount && i < shuffledItems.length; i++) {
        const name    = shuffledItems[i];
        const itemDef = LOOTBOX_ITEMS.find(it => it.name === name);
        results.push({ type: 'item', name, emoji: itemDef?.emoji ?? '', rarity: itemDef?.rarity ?? 'common' });
    }

    if (tierDef.tier === 'legendary') {
        const count = r.guaranteedConsumableCount ?? 2;
        const pool  = [...r.consumables].sort(() => Math.random() - 0.5);
        for (let i = 0; i < count && i < pool.length; i++) {
            results.push({ type: 'consumable', name: pool[i] });
        }
    } else if (Math.random() < r.consumableChance && r.consumables.length > 0) {
        const c = r.consumables[Math.floor(Math.random() * r.consumables.length)];
        results.push({ type: 'consumable', name: c });
    }

    return { tierDef, results };
}

module.exports = {
    LOOTBOX_TIERS,
    LOOTBOX_ITEMS,
    tryDropLootbox,
    openLootbox,
};
