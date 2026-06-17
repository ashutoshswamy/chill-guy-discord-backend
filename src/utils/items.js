// ── Rarity config ─────────────────────────────────────────────
const RARITY = {
    common:    { label: 'Common',    emoji: '', color: 0x9E9E9E },
    uncommon:  { label: 'Uncommon',  emoji: '', color: 0x4CAF50 },
    rare:      { label: 'Rare',      emoji: '', color: 0x2196F3 },
    epic:      { label: 'Epic',      emoji: '', color: 0x9C27B0 },
    legendary: { label: 'Legendary', emoji: '', color: 0xFFD700 },
};

// ── Loot tables ───────────────────────────────────────────────
// weight is relative — rolled by weighted random
const HUNT_LOOT = [
    { name: 'Rabbit',       emoji: '', weight: 25, sell: 180,  rarity: 'common'    },
    { name: 'Duck',         emoji: '', weight: 20, sell: 250,  rarity: 'common'    },
    { name: 'Eagle Feather',emoji: '', weight: 18, sell: 400,  rarity: 'uncommon'  },
    { name: 'Deer',         emoji: '', weight: 14, sell: 500,  rarity: 'uncommon'  },
    { name: 'Deer Antler',  emoji: '', weight: 10, sell: 650,  rarity: 'uncommon'  },
    { name: 'Wild Boar',    emoji: '', weight: 7,  sell: 900,  rarity: 'rare'      },
    { name: 'Wolf Pelt',    emoji: '', weight: 3,  sell: 1400, rarity: 'rare'      },
    { name: 'Grizzly Bear', emoji: '', weight: 2,  sell: 2800, rarity: 'epic'      },
    { name: 'Dragon Scale', emoji: '', weight: 1,  sell: 9000, rarity: 'legendary' },
];

const DIG_LOOT = [
    { name: 'Common Worm',    emoji: '', weight: 28, sell: 15,   rarity: 'common'    },
    { name: 'Old Coin',       emoji: '', weight: 22, sell: 320,  rarity: 'common'    },
    { name: 'Cracked Geode',  emoji: '', weight: 18, sell: 170,  rarity: 'uncommon'  },
    { name: 'Dirt Fossil',    emoji: '', weight: 14, sell: 240,  rarity: 'uncommon'  },
    { name: 'Ancient Vase',   emoji: '', weight: 9,  sell: 900,  rarity: 'rare'      },
    { name: 'Sapphire',       emoji: '', weight: 5,  sell: 2800, rarity: 'rare'      },
    { name: 'Ruby',           emoji: '', weight: 2.5,sell: 4500,'rarity': 'epic'  },
    { name: 'Diamond',        emoji: '', weight: 1,  sell: 10000,rarity: 'epic'      },
    { name: 'Buried Chest',   emoji: '', weight: 0.5,sell: 7500, rarity: 'legendary' },
];

const CHOP_LOOT = [
    { name: 'Pine Log',      emoji: '', weight: 30, sell: 80,   rarity: 'common'    },
    { name: 'Oak Log',       emoji: '', weight: 25, sell: 160,  rarity: 'common'    },
    { name: 'Birch Log',     emoji: '', weight: 20, sell: 250,  rarity: 'uncommon'  },
    { name: 'Mahogany Log',  emoji: '', weight: 13, sell: 420,  rarity: 'uncommon'  },
    { name: 'Yew Log',       emoji: '', weight: 7,  sell: 750,  rarity: 'rare'      },
    { name: 'Elderwood Log', emoji: '', weight: 3.5,sell: 1400, rarity: 'rare'      },
    { name: 'Golden Sap',    emoji: '', weight: 1.5,sell: 3500, rarity: 'epic'      },
];

// ── Shop items ────────────────────────────────────────────────
const SHOP_ITEMS = [
    // Tools
    { name: 'Hunting Rifle', emoji: '', price: 2000, category: 'Tools',       description: 'Required to use `/hunt`. Permanent.', tool: true },
    { name: 'Axe',           emoji: '', price: 1000, category: 'Tools',       description: 'Required to use `/chop`. Permanent.', tool: true },
    { name: 'Shovel',        emoji: '',  price: 800,  category: 'Tools',       description: 'Required to use `/dig`. Permanent.',  tool: true },
    { name: 'Pickaxe',       emoji: '',  price: 1200, category: 'Tools',       description: 'Required to use `/mine`. Permanent.', tool: true },
    { name: 'Fishing Pole',  emoji: '', price: 900,  category: 'Tools',       description: 'Required to use `/fish`. Permanent.', tool: true },
    // Consumables
    { name: 'XP Potion',     emoji: '', price: 2500,  category: 'Consumables', description: 'Use with `/use` for +300 XP instantly.' },
    { name: 'Work Gloves',   emoji: '', price: 1200,  category: 'Consumables', description: 'Use with `/use` to boost next `/work` by 50%.' },
    { name: 'Coin Bomb',     emoji: '', price: 1000,  category: 'Consumables', description: 'Use with `/use` for +500 coins.' },
    { name: 'Energy Drink',  emoji: '', price: 400,   category: 'Consumables', description: 'Use with `/use` to instantly restore pet energy.' },
    { name: 'Pet Food',      emoji: '', price: 300,   category: 'Consumables', description: 'Use with `/use` to feed your active pet (no cooldown).' },
    // Lootboxes (all tiers buyable; also drop from grinding)
    { name: 'Common Lootbox',    emoji: '', price: 2000,  category: 'Lootboxes', description: 'Open with `/lootbox open`. Drops: 100–600 coins, XP, crafting material.' },
    { name: 'Uncommon Lootbox',  emoji: '', price: 5000,  category: 'Lootboxes', description: 'Open with `/lootbox open`. Drops: 600–2k coins, XP, materials, 20% consumable.' },
    { name: 'Rare Lootbox',      emoji: '', price: 12000, category: 'Lootboxes', description: 'Open with `/lootbox open`. Drops: 2k–7k coins, XP, rare materials, 35% consumable.' },
    { name: 'Epic Lootbox',      emoji: '', price: 30000, category: 'Lootboxes', description: 'Open with `/lootbox open`. Drops: 7k–18k coins, XP, epic materials, 60% consumable.' },
    { name: 'Legendary Lootbox', emoji: '', price: 80000, category: 'Lootboxes', description: 'Open with `/lootbox open`. Drops: 18k–50k coins, XP, 2 legendary items + 2 consumables.' },
];

// ── Sell price map (all sellable items) ───────────────────────
const SELL_PRICES = {};
for (const item of [...HUNT_LOOT, ...DIG_LOOT, ...CHOP_LOOT]) {
    SELL_PRICES[item.name.toLowerCase()] = item.sell;
}
// Beg junk
SELL_PRICES['common worm']  = 15;
SELL_PRICES['old boot']     = 50;
SELL_PRICES['junk seaweed'] = 20;
// Consumables (sell at loss)
SELL_PRICES['xp potion']   = 1000;
SELL_PRICES['work gloves']  = 500;
SELL_PRICES['coin bomb']    = 400;
SELL_PRICES['energy drink'] = 150;
SELL_PRICES['pet food']     = 100;
// Lootboxes
SELL_PRICES['common lootbox']    = 500;
SELL_PRICES['uncommon lootbox']  = 1500;
SELL_PRICES['rare lootbox']      = 4000;
SELL_PRICES['epic lootbox']      = 12000;
SELL_PRICES['legendary lootbox'] = 40000;
// Lootbox-exclusive crafting materials
SELL_PRICES['cloth scrap']     = 120;
SELL_PRICES['iron chunk']      = 200;
SELL_PRICES['mysterious rune'] = 600;
SELL_PRICES['steel ingot']     = 900;
SELL_PRICES['mana crystal']    = 2800;
SELL_PRICES['shadow essence']  = 3500;
SELL_PRICES['void shard']      = 7000;
SELL_PRICES['dragon heart']    = 9500;
SELL_PRICES['phoenix feather'] = 18000;
SELL_PRICES['cosmic dust']     = 25000;

// Fish and ore sell prices (added without overwriting existing entries)
const { FISH } = require('./fishing');
const { ORES } = require('./mining');
for (const fish of FISH) {
    if (fish.rarity !== 'junk') {
        const key = fish.name.toLowerCase();
        if (!SELL_PRICES[key]) SELL_PRICES[key] = Math.floor((fish.baseValue[0] + fish.baseValue[1]) / 2);
    }
}
for (const ore of ORES) {
    if (ore.rarity !== 'junk') {
        const key = ore.name.toLowerCase();
        if (!SELL_PRICES[key]) SELL_PRICES[key] = Math.floor((ore.baseValue[0] + ore.baseValue[1]) / 2);
    }
}

// ── Helpers ───────────────────────────────────────────────────

function rollLoot(table) {
    const total = table.reduce((s, i) => s + i.weight, 0);
    let roll = Math.random() * total;
    for (const item of table) {
        roll -= item.weight;
        if (roll <= 0) return item;
    }
    return table[table.length - 1];
}

function getShopItem(name) {
    return SHOP_ITEMS.find(i => i.name.toLowerCase() === name.toLowerCase()) || null;
}

function getSellPrice(itemName) {
    return SELL_PRICES[itemName.toLowerCase()] || 0;
}

function getRarity(rarity) {
    return RARITY[rarity] || RARITY.common;
}

module.exports = {
    RARITY,
    HUNT_LOOT,
    DIG_LOOT,
    CHOP_LOOT,
    SHOP_ITEMS,
    SELL_PRICES,
    rollLoot,
    getShopItem,
    getSellPrice,
    getRarity,
};
