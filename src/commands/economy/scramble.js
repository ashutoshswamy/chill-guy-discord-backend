const {
    SlashCommandBuilder,
    ContainerBuilder, SectionBuilder, TextDisplayBuilder, ThumbnailBuilder,
    SeparatorBuilder, SeparatorSpacingSize, MessageFlags,
    ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle
} = require('discord.js');
const db = require('../../utils/db');
const { XP_REWARDS } = require('../../utils/xp');
const { getEmoji } = require('../../utils/emojis');

const coin = getEmoji('coin');

const WORD_LIST = [
    'CHILL', 'COIN', 'WALLET', 'BANK', 'MONEY', 'GAMBLE', 'STOCK', 'PORTFOLIO',
    'MINING', 'FISHING', 'HUNTING', 'CRAFTING', 'TRADING', 'DICE', 'LOTTERY',
    'CRASH', 'BLACKJACK', 'ROULETTE', 'TRIVIA', 'QUEST', 'DAILY', 'WEEKLY',
    'MONTHLY', 'COOLDOWN', 'COMMAND', 'DISCORD', 'GUILD', 'INTERACTION',
    'BOOSTER', 'EMERALD', 'SAPPHIRE', 'RUBY', 'DIAMOND', 'PRESTIGE', 'MULTIPLIER',
    'ROOSTER', 'ANIMAL', 'PREY', 'TIMBER', 'FOREST', 'SHOVEL', 'PICKAXE', 'AXE'
];

function scrambleWord(word) {
    if (word.length <= 1) return word;
    let scrambled = word;
    let attempts = 0;
    while (scrambled === word && attempts < 100) {
        const arr = word.split('');
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        scrambled = arr.join('');
        attempts++;
    }
    return scrambled;
}

function buildContainer(user, scrambled, word, status = 'live', reward = 0, wallet = 0) {
    const isLive = status === 'live';
    const isWon = status === 'won';
    const isQuit = status === 'quit';
    const isTimeout = status === 'timeout';

    let contentStr = '';
    if (isLive) {
        contentStr = `Unscramble the word below:\n\n` +
            `# \`${scrambled.toUpperCase().split('').join(' ')}\`\n\n` +
            `You have **30 seconds** to guess the word!`;
    } else if (isWon) {
        contentStr = `**Correct!** The word was **${word}**.\n\n` +
            `**Earned:** ${coin} **+${reward.toLocaleString()}** coins\n` +
            `**Wallet:** ${coin} ${wallet.toLocaleString()} coins`;
    } else if (isQuit) {
        contentStr = `Game ended. You gave up.\n\n` +
            `The word was **${word}**.`;
    } else if (isTimeout) {
        contentStr = `Time's up! You took too long to unscramble the word.\n\n` +
            `The word was **${word}**.`;
    }

    const container = new ContainerBuilder()
        .addSectionComponents(
            new SectionBuilder()
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(`## Word Scramble`)
                )
                .setThumbnailAccessory(new ThumbnailBuilder().setURL(user.displayAvatarURL({ forceStatic: true })))
        )
        .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(contentStr)
        );

    if (isLive) {
        container.addActionRowComponents(
            new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('scramble_guess')
                    .setLabel('Enter Guess')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('scramble_quit')
                    .setLabel('Give Up')
                    .setStyle(ButtonStyle.Danger)
            )
        );
    }

    return container;
}

// Active games tracked in memory to prevent concurrent games per user
const activeGames = new Map();

module.exports = {
    cooldown: 30,
    data: new SlashCommandBuilder()
        .setName('scramble')
        .setDescription('Scramble a word and guess the correct word to earn coins.'),

    async execute(interaction) {
        const { user } = interaction;

        if (activeGames.has(user.id)) {
            return interaction.editReply({ content: 'You already have a Scramble game running! Finish it first.', ephemeral: true });
        }

        const word = WORD_LIST[Math.floor(Math.random() * WORD_LIST.length)];
        const scrambled = scrambleWord(word);

        activeGames.set(user.id, word);

        try {
            const container = buildContainer(user, scrambled, word, 'live');
            const response = await interaction.editReply({
                flags: MessageFlags.IsComponentsV2,
                components: [container]
            });

            const collector = response.createMessageComponentCollector({
                filter: i => i.user.id === user.id,
                time: 30_000
            });

            collector.on('collect', async i => {
                if (i.customId === 'scramble_quit') {
                    await i.deferUpdate();
                    activeGames.delete(user.id);
                    collector.stop('quit');
                    
                    const quitContainer = buildContainer(user, scrambled, word, 'quit');
                    await interaction.editReply({
                        flags: MessageFlags.IsComponentsV2,
                        components: [quitContainer]
                    }).catch(() => null);
                    return;
                }

                if (i.customId === 'scramble_guess') {
                    const modal = new ModalBuilder()
                        .setCustomId('scramble_modal')
                        .setTitle('Unscramble the Word');

                    const input = new TextInputBuilder()
                        .setCustomId('scramble_input')
                        .setLabel(`Your Guess (${word.length} letters)`)
                        .setStyle(TextInputStyle.Short)
                        .setPlaceholder('Enter guess here...')
                        .setRequired(true);

                    modal.addComponents(new ActionRowBuilder().addComponents(input));
                    await i.showModal(modal);

                    try {
                        const modalSubmit = await i.awaitModalSubmit({ time: 25_000, filter: m => m.user.id === user.id });
                        const guess = modalSubmit.fields.getTextInputValue('scramble_input').toUpperCase().trim();
                        
                        await modalSubmit.deferUpdate();

                        if (guess === word) {
                            activeGames.delete(user.id);
                            collector.stop('won');

                            const reward = Math.floor(Math.random() * 101) + 150; // 150 to 250 coins
                            await db.updateWallet(user.id, reward);
                            await db.addXP(user.id, XP_REWARDS.gamblingWin).catch(() => null);
                            const updated = await db.getUser(user.id);

                            const winContainer = buildContainer(user, scrambled, word, 'won', reward, updated.wallet);
                            await interaction.editReply({
                                flags: MessageFlags.IsComponentsV2,
                                components: [winContainer]
                            }).catch(() => null);
                        } else {
                            await modalSubmit.followUp({ content: 'Wrong guess! Try again.', ephemeral: true }).catch(() => null);
                        }
                    } catch (err) {
                        // Modal timeout or cancelled
                    }
                }
            });

            collector.on('end', async (_, reason) => {
                if (reason === 'time') {
                    activeGames.delete(user.id);
                    const timeoutContainer = buildContainer(user, scrambled, word, 'timeout');
                    await interaction.editReply({
                        flags: MessageFlags.IsComponentsV2,
                        components: [timeoutContainer]
                    }).catch(() => null);
                }
            });

        } catch (err) {
            console.error('[SCRAMBLE ERROR]', err);
            activeGames.delete(user.id);
            const msg = { content: 'Something went wrong with the Scramble game.', ephemeral: true };
            if (interaction.replied || interaction.deferred) await interaction.followUp(msg).catch(() => null);
            else await interaction.editReply(msg).catch(() => null);
        }
    }
};
