const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

let supabase = null;

if (
    supabaseUrl && supabaseKey &&
    supabaseUrl !== 'your_supabase_url_here' &&
    supabaseKey !== 'your_supabase_key_here' &&
    supabaseUrl.trim() !== '' &&
    supabaseKey.trim() !== ''
) {
    supabase = createClient(supabaseUrl, supabaseKey);
    console.log('[SUCCESS] Database: Connected to Supabase.');
} else {
    console.warn('[WARNING] Supabase is NOT configured. Set SUPABASE_URL and SUPABASE_KEY in .env.');
}

// ============================================================
// INTERNAL
// ============================================================

function assertDb() {
    if (!supabase) throw new Error('Supabase is not configured.');
}

// ============================================================
// USERS
// ============================================================

async function getUser(userId) {
    assertDb();
    const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('user_id', userId)
        .single();

    if (error && error.code === 'PGRST116') {
        // Row not found — create it
        const { data: newUser, error: insertErr } = await supabase
            .from('users')
            .insert({ user_id: userId, wallet: 1000, total_earned: 1000 })
            .select()
            .single();
        if (insertErr) throw insertErr;
        return newUser;
    }

    if (error) throw error;
    return data;
}

// ============================================================
// WALLET / BANK
// ============================================================

async function updateWallet(userId, amount) {
    assertDb();
    const user = await getUser(userId);
    const newWallet = Math.max(0, user.wallet + amount);
    const newEarned = amount > 0 ? user.total_earned + amount : user.total_earned;

    const { data, error } = await supabase
        .from('users')
        .update({ wallet: newWallet, total_earned: newEarned })
        .eq('user_id', userId)
        .select()
        .single();

    if (error) throw error;
    return data;
}

async function depositCoins(userId, amount) {
    assertDb();
    const user = await getUser(userId);
    if (user.wallet < amount) throw new Error('Insufficient wallet balance.');

    const { data, error } = await supabase
        .from('users')
        .update({ wallet: user.wallet - amount, bank: user.bank + amount })
        .eq('user_id', userId)
        .select()
        .single();

    if (error) throw error;
    return data;
}

async function withdrawCoins(userId, amount) {
    assertDb();
    const user = await getUser(userId);
    if (user.bank < amount) throw new Error('Insufficient bank balance.');

    const { data, error } = await supabase
        .from('users')
        .update({ wallet: user.wallet + amount, bank: user.bank - amount })
        .eq('user_id', userId)
        .select()
        .single();

    if (error) throw error;
    return data;
}

// ============================================================
// CLAIMS (daily / weekly / monthly)
// ============================================================

async function claimReward(userId, type, cooldownMs, payout) {
    assertDb();
    const user = await getUser(userId);
    const field = `${type}_claimed_at`;
    const lastClaimed = user[field] ? new Date(user[field]).getTime() : 0;
    const now = Date.now();

    if (now - lastClaimed < cooldownMs) {
        const remaining = cooldownMs - (now - lastClaimed);
        return { onCooldown: true, remaining };
    }

    const newWallet = user.wallet + payout;
    const newEarned = user.total_earned + payout;

    const { data, error } = await supabase
        .from('users')
        .update({ wallet: newWallet, total_earned: newEarned, [field]: new Date().toISOString() })
        .eq('user_id', userId)
        .select()
        .single();

    if (error) throw error;
    return { onCooldown: false, data, payout };
}

// ============================================================
// INVENTORY
// ============================================================

async function addItem(userId, itemName, quantity = 1) {
    assertDb();
    await getUser(userId);

    const { data: existing } = await supabase
        .from('inventory')
        .select('*')
        .eq('user_id', userId)
        .eq('item_name', itemName)
        .single();

    if (existing) {
        const { data, error } = await supabase
            .from('inventory')
            .update({ quantity: existing.quantity + quantity })
            .eq('id', existing.id)
            .select()
            .single();
        if (error) throw error;
        return data;
    }

    const { data, error } = await supabase
        .from('inventory')
        .insert({ user_id: userId, item_name: itemName, quantity })
        .select()
        .single();

    if (error) throw error;
    return data;
}

async function getInventory(userId) {
    assertDb();
    const { data, error } = await supabase
        .from('inventory')
        .select('*')
        .eq('user_id', userId)
        .order('item_name', { ascending: true });

    if (error) throw error;
    return data || [];
}

async function removeItem(userId, itemName, quantity = 1) {
    assertDb();
    const { data: existing, error: selectErr } = await supabase
        .from('inventory')
        .select('*')
        .eq('user_id', userId)
        .eq('item_name', itemName)
        .single();

    if (selectErr) {
        if (selectErr.code === 'PGRST116') {
            // Row not found
            return;
        }
        throw selectErr;
    }

    if (existing.quantity <= quantity) {
        const { error: deleteErr } = await supabase
            .from('inventory')
            .delete()
            .eq('id', existing.id);
        if (deleteErr) throw deleteErr;
    } else {
        const { error: updateErr } = await supabase
            .from('inventory')
            .update({ quantity: existing.quantity - quantity })
            .eq('id', existing.id);
        if (updateErr) throw updateErr;
    }
}


// ============================================================
// JOBS
// ============================================================

async function getUserJob(userId) {
    assertDb();
    const { data, error } = await supabase
        .from('user_jobs')
        .select('*')
        .eq('user_id', userId)
        .single();

    if (error && error.code === 'PGRST116') return null;
    if (error) throw error;
    return data;
}

async function applyJob(userId, jobId) {
    assertDb();
    await getUser(userId);
    const { data, error } = await supabase
        .from('user_jobs')
        .insert({ user_id: userId, job_id: jobId })
        .select()
        .single();

    if (error) throw error;
    return data;
}

async function resignJob(userId) {
    assertDb();
    const { error } = await supabase
        .from('user_jobs')
        .delete()
        .eq('user_id', userId);

    if (error) throw error;
}

async function recordWork(userId, earned, promoted, newRank, newStreak, perfDelta, rankWorkCount) {
    assertDb();
    const job = await getUserJob(userId);
    if (!job) throw new Error('User has no job.');

    const now = new Date().toISOString();
    const updates = {
        rank_work_count:   promoted ? 1 : (rankWorkCount ?? job.rank_work_count + 1),
        total_work_count:  job.total_work_count + 1,
        total_earned:      job.total_earned + earned,
        last_worked_at:    now,
        streak:            newStreak,
        streak_last_at:    now,
        performance_score: (job.performance_score || 0) + (perfDelta || 0),
    };
    if (promoted) updates.rank = newRank;

    const { data, error } = await supabase
        .from('user_jobs')
        .update(updates)
        .eq('user_id', userId)
        .select()
        .single();

    if (error) throw error;
    return data;
}

async function prestigeJob(userId) {
    assertDb();
    const job = await getUserJob(userId);
    if (!job) throw new Error('User has no job.');

    const newPrestige = (job.prestige || 0) + 1;
    const newMultiplier = parseFloat((1 + newPrestige * 0.10).toFixed(2));

    const { data, error } = await supabase
        .from('user_jobs')
        .update({
            rank:            0,
            rank_work_count: 0,
            prestige:        newPrestige,
            pay_multiplier:  newMultiplier,
        })
        .eq('user_id', userId)
        .select()
        .single();

    if (error) throw error;
    return data;
}

// ============================================================
// XP / LEVELS
// ============================================================

const { getLevelFromXP } = require('./xp');

async function addXP(userId, amount) {
    assertDb();
    const user = await getUser(userId);
    const newXP    = (user.xp || 0) + amount;
    const newLevel = getLevelFromXP(newXP);
    const didLevel = newLevel > (user.level || 1);

    const { data, error } = await supabase
        .from('users')
        .update({ xp: newXP, level: newLevel })
        .eq('user_id', userId)
        .select()
        .single();

    if (error) throw error;
    return { data, didLevel, newLevel, xpGained: amount };
}

// ============================================================
// LOTTERY
// ============================================================

async function getLotteryState() {
    assertDb();
    const { data, error } = await supabase
        .from('lottery_state')
        .select('*')
        .eq('id', 1)
        .single();

    if (error && error.code === 'PGRST116') {
        const { data: newState, error: insertErr } = await supabase
            .from('lottery_state')
            .insert({ id: 1, pot: 0, round: 1, last_drawn_at: new Date(0).toISOString() })
            .select()
            .single();
        if (insertErr) throw insertErr;
        return newState;
    }
    if (error) throw error;
    return data;
}

async function buyLotteryTickets(userId, ticketCount, ticketCost) {
    assertDb();
    await getUser(userId);
    const totalCost = ticketCount * ticketCost;

    const user = await getUser(userId);
    if (user.wallet < totalCost) throw new Error('Insufficient wallet balance.');

    const state = await getLotteryState();

    // Deduct from wallet
    const { error: walletErr } = await supabase
        .from('users')
        .update({ wallet: user.wallet - totalCost })
        .eq('user_id', userId);
    if (walletErr) throw walletErr;

    // Add to pot
    const { error: potErr } = await supabase
        .from('lottery_state')
        .update({ pot: state.pot + totalCost })
        .eq('id', 1);
    if (potErr) throw potErr;

    // Upsert ticket entry
    const { data: existing } = await supabase
        .from('lottery_tickets')
        .select('*')
        .eq('user_id', userId)
        .eq('round', state.round)
        .single();

    if (existing) {
        const { error } = await supabase
            .from('lottery_tickets')
            .update({ ticket_count: existing.ticket_count + ticketCount })
            .eq('id', existing.id);
        if (error) throw error;
    } else {
        const { error } = await supabase
            .from('lottery_tickets')
            .insert({ user_id: userId, round: state.round, ticket_count: ticketCount });
        if (error) throw error;
    }

    return { pot: state.pot + totalCost, round: state.round };
}

async function getLotteryTickets(round) {
    assertDb();
    const { data, error } = await supabase
        .from('lottery_tickets')
        .select('*')
        .eq('round', round);
    if (error) throw error;
    return data || [];
}

async function getUserLotteryTickets(userId, round) {
    assertDb();
    const { data, error } = await supabase
        .from('lottery_tickets')
        .select('*')
        .eq('user_id', userId)
        .eq('round', round)
        .single();
    if (error && error.code === 'PGRST116') return null;
    if (error) throw error;
    return data;
}

async function drawLottery() {
    assertDb();
    const state = await getLotteryState();
    const tickets = await getLotteryTickets(state.round);

    if (tickets.length === 0) throw new Error('No tickets sold this round.');

    // Weighted random draw
    const pool = [];
    for (const t of tickets) {
        for (let i = 0; i < t.ticket_count; i++) pool.push(t.user_id);
    }
    const winnerId = pool[Math.floor(Math.random() * pool.length)];
    const pot = state.pot;
    const houseCut = Math.floor(pot * 0.05);
    const winnerPayout = pot - houseCut;

    // Pay winner
    const winner = await getUser(winnerId);
    await supabase
        .from('users')
        .update({ wallet: winner.wallet + winnerPayout, total_earned: winner.total_earned + winnerPayout })
        .eq('user_id', winnerId);

    // Advance round, reset pot
    const { error } = await supabase
        .from('lottery_state')
        .update({ pot: 0, round: state.round + 1, last_drawn_at: new Date().toISOString() })
        .eq('id', 1);
    if (error) throw error;

    const totalTickets = pool.length;
    const winnerEntry = tickets.find(t => t.user_id === winnerId);

    return {
        winnerId,
        winnerPayout,
        pot,
        round: state.round,
        totalTickets,
        winnerTickets: winnerEntry?.ticket_count || 0,
    };
}

// ============================================================
// PETS
// ============================================================

async function getActivePet(userId) {
    assertDb();
    const { data, error } = await supabase
        .from('user_pets')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .single();

    if (error && error.code === 'PGRST116') return null;
    if (error) throw error;
    return data;
}

async function getUserPets(userId) {
    assertDb();
    const { data, error } = await supabase
        .from('user_pets')
        .select('*')
        .eq('user_id', userId)
        .order('adopted_at', { ascending: true });

    if (error) throw error;
    return data || [];
}

async function adoptPet(userId, petType, name, rarity, cost) {
    assertDb();
    await getUser(userId);
    const user = await getUser(userId);
    if (user.wallet < cost) throw new Error('Insufficient wallet balance.');

    await updateWallet(userId, -cost);

    // Check if user has any pets — if not, new pet auto-activates
    const existing = await getUserPets(userId);
    const autoActive = existing.length === 0;

    const { data, error } = await supabase
        .from('user_pets')
        .insert({ user_id: userId, pet_type: petType, name, rarity, is_active: autoActive })
        .select()
        .single();

    if (error) throw error;
    return data;
}

async function updatePetStats(petId, stats) {
    assertDb();
    const { data, error } = await supabase
        .from('user_pets')
        .update({ ...stats, last_stat_decay: new Date().toISOString() })
        .eq('id', petId)
        .select()
        .single();

    if (error) throw error;
    return data;
}

async function feedPet(petId, userId) {
    assertDb();
    const { data: pet, error: fetchErr } = await supabase
        .from('user_pets')
        .select('*')
        .eq('id', petId)
        .eq('user_id', userId)
        .single();

    if (fetchErr) throw fetchErr;
    if (!pet) throw new Error('Pet not found.');

    if (pet.last_fed_at) {
        const elapsed = Date.now() - new Date(pet.last_fed_at).getTime();
        const { FEED_COOLDOWN_MS } = require('./pets');
        if (elapsed < FEED_COOLDOWN_MS) {
            return { onCooldown: true, remaining: FEED_COOLDOWN_MS - elapsed, pet };
        }
    }

    const { applyDecay, xpToNextLevel, MAX_LEVEL } = require('./pets');
    const decayed = applyDecay(pet);
    const newHunger = Math.min(100, decayed.hunger + 35);
    const newHealth = Math.min(100, decayed.health + 10);
    const xpGain    = 12;
    let   newXp     = decayed.xp + xpGain;
    let   newLevel  = decayed.level;
    let   leveledUp = false;

    while (newLevel < MAX_LEVEL) {
        const needed = xpToNextLevel(newLevel);
        if (newXp >= needed) { newXp -= needed; newLevel++; leveledUp = true; }
        else break;
    }

    const { data, error } = await supabase
        .from('user_pets')
        .update({
            hunger:          newHunger,
            health:          newHealth,
            happiness:       decayed.happiness,
            energy:          decayed.energy,
            xp:              newXp,
            level:           newLevel,
            last_fed_at:     new Date().toISOString(),
            last_stat_decay: new Date().toISOString(),
        })
        .eq('id', petId)
        .select()
        .single();

    if (error) throw error;
    return { onCooldown: false, pet: data, xpGain, leveledUp, newLevel };
}

async function playWithPet(petId, userId) {
    assertDb();
    const { data: pet, error: fetchErr } = await supabase
        .from('user_pets')
        .select('*')
        .eq('id', petId)
        .eq('user_id', userId)
        .single();

    if (fetchErr) throw fetchErr;
    if (!pet) throw new Error('Pet not found.');

    if (pet.last_played_at) {
        const elapsed = Date.now() - new Date(pet.last_played_at).getTime();
        const { PLAY_COOLDOWN_MS } = require('./pets');
        if (elapsed < PLAY_COOLDOWN_MS) {
            return { onCooldown: true, remaining: PLAY_COOLDOWN_MS - elapsed, pet };
        }
    }

    const { applyDecay, xpToNextLevel, MAX_LEVEL } = require('./pets');
    const decayed = applyDecay(pet);

    if (decayed.energy < 10) {
        return { noEnergy: true, pet: decayed };
    }

    const newHappiness = Math.min(100, decayed.happiness + 30);
    const newEnergy    = Math.max(0,   decayed.energy    - 15);
    const xpGain       = 18;
    let   newXp        = decayed.xp + xpGain;
    let   newLevel     = decayed.level;
    let   leveledUp    = false;

    while (newLevel < MAX_LEVEL) {
        const needed = xpToNextLevel(newLevel);
        if (newXp >= needed) { newXp -= needed; newLevel++; leveledUp = true; }
        else break;
    }

    const { data, error } = await supabase
        .from('user_pets')
        .update({
            happiness:       newHappiness,
            energy:          newEnergy,
            hunger:          decayed.hunger,
            health:          decayed.health,
            xp:              newXp,
            level:           newLevel,
            last_played_at:  new Date().toISOString(),
            last_stat_decay: new Date().toISOString(),
        })
        .eq('id', petId)
        .select()
        .single();

    if (error) throw error;
    return { onCooldown: false, noEnergy: false, pet: data, xpGain, leveledUp, newLevel };
}

async function setActivePet(userId, petId) {
    assertDb();
    // Deactivate all
    await supabase.from('user_pets').update({ is_active: false }).eq('user_id', userId);
    // Activate selected
    const { data, error } = await supabase
        .from('user_pets')
        .update({ is_active: true })
        .eq('id', petId)
        .eq('user_id', userId)
        .select()
        .single();

    if (error) throw error;
    return data;
}

async function renamePet(petId, userId, newName) {
    assertDb();
    const { data, error } = await supabase
        .from('user_pets')
        .update({ name: newName })
        .eq('id', petId)
        .eq('user_id', userId)
        .select()
        .single();

    if (error) throw error;
    return data;
}

async function releasePet(petId, userId) {
    assertDb();
    const { data: pet } = await supabase.from('user_pets').select('*').eq('id', petId).eq('user_id', userId).single();
    if (!pet) throw new Error('Pet not found.');

    await supabase.from('user_pets').delete().eq('id', petId);

    // If released pet was active, auto-activate oldest remaining
    if (pet.is_active) {
        const { data: remaining } = await supabase
            .from('user_pets').select('id').eq('user_id', userId).order('adopted_at', { ascending: true }).limit(1);
        if (remaining && remaining.length > 0) {
            await supabase.from('user_pets').update({ is_active: true }).eq('id', remaining[0].id);
        }
    }
    return pet;
}

async function evolvePet(petId, userId) {
    assertDb();
    const { data: pet } = await supabase.from('user_pets').select('*').eq('id', petId).eq('user_id', userId).single();
    if (!pet) throw new Error('Pet not found.');

    const { data, error } = await supabase
        .from('user_pets')
        .update({ evolution_stage: pet.evolution_stage + 1 })
        .eq('id', petId)
        .select()
        .single();

    if (error) throw error;
    return data;
}

// ============================================================
// FISHING
// ============================================================

async function getFishingStats(userId) {
    assertDb();
    const { data, error } = await supabase
        .from('user_fishing')
        .select('*')
        .eq('user_id', userId)
        .single();

    if (error && error.code === 'PGRST116') return null;
    if (error) throw error;
    return data;
}

async function recordCatch(userId, fish) {
    assertDb();
    await getUser(userId);

    const { error: catchErr } = await supabase
        .from('fishing_catches')
        .insert({
            user_id:  userId,
            fish_name: fish.name,
            rarity:   fish.rarity,
            weight:   fish.weight,
            value:    fish.value,
            rod_used: fish.rod,
        });
    if (catchErr) throw catchErr;

    const stats = await getFishingStats(userId);
    const isNewBiggest = !stats || fish.weight > (stats.biggest_catch_weight || 0);

    const updates = {
        total_caught:    (stats?.total_caught    || 0) + 1,
        total_earnings:  (stats?.total_earnings  || 0) + (fish.rarity === 'junk' ? 0 : fish.value),
        last_fished_at:  new Date().toISOString(),
    };
    if (isNewBiggest && fish.rarity !== 'junk') {
        updates.biggest_catch_name   = fish.name;
        updates.biggest_catch_weight = fish.weight;
    }

    if (stats) {
        const { error } = await supabase.from('user_fishing').update(updates).eq('user_id', userId);
        if (error) throw error;
    } else {
        const { error } = await supabase.from('user_fishing').insert({ user_id: userId, ...updates });
        if (error) throw error;
    }
}

async function getRecentCatches(userId, limit = 5) {
    assertDb();
    const { data, error } = await supabase
        .from('fishing_catches')
        .select('*')
        .eq('user_id', userId)
        .order('caught_at', { ascending: false })
        .limit(limit);

    if (error) throw error;
    return data || [];
}

// ============================================================
// MINING
// ============================================================

async function getMiningStats(userId) {
    assertDb();
    const { data, error } = await supabase
        .from('user_mining')
        .select('*')
        .eq('user_id', userId)
        .single();

    if (error && error.code === 'PGRST116') return null;
    if (error) throw error;
    return data;
}

async function recordFind(userId, ore) {
    assertDb();
    await getUser(userId);

    const { error: findErr } = await supabase
        .from('mining_finds')
        .insert({
            user_id:      userId,
            ore_name:     ore.name,
            rarity:       ore.rarity,
            quantity:     ore.quantity,
            value:        ore.value,
            pickaxe_used: ore.pickaxe,
        });
    if (findErr) throw findErr;

    const { RARITY_RANK } = require('./mining');
    const stats = await getMiningStats(userId);
    const currentRank  = RARITY_RANK[stats?.rarest_find_rarity] ?? -1;
    const newRank      = RARITY_RANK[ore.rarity] ?? 0;
    const isNewRarest  = newRank > currentRank;

    const updates = {
        total_mined:     (stats?.total_mined    || 0) + 1,
        total_earnings:  (stats?.total_earnings || 0) + (ore.rarity === 'junk' ? 0 : ore.value),
        last_mined_at:   new Date().toISOString(),
    };
    if (isNewRarest && ore.rarity !== 'junk') {
        updates.rarest_find_name   = ore.name;
        updates.rarest_find_rarity = ore.rarity;
    }

    if (stats) {
        const { error } = await supabase.from('user_mining').update(updates).eq('user_id', userId);
        if (error) throw error;
    } else {
        const { error } = await supabase.from('user_mining').insert({ user_id: userId, ...updates });
        if (error) throw error;
    }
}

async function getRecentFinds(userId, limit = 5) {
    assertDb();
    const { data, error } = await supabase
        .from('mining_finds')
        .select('*')
        .eq('user_id', userId)
        .order('found_at', { ascending: false })
        .limit(limit);

    if (error) throw error;
    return data || [];
}

// ============================================================
// LEADERBOARD
// ============================================================

/**
 * Fetch the top users for a given metric.
 * @param {'xp'|'coins'|'networth'} type
 * @param {string[]|null} userIds  - if provided, restricts to those user IDs (server scope)
 * @param {number} limit
 */
async function getLeaderboard(type, userIds = null, limit = 10) {
    assertDb();

    let query = supabase.from('users').select('user_id, xp, level, wallet, bank, total_earned');

    if (userIds && userIds.length > 0) {
        query = query.in('user_id', userIds);
    }

    if (type === 'xp') {
        query = query.order('xp', { ascending: false });
    } else if (type === 'coins') {
        // wallet + bank — compute in JS after fetch
        // fetch more rows so we can sort in memory when filtering
        query = query.order('total_earned', { ascending: false });
    } else if (type === 'networth') {
        query = query.order('total_earned', { ascending: false });
    }

    query = query.limit(userIds ? Math.min(userIds.length, 100) : 100);

    const { data, error } = await query;
    if (error) throw error;

    let rows = data || [];

    // Sort in-memory for coins / networth since we can't do computed columns easily
    if (type === 'coins') {
        rows.sort((a, b) => (b.wallet + b.bank) - (a.wallet + a.bank));
    } else if (type === 'networth') {
        rows.sort((a, b) => (b.wallet + b.bank) - (a.wallet + a.bank)); // approximate
    }

    return rows.slice(0, limit);
}

module.exports = {
    supabase,
    getUser,
    updateWallet,
    depositCoins,
    withdrawCoins,
    claimReward,
    addItem,
    getInventory,
    getUserJob,
    applyJob,
    resignJob,
    recordWork,
    prestigeJob,
    getLotteryState,
    buyLotteryTickets,
    getLotteryTickets,
    getUserLotteryTickets,
    drawLottery,
    getActivePet,
    getUserPets,
    adoptPet,
    updatePetStats,
    feedPet,
    playWithPet,
    setActivePet,
    renamePet,
    releasePet,
    evolvePet,
    addXP,
    removeItem,
    getFishingStats,
    recordCatch,
    getRecentCatches,
    getMiningStats,
    recordFind,
    getRecentFinds,
    checkAndSetCooldown,
    resetCooldown,
    getUserCooldowns,
    hasItem,
    getStock,
    getStocksByExchange,
    updateStockPrices,
    getStaleTickers,
    getUserHolding,
    getUserPortfolio,
    buyStock,
    sellStock,
    getLeaderboard,
    getUserStreak,
    updateDailyStreak,
    getActiveQuests,
    updateQuestProgress,
};

// ============================================================
// ACTIVITY COOLDOWNS
// ============================================================

async function checkAndSetCooldown(userId, action, durationMs) {
    assertDb();
    await getUser(userId);

    const { data } = await supabase
        .from('user_cooldowns')
        .select('expires_at')
        .eq('user_id', userId)
        .eq('action', action)
        .single();

    const now = Date.now();
    if (data && new Date(data.expires_at).getTime() > now) {
        return { onCooldown: true, remaining: new Date(data.expires_at).getTime() - now };
    }

    const expiresAt = new Date(now + durationMs).toISOString();
    await supabase
        .from('user_cooldowns')
        .upsert({ user_id: userId, action, expires_at: expiresAt }, { onConflict: 'user_id,action' });

    return { onCooldown: false };
}

async function resetCooldown(userId, action) {
    assertDb();

    // 1. Reset all cooldown types if action is 'all'
    if (!action || action === 'all') {
        await supabase.from('user_cooldowns').delete().eq('user_id', userId);
        await supabase
            .from('users')
            .update({
                daily_claimed_at: null,
                weekly_claimed_at: null,
                monthly_claimed_at: null
            })
            .eq('user_id', userId);
        await supabase
            .from('user_jobs')
            .update({ last_worked_at: null })
            .eq('user_id', userId);

        const { cooldowns } = require('./cooldowns');
        for (const [cmd, userMap] of cooldowns) {
            userMap.delete(userId);
        }
        return;
    }

    // 2. Specific claims: daily, weekly, monthly
    if (['daily', 'weekly', 'monthly'].includes(action)) {
        const field = `${action}_claimed_at`;
        const { error } = await supabase
            .from('users')
            .update({ [field]: null })
            .eq('user_id', userId);
        if (error) throw error;
        return;
    }

    // 3. Work cooldown
    if (action === 'work') {
        const { error } = await supabase
            .from('user_jobs')
            .update({ last_worked_at: null })
            .eq('user_id', userId);
        if (error) throw error;
        return;
    }

    // 4. Activity database cooldowns
    if (['chop', 'dig', 'fish', 'hunt', 'mine'].includes(action)) {
        const { error } = await supabase
            .from('user_cooldowns')
            .delete()
            .eq('user_id', userId)
            .eq('action', action);
        if (error) throw error;
        return;
    }

    // 5. In-memory command cooldowns
    const { cooldowns } = require('./cooldowns');
    if (action === 'rob') {
        if (cooldowns.has('rob')) {
            cooldowns.get('rob').delete(userId);
        }
        for (const [cmdName, userMap] of cooldowns) {
            if (cmdName.startsWith('rob_')) {
                userMap.delete(userId);
            }
        }
    } else {
        if (cooldowns.has(action)) {
            cooldowns.get(action).delete(userId);
        }
    }
}

async function getUserCooldowns(userId) {
    assertDb();
    const { data, error } = await supabase
        .from('user_cooldowns')
        .select('*')
        .eq('user_id', userId);
    if (error) throw error;
    return data || [];
}



async function hasItem(userId, itemName) {
    assertDb();
    const { data } = await supabase
        .from('inventory')
        .select('quantity')
        .eq('user_id', userId)
        .ilike('item_name', itemName)
        .single();

    return !!(data && data.quantity >= 1);
}


// ============================================================
// STOCK MARKET
// ============================================================

async function getStock(ticker) {
    assertDb();
    const { data, error } = await supabase
        .from('stocks')
        .select('*')
        .eq('ticker', ticker.toUpperCase())
        .single();
    if (error) return null;
    return data;
}

async function getStocksByExchange(exchange) {
    assertDb();
    const { data, error } = await supabase
        .from('stocks')
        .select('*')
        .eq('exchange', exchange)
        .order('ticker', { ascending: true });
    if (error) throw error;
    return data || [];
}

async function updateStockPrices(updates) {
    assertDb();
    const now = new Date().toISOString();
    await Promise.all(updates.map(u =>
        supabase.from('stocks').update({
            previous_price: u.previous_price,
            current_price:  u.current_price,
            change_pct:     u.change_pct,
            last_updated:   now,
        }).eq('ticker', u.ticker)
    ));
}

async function getStaleTickers(cutoffMs) {
    assertDb();
    const cutoff = new Date(Date.now() - cutoffMs).toISOString();
    const { data, error } = await supabase
        .from('stocks')
        .select('ticker, exchange, current_price, base_price, volatility')
        .lt('last_updated', cutoff);
    if (error) throw error;
    return data || [];
}

async function getUserHolding(userId, ticker) {
    assertDb();
    const { data, error } = await supabase
        .from('user_stocks')
        .select('*')
        .eq('user_id', userId)
        .eq('ticker', ticker.toUpperCase())
        .single();
    if (error) return null;
    return data;
}

async function getUserPortfolio(userId) {
    assertDb();
    const { data, error } = await supabase
        .from('user_stocks')
        .select('*, stocks(company_name, exchange, current_price, change_pct)')
        .eq('user_id', userId)
        .order('ticker', { ascending: true });
    if (error) throw error;
    return data || [];
}

async function buyStock(userId, ticker, shares, pricePerShare) {
    assertDb();
    await getUser(userId);
    ticker = ticker.toUpperCase();
    const total = pricePerShare * shares;

    const profile = await getUser(userId);
    if (profile.wallet < total) throw new Error('INSUFFICIENT_FUNDS');

    await updateWallet(userId, -total);

    const existing = await getUserHolding(userId, ticker);
    if (existing) {
        const newShares   = existing.shares + shares;
        const newAvgPrice = ((existing.shares * existing.avg_buy_price) + (shares * pricePerShare)) / newShares;
        const { error } = await supabase
            .from('user_stocks')
            .update({ shares: newShares, avg_buy_price: Math.round(newAvgPrice * 100) / 100 })
            .eq('user_id', userId)
            .eq('ticker', ticker);
        if (error) throw error;
    } else {
        const { error } = await supabase
            .from('user_stocks')
            .insert({ user_id: userId, ticker, shares, avg_buy_price: pricePerShare });
        if (error) throw error;
    }

    await supabase.from('stock_transactions').insert({
        user_id: userId, ticker, type: 'buy', shares,
        price_per_share: pricePerShare, total,
    });

    return { total };
}

async function sellStock(userId, ticker, shares, pricePerShare) {
    assertDb();
    ticker = ticker.toUpperCase();
    const holding = await getUserHolding(userId, ticker);
    if (!holding) throw new Error('NO_HOLDING');
    if (holding.shares < shares) throw new Error('INSUFFICIENT_SHARES');

    const total = pricePerShare * shares;
    await updateWallet(userId, total);

    if (holding.shares === shares) {
        await supabase.from('user_stocks').delete()
            .eq('user_id', userId).eq('ticker', ticker);
    } else {
        await supabase.from('user_stocks')
            .update({ shares: holding.shares - shares })
            .eq('user_id', userId).eq('ticker', ticker);
    }

    await supabase.from('stock_transactions').insert({
        user_id: userId, ticker, type: 'sell', shares,
        price_per_share: pricePerShare, total,
    });

    return { total, profitLoss: (pricePerShare - holding.avg_buy_price) * shares };
}

// ============================================================
// STREAKS & QUESTS
// ============================================================

async function getUserStreak(userId) {
    assertDb();
    await getUser(userId);
    const { data, error } = await supabase
        .from('user_streaks')
        .select('*')
        .eq('user_id', userId)
        .single();
    if (error && error.code === 'PGRST116') {
        const { data: newStreak, error: insertErr } = await supabase
            .from('user_streaks')
            .insert({ user_id: userId })
            .select()
            .single();
        if (insertErr) throw insertErr;
        return newStreak;
    }
    if (error) throw error;
    return data;
}

async function updateDailyStreak(userId) {
    assertDb();
    const streak = await getUserStreak(userId);
    const now = new Date();
    const lastClaim = streak.last_daily_at ? new Date(streak.last_daily_at) : null;
    
    let newStreak = streak.daily_streak;
    if (!lastClaim) {
        newStreak = 1;
    } else {
        const diffMs = now.getTime() - lastClaim.getTime();
        const diffHours = diffMs / (1000 * 60 * 60);
        if (diffHours >= 24 && diffHours < 48) {
            newStreak += 1;
        } else if (diffHours >= 48) {
            newStreak = 1;
        }
    }

    const highest = Math.max(streak.highest_streak, newStreak);

    const { data, error } = await supabase
        .from('user_streaks')
        .update({
            daily_streak: newStreak,
            highest_streak: highest,
            last_daily_at: now.toISOString(),
            updated_at: now.toISOString()
        })
        .eq('user_id', userId)
        .select()
        .single();
    if (error) throw error;
    return data;
}

async function getActiveQuests(userId) {
    assertDb();
    await getUser(userId);
    const { generateQuestsForUser } = require('./quests');
    const now = new Date().toISOString();
    const { data, error } = await supabase
        .from('user_quests')
        .select('*')
        .eq('user_id', userId)
        .gt('expires_at', now);
    
    if (error) throw error;
    if (data && data.length > 0) return data;

    const newQuests = generateQuestsForUser().map(q => ({ ...q, user_id: userId }));
    const { data: inserted, error: insertErr } = await supabase
        .from('user_quests')
        .insert(newQuests)
        .select();
    
    if (insertErr) throw insertErr;
    return inserted;
}

async function updateQuestProgress(userId, questType, amount = 1) {
    try {
        assertDb();
        const now = new Date().toISOString();
        const { data: quests, error } = await supabase
            .from('user_quests')
            .select('*')
            .eq('user_id', userId)
            .eq('quest_type', questType)
            .eq('completed', false)
            .gt('expires_at', now);
        
        if (error || !quests || quests.length === 0) return;

        for (const q of quests) {
            const newProgress = Math.min(q.target, q.progress + amount);
            const completed = newProgress >= q.target;
            
            await supabase
                .from('user_quests')
                .update({ progress: newProgress, completed })
                .eq('user_id', userId)
                .eq('quest_id', q.quest_id);

            if (completed) {
                // Award rewards!
                await updateWallet(userId, q.reward_coins);
                await addXP(userId, q.reward_xp).catch(() => null);
            }
        }
    } catch (err) {
        console.error('[QUEST PROGRESS ERROR]', err);
    }
}


