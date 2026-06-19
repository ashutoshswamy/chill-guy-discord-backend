const {
    SlashCommandBuilder,
    ContainerBuilder, SectionBuilder, TextDisplayBuilder, ThumbnailBuilder,
    SeparatorBuilder, SeparatorSpacingSize, MessageFlags
} = require('discord.js');
const db = require('../../utils/db');
const { XP_REWARDS } = require('../../utils/xp');
const { getEmoji } = require('../../utils/emojis');

const coin = getEmoji('coin');

const HORSES = [
    { name: 'Thunderbolt',  emoji: '', odds: 2.0,  speed: [3,4,5,6,5,4,5,6,5,4] },
    { name: 'Lucky Charm',  emoji: '', odds: 3.5,  speed: [2,3,4,5,6,7,8,5,3,2] },
    { name: 'Iron Hooves',  emoji: '', odds: 2.5,  speed: [4,4,4,4,4,4,4,4,4,4] },
    { name: 'Midnight Run',  emoji: '', odds: 5.0,  speed: [1,2,3,4,5,6,7,8,9,8] },
    { name: 'Chill Guy',    emoji: '', odds: 8.0,  speed: [1,1,2,2,3,4,5,8,10,12] },
];

const TRACK_LEN = 20;

function simulateRace() {
    const positions = new Array(HORSES.length).fill(0);
    const steps = [];

    while (positions.every(p => p < TRACK_LEN)) {
        for (let i = 0; i < HORSES.length; i++) {
            const speedArr = HORSES[i].speed;
            const stepIdx = Math.min(Math.floor(positions[i] / (TRACK_LEN / speedArr.length)), speedArr.length - 1);
            const base = speedArr[stepIdx];
            positions[i] = Math.min(TRACK_LEN, positions[i] + Math.ceil(Math.random() * base));
        }
        steps.push([...positions]);
    }

    const maxPos = Math.max(...positions);
    const finishers = positions.map((p, i) => ({ i, p })).filter(x => x.p >= maxPos);
    const winnerId = finishers[Math.floor(Math.random() * finishers.length)].i;
    return { positions, steps, winnerId };
}

function renderTrack(positions) {
    return HORSES.map((h, i) => {
        const pos = Math.min(positions[i], TRACK_LEN);
        const pct = Math.floor((pos / TRACK_LEN) * 15);
        const trail = '─'.repeat(pct);
        const remaining = '─'.repeat(15 - pct);
        return `\`|${trail}${remaining}|\` ${h.name}`;
    }).join('\n');
}

const COOLDOWN_MS = 10 * 1000;

module.exports = {
    data: new SlashCommandBuilder()
        .setName('horserace')
        .setDescription('Bet on a horse race. Higher odds = bigger payout, lower win chance.')
        .addIntegerOption(opt =>
            opt.setName('amount')
                .setDescription('Amount to bet from your wallet')
                .setMinValue(10)
                .setRequired(true))
        .addStringOption(opt =>
            opt.setName('horse')
                .setDescription('Which horse to bet on?')
                .setRequired(true)
                .addChoices(
                    ...HORSES.map(h => ({ name: `${h.name} (${h.odds}x)`, value: h.name }))
                )),

    async execute(interaction) {
        const { user } = interaction;
        const amount = interaction.options.getInteger('amount');
        const horseName = interaction.options.getString('horse');
        const horseIdx = HORSES.findIndex(h => h.name === horseName);
        const horse = HORSES[horseIdx];

        const cd = await db.checkAndSetCooldown(user.id, 'horserace', COOLDOWN_MS);
        if (cd.onCooldown) {
            const s = Math.ceil(cd.remaining / 1000);
            return interaction.editReply({ content: `On cooldown! Try again in **${s}s**.`, ephemeral: true });
        }

        try {
            const profile = await db.getUser(user.id);
            if (profile.wallet < amount) {
                return interaction.editReply({ content: `Not enough coins. You have ${coin} **${profile.wallet.toLocaleString()}** in wallet.`, ephemeral: true });
            }

            await db.updateWallet(user.id, -amount);

            const { steps, winnerId } = simulateRace();
            const winner = HORSES[winnerId];
            const won = winnerId === horseIdx;
            const payout = won ? Math.floor(amount * horse.odds) : 0;

            // Show animated race in steps
            const DISPLAY_STEPS = 5;
            const stepInterval = Math.max(1, Math.floor(steps.length / DISPLAY_STEPS));
            const displaySteps = [];
            for (let i = 0; i < steps.length; i += stepInterval) displaySteps.push(steps[i]);
            if (displaySteps[displaySteps.length - 1] !== steps[steps.length - 1]) {
                displaySteps.push(steps[steps.length - 1]);
            }

            const buildRaceContainer = (positions, finished = false) => {
                const finalPositions = finished ? new Array(HORSES.length).fill(TRACK_LEN) : positions;
                // Show winner at finish
                const trackPositions = finished
                    ? positions.map((p, i) => i === winnerId ? TRACK_LEN : Math.min(p, TRACK_LEN - 1))
                    : positions;

                const container = new ContainerBuilder()
                    .addSectionComponents(
                        new SectionBuilder()
                            .addTextDisplayComponents(
                                new TextDisplayBuilder().setContent(
                                    finished
                                        ? `## Race Finished - ${won ? 'You Won!' : 'You Lost!'}`
                                        : `## Horse Race - In Progress...`
                                )
                            )
                            .setThumbnailAccessory(new ThumbnailBuilder().setURL(user.displayAvatarURL({ forceStatic: true })))
                    )
                    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(
                            `${renderTrack(trackPositions)}\n\n` +
                            `**Your Bet:** ${horse.name} @ ${horse.odds}x\n` +
                            `**Bet:** ${coin} ${amount.toLocaleString()} coins` +
                            (finished ? `\n**Winner:** ${winner.name}\n${won ? `**Won:** ${coin} +${(payout - amount).toLocaleString()} coins` : `**Lost:** ${coin} -${amount.toLocaleString()} coins`}` : '')
                        )
                    );

                return container;
            };

            // Animate through steps
            const STEP_DELAY = 1200;
            for (let s = 0; s < displaySteps.length - 1; s++) {
                const c = buildRaceContainer(displaySteps[s]);
                await interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [c] });
                await new Promise(r => setTimeout(r, STEP_DELAY));
            }

            // Final frame
            if (payout > 0) {
                await db.updateWallet(user.id, payout);
                db.addXP(user.id, XP_REWARDS.gamblingWin).catch(() => null);
            }
            const updated = await db.getUser(user.id);

            const final = buildRaceContainer(steps[steps.length - 1], true);
            final.addTextDisplayComponents(
                new TextDisplayBuilder().setContent(`**Wallet:** ${coin} ${updated.wallet.toLocaleString()} coins`)
            );
            await interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [final] });

        } catch (err) {
            console.error('[HORSERACE ERROR]', err);
            const msg = { content: 'Horse race crashed.', ephemeral: true };
            if (interaction.replied || interaction.deferred) await interaction.followUp(msg).catch(() => null);
            else await interaction.editReply(msg).catch(() => null);
        }
    }
};
