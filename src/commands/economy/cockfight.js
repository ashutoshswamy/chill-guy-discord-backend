const {
    SlashCommandBuilder,
    ContainerBuilder, SectionBuilder, TextDisplayBuilder, ThumbnailBuilder,
    SeparatorBuilder, SeparatorSpacingSize, MessageFlags
} = require('discord.js');
const db = require('../../utils/db');
const { XP_REWARDS } = require('../../utils/xp');
const { getEmoji } = require('../../utils/emojis');

const coin = getEmoji('coin');

const ROOSTER_NAMES = [
    'Red Fury', 'Iron Beak', 'Shadow Talon', 'Golden Spur', 'Crimson Crest',
    'Night Terror', 'Blood Moon', 'Storm Wing', 'Savage Cluck', 'Death Peck',
    'El Diablo', 'The Butcher', 'Razor Feather', 'Black Thunder', 'Grim Spurs',
];

const FIGHT_MOVES = [
    ['{a} lunges forward and slashes {b} with its spurs!', 2],
    ['{a} dodges and delivers a lightning-fast counter-peck!', 1],
    ['{a} pins {b} to the ground with brute force!', 3],
    ['{a} catches {b} off guard with a spinning talon strike!', 2],
    ['{a} feints left and drives its beak straight into {b}!', 2],
    ['{a} jumps high and comes down hard on {b}!', 3],
    ['{a} takes a glancing blow but shakes it off!', 0],
    ['{a} headbutts {b} - unorthodox but effective!', 1],
];

function randName() {
    return ROOSTER_NAMES[Math.floor(Math.random() * ROOSTER_NAMES.length)];
}

function randStat(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function statBar(val, max = 10) {
    const filled = Math.round((val / max) * 8);
    return '█'.repeat(filled) + '░'.repeat(8 - filled);
}

function simulateFight(playerRooster, enemyRooster) {
    let pH = playerRooster.hp, eH = enemyRooster.hp;
    const rounds = [];

    for (let r = 0; r < 6 && pH > 0 && eH > 0; r++) {
        // Player attacks
        const pMove = FIGHT_MOVES[Math.floor(Math.random() * FIGHT_MOVES.length)];
        const pDmg = Math.max(0, pMove[1] + playerRooster.attack - enemyRooster.defense + Math.floor(Math.random() * 3));
        eH = Math.max(0, eH - pDmg);

        const pLine = pMove[0]
            .replace('{a}', `**${playerRooster.name}**`)
            .replace('{b}', `**${enemyRooster.name}**`);

        if (eH <= 0) { rounds.push({ line: pLine, dmg: pDmg, pHP: pH, eHP: 0 }); break; }

        // Enemy attacks
        const eMove = FIGHT_MOVES[Math.floor(Math.random() * FIGHT_MOVES.length)];
        const eDmg = Math.max(0, eMove[1] + enemyRooster.attack - playerRooster.defense + Math.floor(Math.random() * 3));
        pH = Math.max(0, pH - eDmg);

        const eLine = eMove[0]
            .replace('{a}', `**${enemyRooster.name}**`)
            .replace('{b}', `**${playerRooster.name}**`);

        rounds.push({ line: `${pLine} *(−${pDmg} HP)*\n${eLine} *(−${eDmg} HP)*`, pHP: pH, eHP: eH });
        if (pH <= 0) break;
    }

    // If both still standing, higher HP wins
    const playerWon = eH <= 0 || (pH > 0 && pH >= eH);
    return { rounds, playerWon, finalPHP: pH, finalEHP: eH };
}

function buildContainer(user, playerRooster, enemyRooster, pHP, eHP, roundText, status, amount) {
    const isDone = status !== 'fighting';

    const container = new ContainerBuilder()
        .addSectionComponents(
            new SectionBuilder()
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        `## Cockfight${isDone ? (status === 'win' ? ' - You Won!' : ' - You Lost!') : ' - In Progress...'}`
                    )
                )
                .setThumbnailAccessory(new ThumbnailBuilder().setURL(user.displayAvatarURL({ forceStatic: true })))
        )
        .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `**${playerRooster.name}** (yours)\n` +
                `HP: \`[${statBar(Math.max(0, pHP), playerRooster.hp)}]\` ${Math.max(0, pHP)}/${playerRooster.hp}\n` +
                `ATK ${playerRooster.attack} | DEF ${playerRooster.defense} | SPD ${playerRooster.speed}\n\n` +
                `**${enemyRooster.name}** (rival)\n` +
                `HP: \`[${statBar(Math.max(0, eHP), enemyRooster.hp)}]\` ${Math.max(0, eHP)}/${enemyRooster.hp}\n` +
                `ATK ${enemyRooster.attack} | DEF ${enemyRooster.defense} | SPD ${enemyRooster.speed}`
            )
        )
        .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                roundText + `\n\n**Bet:** ${coin} **${amount.toLocaleString()}** coins`
            )
        );

    return container;
}

module.exports = {
    cooldown: 8,
    data: new SlashCommandBuilder()
        .setName('cockfight')
        .setDescription('Pit your rooster against a rival. Win to double your bet.')
        .addIntegerOption(opt =>
            opt.setName('amount')
                .setDescription('Amount to bet from your wallet')
                .setMinValue(10)
                .setRequired(true)),

    async execute(interaction) {
        const { user } = interaction;
        const amount = interaction.options.getInteger('amount');

        try {
            const profile = await db.getUser(user.id);
            if (profile.wallet < amount) {
                return interaction.editReply({ content: `Not enough coins. You have ${coin} **${profile.wallet.toLocaleString()}** in wallet.`, ephemeral: true });
            }

            // Generate roosters
            const playerRooster = {
                name: randName(),
                hp:      randStat(18, 28),
                attack:  randStat(2, 5),
                defense: randStat(1, 3),
                speed:   randStat(2, 5),
            };
            let enemyName;
            do { enemyName = randName(); } while (enemyName === playerRooster.name);
            const enemyRooster = {
                name: enemyName,
                hp:      randStat(18, 28),
                attack:  randStat(2, 5),
                defense: randStat(1, 3),
                speed:   randStat(2, 5),
            };

            const { rounds, playerWon, finalPHP, finalEHP } = simulateFight(
                JSON.parse(JSON.stringify(playerRooster)),
                JSON.parse(JSON.stringify(enemyRooster))
            );

            // Show intro frame
            const intro = buildContainer(
                user, playerRooster, enemyRooster,
                playerRooster.hp, enemyRooster.hp,
                `**The fight begins!**\n_${playerRooster.name}_ vs _${enemyRooster.name}_ - may the best bird win.`,
                'fighting', amount
            );
            await interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [intro] });

            // Animate rounds
            const STEP_DELAY = 1500;
            let pHP = playerRooster.hp, eHP = enemyRooster.hp;

            for (const round of rounds) {
                await new Promise(r => setTimeout(r, STEP_DELAY));
                pHP = round.pHP;
                eHP = round.eHP;
                const frame = buildContainer(
                    user, playerRooster, enemyRooster,
                    pHP, eHP,
                    `**Round ${rounds.indexOf(round) + 1}**\n${round.line}`,
                    'fighting', amount
                );
                await interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [frame] }).catch(() => null);
            }

            await new Promise(r => setTimeout(r, STEP_DELAY));

            // Settle bet
            const net = playerWon ? amount : -amount;
            await db.updateWallet(user.id, net);
            if (playerWon) db.addXP(user.id, XP_REWARDS.gamblingWin).catch(() => null);
            const updated = await db.getUser(user.id);

            const status = playerWon ? 'win' : 'lose';
            const final = buildContainer(
                user, playerRooster, enemyRooster,
                finalPHP, finalEHP,
                playerWon
                    ? `**${playerRooster.name}** stands victorious! ${enemyRooster.name} is down!`
                    : `**${playerRooster.name}** has fallen. ${enemyRooster.name} wins the pit.`,
                status, amount
            );
            final.addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `${playerWon ? `**Won:** ${coin} **+${amount.toLocaleString()}** coins` : `**Lost:** ${coin} **-${amount.toLocaleString()}** coins`}\n` +
                    `**Wallet:** ${coin} **${updated.wallet.toLocaleString()}** coins`
                )
            );

            await interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [final] }).catch(() => null);

        } catch (err) {
            console.error('[COCKFIGHT ERROR]', err);
            const msg = { content: 'Fight pit broke.', ephemeral: true };
            if (interaction.replied || interaction.deferred) await interaction.followUp(msg).catch(() => null);
            else await interaction.editReply(msg).catch(() => null);
        }
    }
};
