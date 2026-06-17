const RECIPES = [
    {
        result: 'Stone Pickaxe',
        cost: 0,
        materials: [
            { name: 'Pine Log', quantity: 5 },
            { name: 'Coal', quantity: 2 }
        ],
        description: 'Chop logs and mine coal to upgrade your mining speed.'
    },
    {
        result: 'Iron Pickaxe',
        cost: 1000,
        materials: [
            { name: 'Oak Log', quantity: 8 },
            { name: 'Iron Ore', quantity: 5 }
        ],
        description: 'A sturdy iron pickaxe for faster mining.'
    },
    {
        result: 'Advanced Rod',
        cost: 1200,
        materials: [
            { name: 'Birch Log', quantity: 6 },
            { name: 'Common Worm', quantity: 10 }
        ],
        description: 'Upgrade your rod to catch rarer fish.'
    },
    {
        result: 'Golden Rod',
        cost: 4000,
        materials: [
            { name: 'Mahogany Log', quantity: 5 },
            { name: 'Gold Ore', quantity: 5 }
        ],
        description: 'A shiny rod that attracts valuable fish.'
    },
    {
        result: 'Work Gloves',
        cost: 200,
        materials: [
            { name: 'Cloth Scrap', quantity: 3 },
            { name: 'Common Worm', quantity: 5 }
        ],
        description: 'Gloves to protect your hands, boosting work payout.'
    },
    {
        result: 'XP Potion',
        cost: 500,
        materials: [
            { name: 'Mana Crystal', quantity: 1 },
            { name: 'Golden Sap', quantity: 1 }
        ],
        description: 'A magical brew that grants instant XP.'
    },
    {
        result: 'Coin Bomb',
        cost: 400,
        materials: [
            { name: 'Iron Chunk', quantity: 3 },
            { name: 'Mysterious Rune', quantity: 1 }
        ],
        description: 'Explodes into coins!'
    },
    {
        result: 'Steel Ingot',
        cost: 100,
        materials: [
            { name: 'Iron Ore', quantity: 3 },
            { name: 'Coal', quantity: 2 }
        ],
        description: 'Refined iron steel for heavy-duty crafting.'
    },
    {
        result: 'Diamond',
        cost: 2000,
        materials: [
            { name: 'Coal', quantity: 20 },
            { name: 'Quartz', quantity: 5 }
        ],
        description: 'Highly compressed carbon. Extremely valuable.'
    }
];

module.exports = { RECIPES };
