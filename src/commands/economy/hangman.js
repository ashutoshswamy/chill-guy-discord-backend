const {
    SlashCommandBuilder,
    ContainerBuilder, TextDisplayBuilder,
    SeparatorBuilder, SeparatorSpacingSize, MessageFlags,
    ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle
} = require('discord.js');
const db = require('../../utils/db');
const { getEmoji } = require('../../utils/emojis');

const coin = getEmoji('coin');
const COOLDOWN_MS = 30 * 60 * 1000;
const MAX_WRONG = 6;

const WORD_LIST = [
    'CHILL', 'WALLET', 'MINING', 'FISHING', 'HUNTING', 'CRAFTING', 'TRADING', 'LOTTERY',
    'BLACKJACK', 'ROULETTE', 'TRIVIA', 'QUEST', 'DAILY', 'WEEKLY', 'MONTHLY',
    'DIAMOND', 'EMERALD', 'SAPPHIRE', 'PRESTIGE', 'ROOSTER', 'TIMBER', 'PICKAXE',
    'APPLE', 'BRAVE', 'CRANE', 'DREAM', 'EARTH', 'FLAME', 'GRACE', 'HAPPY',
    'IVORY', 'JUICE', 'KNACK', 'LIGHT', 'MUSIC', 'NOBLE', 'OCEAN', 'PEARL',
    'RIVER', 'STORM', 'TIGER', 'ULTRA', 'VOICE', 'WHEEL', 'YACHT', 'ZEBRA',
    'GHOST', 'FROST', 'BLAZE', 'SCOUT', 'SPIKE', 'GLOOM', 'SMASH', 'TEMPO',
];

const STAGES = [
    '```\n  +---+\n      |\n      |\n      |\n      |\n=========```',
    '```\n  +---+\n  O   |\n      |\n      |\n      |\n=========```',
    '```\n  +---+\n  O   |\n  |   |\n      |\n      |\n=========```',
    '```\n  +---+\n  O   |\n /|   |\n      |\n      |\n=========```',
    '```\n  +---+\n  O   |\n /|\\  |\n      |\n      |\n=========```',
    '```\n  +---+\n  O   |\n /|\\  |\n /    |\n      |\n=========```',
    '```\n  +---+\n  O   |\n /|\\  |\n / \\  |\n      |\n=========```',
];

// reward scales with word length (difficulty)
function reward(word) {
    if (word.length <= 4) return 200;
    if (word.length <= 6) return 400;
    if (word.length <= 8) return 650;
    return 900;
}

function buildDisplay(word, guessed, wrongCount, won, lost) {
    const display = word.split('').map(l => guessed.has(l) ? `**${l}**` : '\\_').join(' ');
    const wrong = [...guessed].filter(l => !word.includes(l));

    let status;
    if (won) status = `**You got it!** The word was **${word}**! +${coin} **${reward(word).toLocaleString()}** coins!`;
    else if (lost) status = `**Game over!** The word was **${word}**.`;
    else status = `-# Guess a letter — ${wrongCount}/${MAX_WRONG} wrong`;

    const container = new ContainerBuilder()
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## Hangman\n-# Guess the word letter by letter!`))
        .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(STAGES[wrongCount]))
        .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(
            `**Word:** ${display}\n**Wrong:** ${wrong.length ? wrong.join(', ') : 'none'}\n\n${status}`
        ));

    if (!won && !lost) {
        container.addActionRowComponents(
            new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('hangman_guess').setLabel('Guess Letter').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('hangman_quit').setLabel('Give Up').setStyle(ButtonStyle.Danger)
            )
        );
    }
    return container;
}

const activeGames = new Map();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('hangman')
        .setDescription('Guess the hidden word letter by letter to win coins!'),

    async execute(interaction) {
        const { user } = interaction;

        if (activeGames.has(user.id)) {
            return interaction.editReply({ content: 'You already have a Hangman game running! Finish it first.', ephemeral: true });
        }

        const cd = await db.checkAndSetCooldown(user.id, 'hangman', COOLDOWN_MS);
        if (cd.onCooldown) {
            const m = Math.floor(cd.remaining / 60000), s = Math.floor((cd.remaining % 60000) / 1000);
            return interaction.editReply({ content: `On cooldown! Come back in **${m}m ${s}s**.`, ephemeral: true });
        }

        const word = WORD_LIST[Math.floor(Math.random() * WORD_LIST.length)];
        activeGames.set(user.id, { word, guessed: new Set(), wrongCount: 0 });

        const response = await interaction.editReply({
            flags: MessageFlags.IsComponentsV2,
            components: [buildDisplay(word, new Set(), 0, false, false)]
        });

        const collector = response.createMessageComponentCollector({
            filter: i => i.user.id === user.id,
            time: 10 * 60 * 1000,
        });

        collector.on('collect', async i => {
            const game = activeGames.get(user.id);
            if (!game) return;

            if (i.customId === 'hangman_quit') {
                await i.deferUpdate();
                activeGames.delete(user.id);
                collector.stop('quit');
                await interaction.editReply({
                    flags: MessageFlags.IsComponentsV2,
                    components: [buildDisplay(game.word, game.guessed, game.wrongCount, false, true)]
                }).catch(() => null);
                return;
            }

            if (i.customId === 'hangman_guess') {
                const modal = new ModalBuilder().setCustomId('hangman_modal').setTitle('Guess a Letter');
                modal.addComponents(new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('hangman_input')
                        .setLabel('Enter one letter (A–Z)')
                        .setStyle(TextInputStyle.Short)
                        .setMinLength(1).setMaxLength(1)
                        .setPlaceholder('e.g. E')
                        .setRequired(true)
                ));
                await i.showModal(modal);

                try {
                    const submitted = await i.awaitModalSubmit({ time: 30_000, filter: m => m.user.id === user.id });
                    const letter = submitted.fields.getTextInputValue('hangman_input').toUpperCase().trim();
                    await submitted.deferUpdate();

                    if (!/^[A-Z]$/.test(letter)) {
                        await submitted.followUp({ content: 'Enter exactly one letter (A–Z).', ephemeral: true }).catch(() => null);
                        return;
                    }
                    if (game.guessed.has(letter)) {
                        await submitted.followUp({ content: `Already guessed **${letter}**!`, ephemeral: true }).catch(() => null);
                        return;
                    }

                    game.guessed.add(letter);
                    if (!game.word.includes(letter)) game.wrongCount++;

                    const won = game.word.split('').every(l => game.guessed.has(l));
                    const lost = !won && game.wrongCount >= MAX_WRONG;

                    if (won) {
                        await db.updateWallet(user.id, reward(game.word));
                        await db.addXP(user.id, 20).catch(() => null);
                        activeGames.delete(user.id);
                        collector.stop('won');
                    } else if (lost) {
                        activeGames.delete(user.id);
                        collector.stop('lost');
                    }

                    await interaction.editReply({
                        flags: MessageFlags.IsComponentsV2,
                        components: [buildDisplay(game.word, game.guessed, game.wrongCount, won, lost)]
                    }).catch(() => null);
                } catch {
                    // modal timed out
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
                        components: [buildDisplay(game.word, game.guessed, game.wrongCount, false, true)]
                    }).catch(() => null);
                }
            }
        });
    }
};
