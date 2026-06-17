// ── Thresholds ───────────────────────────────────────────────
const XP_PER_LEVEL    = (level) => level * 150;
const MAX_LEVEL       = 50;
const EVOLVE_STAGES   = [
    { stage: 0, name: 'Baby',      minLevel: 1,  suffix: ''    },
    { stage: 1, name: 'Adult',     minLevel: 10, suffix: ''    },
    { stage: 2, name: 'Elder',     minLevel: 25, suffix: ''    },
];

// ── Cooldowns ────────────────────────────────────────────────
const FEED_COOLDOWN_MS  = 60 * 60 * 1000;        // 1 hour
const PLAY_COOLDOWN_MS  = 30 * 60 * 1000;        // 30 minutes

// ── Stat decay per hour ───────────────────────────────────────
// Applied lazily when the pet is interacted with
const DECAY = {
    hunger:    -7,   // -7 per hour
    happiness: -3,   // -3 per hour (only if hunger < 40)
    health:    -8,   // -8 per hour (only if hunger === 0)
    energy:    +10,  // regenerates
};

// ── Rarity config ─────────────────────────────────────────────
const RARITIES = {
    common:    { label: 'Common',    color: 0x9E9E9E, emoji: '' },
    uncommon:  { label: 'Uncommon',  color: 0x4CAF50, emoji: '' },
    rare:      { label: 'Rare',      color: 0x2196F3, emoji: '' },
    epic:      { label: 'Epic',      color: 0x9C27B0, emoji: '' },
    legendary: { label: 'Legendary', color: 0xFFD700, emoji: '' },
};

// ── Pet definitions ───────────────────────────────────────────
// bonus.type: 'work' | 'beg' | 'claims' | 'all'
// bonus.base: flat multiplier added per 10 levels (scales with level)
const PETS = {
    dog: {
        id: 'dog', name: 'Dog', emoji: '', rarity: 'common', cost: 2000,
        description: 'Loyal companion. Boosts your work income.',
        bonus: { type: 'work', base: 0.05 },
        feedMessages: [
            '{name} devoured the food in 0.3 seconds.',
            '{name} wagged their tail so fast it became a blur.',
            '{name} licked the bowl clean and looked at you for more.',
        ],
        playMessages: [
            'You threw a ball and {name} brought back a sock instead.',
            '{name} knocked you over with excitement.',
            'You played tug-of-war. {name} won. Obviously.',
        ],
    },
    cat: {
        id: 'cat', name: 'Cat', emoji: '', rarity: 'common', cost: 2000,
        description: 'Independent but loyal. Boosts beg income.',
        bonus: { type: 'beg', base: 0.05 },
        feedMessages: [
            '{name} sniffed the food, walked away, then came back and ate it.',
            '{name} ate half and knocked the bowl off the table.',
            '{name} accepted your offering. This time.',
        ],
        playMessages: [
            '{name} batted at the string exactly twice then lost interest.',
            '{name} sat in the toy box instead of playing with toys.',
            'You dangled something shiny. {name} was briefly impressed.',
        ],
    },
    frog: {
        id: 'frog', name: 'Frog', emoji: '', rarity: 'common', cost: 1800,
        description: 'Lucky little guy. Raises your beg item drop chance.',
        bonus: { type: 'beg_item', base: 0.05 },
        feedMessages: [
            '{name} caught the fly before it even landed.',
            '{name} ate so fast you barely saw it happen.',
            '{name} croaked approvingly at the meal.',
        ],
        playMessages: [
            '{name} leaped three feet in the air unprovoked.',
            'You played hop-skip with {name}. Very competitive.',
            '{name} splashed around in their water dish joyfully.',
        ],
    },
    fox: {
        id: 'fox', name: 'Fox', emoji: '', rarity: 'uncommon', cost: 6000,
        description: 'Cunning partner. Solid work pay boost.',
        bonus: { type: 'work', base: 0.09 },
        feedMessages: [
            '{name} accepted the food elegantly, like a noble.',
            '{name} buried half the food for later. Smart.',
            '{name} ate quickly and watched you with clever eyes.',
        ],
        playMessages: [
            '{name} outsmarted you in every game you tried.',
            'You played hide and seek. You never found {name}.',
            '{name} stole your snack mid-play and looked unbothered.',
        ],
    },
    panda: {
        id: 'panda', name: 'Panda', emoji: '', rarity: 'uncommon', cost: 5500,
        description: 'Chill and wise. Boosts daily/weekly/monthly claims.',
        bonus: { type: 'claims', base: 0.08 },
        feedMessages: [
            '{name} ate bamboo for the 400th time today. Still happy.',
            '{name} rolled over with joy mid-meal.',
            '{name} stared at you while eating. Peacefully.',
        ],
        playMessages: [
            '{name} tumbled around and called it exercise.',
            'You gave {name} a bamboo stick to play with. Peak joy.',
            '{name} sat on you. That is the game.',
        ],
    },
    wolf: {
        id: 'wolf', name: 'Wolf', emoji: '', rarity: 'rare', cost: 14000,
        description: 'Pack leader. Strong work bonus + streak protection.',
        bonus: { type: 'work', base: 0.13 },
        special: 'streak_protect',
        feedMessages: [
            '{name} ate in silence and howled softly after.',
            '{name} shared a piece with you. High honour.',
            '{name} hunted the food off the plate. Theatrically.',
        ],
        playMessages: [
            '{name} led you on a sprint and lapped you twice.',
            'You played fetch. {name} brought you a log.',
            '{name} howled and three distant dogs responded.',
        ],
    },
    eagle: {
        id: 'eagle', name: 'Eagle', emoji: '', rarity: 'rare', cost: 12000,
        description: 'Sharp-eyed hunter. Boosts all income.',
        bonus: { type: 'all', base: 0.10 },
        feedMessages: [
            '{name} caught dinner before you could plate it.',
            '{name} accepted the food with regal indifference.',
            '{name} ate on the highest perch. Always.',
        ],
        playMessages: [
            '{name} did a dramatic sky lap of the room.',
            'You flew a kite. {name} took it as a challenge.',
            '{name} landed on your arm and you both just sat there.',
        ],
    },
    dragon: {
        id: 'dragon', name: 'Dragon', emoji: '', rarity: 'epic', cost: 35000,
        description: 'Ancient beast. Massive bonus to all income.',
        bonus: { type: 'all', base: 0.17 },
        feedMessages: [
            '{name} cooked their own meal. Efficiently.',
            '{name} breathed a small flame to warm the food first.',
            '{name} ate an entire wagon of gold coins as dessert.',
        ],
        playMessages: [
            '{name} accidentally set the curtains on fire. Fun though.',
            'You rode {name} across the sky. Briefly.',
            '{name} let you polish their scales. A privilege.',
        ],
    },
    phoenix: {
        id: 'phoenix', name: 'Phoenix', emoji: '', rarity: 'epic', cost: 40000,
        description: 'Reborn legend. Protects wallet on failed shifts.',
        bonus: { type: 'all', base: 0.15 },
        special: 'fail_protect',
        feedMessages: [
            '{name} incinerated the food and reformed it as a fireball snack.',
            '{name} ate and immediately glowed brighter.',
            '{name} accepted the meal and rose two inches off the ground.',
        ],
        playMessages: [
            '{name} shed a feather. It burst into flame. You framed it.',
            'You played in the ash pile {name} left behind.',
            '{name} flew in circles so fast it looked like a sun.',
        ],
    },
    unicorn: {
        id: 'unicorn', name: 'Unicorn', emoji: '', rarity: 'legendary', cost: 80000,
        description: 'Mythical perfection. Maximum bonus to all income + claims.',
        bonus: { type: 'all', base: 0.22 },
        special: 'double_claims',
        feedMessages: [
            '{name} ate rainbow crystals. You had to order more.',
            '{name} left a trail of sparkles after eating. Beautiful.',
            '{name} gave you a knowing look and the food just appeared.',
        ],
        playMessages: [
            '{name} created a rainbow arc across the room.',
            'You braided {name}\'s mane. It took 40 minutes. Worth it.',
            '{name} teleported mid-play. You found them in the pantry.',
        ],
    },
};

// ── Helpers ───────────────────────────────────────────────────

function getPet(petType) {
    return PETS[petType] || null;
}

function getPetList() {
    return Object.values(PETS);
}

function getRarityConfig(rarity) {
    return RARITIES[rarity] || RARITIES.common;
}

function getEvolveStage(level) {
    let stage = EVOLVE_STAGES[0];
    for (const s of EVOLVE_STAGES) {
        if (level >= s.minLevel) stage = s;
    }
    return stage;
}

function getNextEvolveStage(currentStage) {
    return EVOLVE_STAGES[currentStage + 1] || null;
}

function xpToNextLevel(level) {
    if (level >= MAX_LEVEL) return null;
    return XP_PER_LEVEL(level);
}

function statBar(value, max = 100, length = 10) {
    const filled = Math.round((Math.max(0, Math.min(value, max)) / max) * length);
    return '█'.repeat(filled) + '░'.repeat(length - filled);
}

function statEmoji(value) {
    if (value >= 75) return '';
    if (value >= 40) return '';
    if (value >= 15) return '';
    return '';
}

// Lazily compute stat decay since last_stat_decay timestamp
function applyDecay(pet) {
    if (!pet.last_stat_decay) return { ...pet, hunger: 100, happiness: 100, energy: 100, health: 100 };

    const hoursElapsed = (Date.now() - new Date(pet.last_stat_decay).getTime()) / 3_600_000;
    if (hoursElapsed < 0.05) return pet; // less than 3 minutes, skip

    let { hunger, happiness, energy, health } = pet;

    hunger    = Math.max(0, Math.min(100, hunger    + DECAY.hunger    * hoursElapsed));
    energy    = Math.max(0, Math.min(100, energy    + DECAY.energy    * hoursElapsed));
    if (hunger < 40) {
        happiness = Math.max(0, Math.min(100, happiness + DECAY.happiness * hoursElapsed));
    }
    if (hunger === 0) {
        health = Math.max(0, Math.min(100, health + DECAY.health * hoursElapsed));
    }

    return {
        ...pet,
        hunger:    Math.round(hunger),
        happiness: Math.round(happiness),
        energy:    Math.round(energy),
        health:    Math.round(health),
    };
}

// Effective bonus considering happiness, health, level
function calcPetBonus(pet) {
    const petDef = getPet(pet.pet_type);
    if (!petDef) return 0;

    const base = petDef.bonus.base;
    const levelScale = 1 + ((pet.level - 1) / MAX_LEVEL);                // up to 2x at max level
    const happinessMod = (pet.happiness / 100);                           // 0–1 based on happiness
    const healthMod    = pet.health >= 20 ? 1 : (pet.health / 20);       // penalty below 20 health

    return parseFloat((base * levelScale * happinessMod * healthMod).toFixed(4));
}

module.exports = {
    PETS,
    RARITIES,
    EVOLVE_STAGES,
    MAX_LEVEL,
    FEED_COOLDOWN_MS,
    PLAY_COOLDOWN_MS,
    getPet,
    getPetList,
    getRarityConfig,
    getEvolveStage,
    getNextEvolveStage,
    xpToNextLevel,
    statBar,
    statEmoji,
    applyDecay,
    calcPetBonus,
};
