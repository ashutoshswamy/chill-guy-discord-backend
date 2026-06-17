const {
    SlashCommandBuilder,
    ContainerBuilder, TextDisplayBuilder,
    SeparatorBuilder, SeparatorSpacingSize, MessageFlags,
    ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle
} = require('discord.js');
const db = require('../../utils/db');
const { getEmoji } = require('../../utils/emojis');

const coin = getEmoji('coin');

const COOLDOWN_MS  = 45 * 60 * 1000; // 45 minutes
const MAX_GUESSES  = 6;
const WORD_LENGTH  = 5;
const WIN_REWARDS  = [2000, 1600, 1200, 900, 600, 300]; // reward by guess number

const WORD_LIST = [
    'APPLE','BRAVE','CRANE','DREAM','EARTH','FLAME','GRACE','HAPPY','IVORY','JUICE',
    'KNACK','LIGHT','MUSIC','NOBLE','OCEAN','PEARL','QUEST','RIVER','STORM','TIGER',
    'ULTRA','VOICE','WHEEL','XENON','YACHT','ZEBRA','AGENT','BLAZE','CHESS','DISCO',
    'EAGLE','FROST','GHOST','HEDGE','IRONY','JOLLY','KNIFE','LEMON','MAPLE','NURSE',
    'ORBIT','PILOT','QUICK','RADAR','SNOWY','TORCH','URBAN','VALID','WALTZ','XYLEM',
    'YIELD','ZINGY','ALOFT','BRISK','CHUNK','DROOP','EXILE','FIZZY','GRASP','HUMOR',
    'IRATE','JUMPY','KNEEL','LUSTY','MOSSY','NOTCH','OCTET','PLAZA','RISKY','SHADY',
    'TRAMP','UNIFY','VIVID','WRATH','EXACT','LOBBY','BOXER','CRISP','DEITY','EVOKE',
    'FLANK','GLOOM','HARSH','INFER','JAZZY','KINKY','LEAPT','MARSH','NERVE','OPTIC',
    'PROXY','RAINY','SMASH','TEMPO','USHER','VIOLA','WHIRL','EXPEL','ABIDE','BLUNT',
];

// Returns array of { letter, status: 'correct'|'present'|'absent' }
function checkGuess(guess, answer) {
    const result = Array(WORD_LENGTH).fill(null).map((_, i) => ({ letter: guess[i], status: 'absent' }));
    const answerCopy = answer.split('');
    // First pass: correct positions
    for (let i = 0; i < WORD_LENGTH; i++) {
        if (guess[i] === answer[i]) {
            result[i].status = 'correct';
            answerCopy[i] = null;
        }
    }
    // Second pass: present but wrong position
    for (let i = 0; i < WORD_LENGTH; i++) {
        if (result[i].status !== 'correct') {
            const idx = answerCopy.indexOf(guess[i]);
            if (idx !== -1) {
                result[i].status = 'present';
                answerCopy[idx] = null;
            }
        }
    }
    return result;
}

function renderRow(checked) {
    const ICONS = { correct: '[G]', present: '[Y]', absent: '[-]' };
    return checked.map(c => `${ICONS[c.status]} **${c.letter}**`).join('  ');
}

function renderEmptyRow() {
    return '[ ] \\_  '.repeat(WORD_LENGTH).trim();
}

function buildContainer(guesses, answer, won, lost, user) {
    let boardText = '';
    for (let i = 0; i < MAX_GUESSES; i++) {
        if (i < guesses.length) {
            boardText += renderRow(checkGuess(guesses[i], answer)) + '\n';
        } else {
            boardText += renderEmptyRow() + '\n';
        }
    }

    let statusLine = `-# Type a 5-letter word and press **Guess** — attempt ${guesses.length + 1}/${MAX_GUESSES}`;
    if (won) {
        const reward = WIN_REWARDS[guesses.length - 1] || 300;
        statusLine = `**You got it in ${guesses.length}!** +${coin} **${reward.toLocaleString()}** coins!`;
    } else if (lost) {
        statusLine = `**Game over!** The word was **${answer}**.`;
    }

    // Track which letters have been used
    const usedCorrect  = new Set();
    const usedPresent  = new Set();
    const usedAbsent   = new Set();
    for (const g of guesses) {
        const checked = checkGuess(g, answer);
        for (const c of checked) {
            if (c.status === 'correct') usedCorrect.add(c.letter);
            else if (c.status === 'present') usedPresent.add(c.letter);
            else usedAbsent.add(c.letter);
        }
    }

    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let keyboardLine = '';
    for (const l of alphabet) {
        if (usedCorrect.has(l)) keyboardLine += `[G]${l} `;
        else if (usedPresent.has(l)) keyboardLine += `[Y]${l} `;
        else if (usedAbsent.has(l)) keyboardLine += `[-]${l} `;
        else keyboardLine += `${l} `;
    }

    const container = new ContainerBuilder()
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`## Word Guess\n-# Guess the 5-letter word!`)
        )
        .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(boardText.trim()))
        .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`**Keyboard:**\n${keyboardLine.trim()}`))
        .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(statusLine));

    if (!won && !lost) {
        container.addActionRowComponents(
            new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('wordguess_guess')
                    .setLabel('Enter Guess')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('wordguess_quit')
                    .setLabel('Give Up')
                    .setStyle(ButtonStyle.Danger)
            )
        );
    }

    return container;
}

// Active games stored in memory: userId -> { answer, guesses }
const activeGames = new Map();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('wordguess')
        .setDescription('Play a Wordle-style word guessing game to win coins!'),

    async execute(interaction) {
        const { user } = interaction;

        if (activeGames.has(user.id)) {
            return interaction.editReply({ content: 'You already have a Word Guess game running! Finish it first.', ephemeral: true });
        }

        const cd = await db.checkAndSetCooldown(user.id, 'wordguess', COOLDOWN_MS);
        if (cd.onCooldown) {
            const rem = cd.remaining;
            const m = Math.floor(rem / 60000), s = Math.floor((rem % 60000) / 1000);
            return interaction.editReply({
                content: `You played recently! Come back in **${m}m ${s}s**.`,
                ephemeral: true
            });
        }

        const answer = WORD_LIST[Math.floor(Math.random() * WORD_LIST.length)];
        activeGames.set(user.id, { answer, guesses: [] });

        const response = await interaction.editReply({
            flags: MessageFlags.IsComponentsV2,
            components: [buildContainer([], answer, false, false, user)]
        });

        const collector = response.createMessageComponentCollector({
            filter: i => i.user.id === user.id,
            time: 10 * 60 * 1000, // 10 min max
        });

        collector.on('collect', async i => {
            const game = activeGames.get(user.id);
            if (!game) return;

            if (i.customId === 'wordguess_quit') {
                await i.deferUpdate();
                activeGames.delete(user.id);
                collector.stop('quit');
                await interaction.editReply({
                    flags: MessageFlags.IsComponentsV2,
                    components: [buildContainer(game.guesses, game.answer, false, true, user)]
                }).catch(() => null);
                return;
            }

            if (i.customId === 'wordguess_guess') {
                // Show modal for guess input
                const modal = new ModalBuilder()
                    .setCustomId('wordguess_modal')
                    .setTitle('Enter your 5-letter guess');

                const input = new TextInputBuilder()
                    .setCustomId('wordguess_input')
                    .setLabel('Your guess (5 letters)')
                    .setStyle(TextInputStyle.Short)
                    .setMinLength(5)
                    .setMaxLength(5)
                    .setPlaceholder('e.g. CRANE')
                    .setRequired(true);

                modal.addComponents(new ActionRowBuilder().addComponents(input));
                await i.showModal(modal);

                // Wait for modal submit
                try {
                    const submitted = await i.awaitModalSubmit({ time: 30_000, filter: m => m.user.id === user.id });
                    const guess = submitted.fields.getTextInputValue('wordguess_input').toUpperCase().trim();

                    await submitted.deferUpdate();

                    if (guess.length !== WORD_LENGTH || !/^[A-Z]+$/.test(guess)) {
                        await submitted.followUp({ content: 'Please enter exactly 5 letters (A–Z only).', ephemeral: true }).catch(() => null);
                        return;
                    }

                    game.guesses.push(guess);
                    const won  = guess === game.answer;
                    const lost = !won && game.guesses.length >= MAX_GUESSES;

                    if (won) {
                        const reward = WIN_REWARDS[game.guesses.length - 1] || 300;
                        await db.updateWallet(user.id, reward);
                        await db.addXP(user.id, 25).catch(() => null);
                        activeGames.delete(user.id);
                        collector.stop('won');
                    } else if (lost) {
                        activeGames.delete(user.id);
                        collector.stop('lost');
                    }

                    await interaction.editReply({
                        flags: MessageFlags.IsComponentsV2,
                        components: [buildContainer(game.guesses, game.answer, won, lost, user)]
                    }).catch(() => null);
                } catch {
                    // Modal timed out — do nothing
                }
            }
        });

        collector.on('end', async (_, reason) => {
            if (reason === 'time') {
                const game = activeGames.get(user.id);
                activeGames.delete(user.id);
                if (game) {
                    await interaction.editReply({
                        flags: MessageFlags.IsComponentsV2,
                        components: [buildContainer(game.guesses, game.answer, false, true, user)]
                    }).catch(() => null);
                }
            }
        });
    }
};
