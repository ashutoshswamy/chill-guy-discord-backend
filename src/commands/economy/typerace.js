const {
    SlashCommandBuilder,
    ContainerBuilder, TextDisplayBuilder,
    SeparatorBuilder, SeparatorSpacingSize, MessageFlags,
    ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle
} = require('discord.js');
const db = require('../../utils/db');
const { getEmoji } = require('../../utils/emojis');

const coin = getEmoji('coin');
const COOLDOWN_MS = 15 * 60 * 1000;

const PROMPTS = [
    'The quick brown fox jumps over the lazy dog',
    'Coins are earned through hard work and wise investments',
    'Every great journey begins with a single step forward',
    'Fortune favors the bold and the prepared mind',
    'Practice makes perfect when done with full focus',
    'A wise man once said that patience is a virtue',
    'The early bird catches the worm every single morning',
    'Success is not final and failure is not fatal',
    'Keep your eyes on the stars and feet on ground',
    'Work hard in silence and let success make the noise',
    'Believe in yourself and all that you are capable of',
    'The only way to do great work is to love it',
    'Small steps taken daily lead to massive results over time',
    'Challenges are what make life interesting and worth living',
    'Your attitude determines the direction of your entire life',
];

// reward: based on WPM — faster = more coins
function calcReward(seconds, text) {
    const words = text.trim().split(/\s+/).length;
    const wpm = Math.round((words / seconds) * 60);
    if (wpm >= 80) return { reward: 1200, grade: 'S', wpm };
    if (wpm >= 60) return { reward: 900, grade: 'A', wpm };
    if (wpm >= 45) return { reward: 650, grade: 'B', wpm };
    if (wpm >= 30) return { reward: 400, grade: 'C', wpm };
    return { reward: 200, grade: 'D', wpm };
}

function buildContainer(prompt, status = 'ready', result = null) {
    let info;
    if (status === 'ready') {
        info = `Read the text below carefully, then click **Start Race** and type it exactly!\n\n> ${prompt}`;
    } else if (status === 'won') {
        const { wpm, grade, reward, seconds } = result;
        info = `**Race complete!** Finished in **${seconds.toFixed(1)}s** (**${wpm} WPM**)\n\n` +
            `**Grade:** ${grade} | +${coin} **${reward.toLocaleString()}** coins!`;
    } else if (status === 'timeout') {
        info = `**Timed out!** You didn't submit in time.`;
    } else if (status === 'error') {
        info = `**Typo detected!** Your text didn't match — no reward this time.\n-# Start again with \`/typerace\``;
    }

    const container = new ContainerBuilder()
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## Type Race\n-# Type the prompt as fast as you can!`))
        .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(info));

    if (status === 'ready') {
        container.addActionRowComponents(
            new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('typerace_start').setLabel('Start Race').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId('typerace_cancel').setLabel('Cancel').setStyle(ButtonStyle.Secondary)
            )
        );
    }

    return container;
}

const activeGames = new Map();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('typerace')
        .setDescription('Race to type a prompt as fast as possible to win coins!'),

    async execute(interaction) {
        const { user } = interaction;

        if (activeGames.has(user.id)) {
            return interaction.editReply({ content: 'You already have a Type Race running! Finish it first.', ephemeral: true });
        }

        const cd = await db.checkAndSetCooldown(user.id, 'typerace', COOLDOWN_MS);
        if (cd.onCooldown) {
            const m = Math.floor(cd.remaining / 60000), s = Math.floor((cd.remaining % 60000) / 1000);
            return interaction.editReply({ content: `On cooldown! Come back in **${m}m ${s}s**.`, ephemeral: true });
        }

        const prompt = PROMPTS[Math.floor(Math.random() * PROMPTS.length)];
        activeGames.set(user.id, { prompt });

        const response = await interaction.editReply({
            flags: MessageFlags.IsComponentsV2,
            components: [buildContainer(prompt, 'ready')]
        });

        const collector = response.createMessageComponentCollector({
            filter: i => i.user.id === user.id,
            time: 3 * 60 * 1000,
            max: 1,
        });

        collector.on('collect', async i => {
            const game = activeGames.get(user.id);
            if (!game) return;

            if (i.customId === 'typerace_cancel') {
                await i.deferUpdate();
                activeGames.delete(user.id);
                collector.stop('cancel');
                await interaction.editReply({
                    flags: MessageFlags.IsComponentsV2,
                    components: [buildContainer(game.prompt, 'timeout')]
                }).catch(() => null);
                return;
            }

            if (i.customId === 'typerace_start') {
                const startTime = Date.now();

                const modal = new ModalBuilder().setCustomId('typerace_modal').setTitle('Type Race — GO!');
                modal.addComponents(new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('typerace_input')
                        .setLabel(prompt.length > 45 ? prompt.slice(0, 42) + '...' : prompt)
                        .setStyle(TextInputStyle.Paragraph)
                        .setPlaceholder('Type the prompt exactly as shown above...')
                        .setRequired(true)
                        .setMaxLength(300)
                ));
                await i.showModal(modal);

                try {
                    const submitted = await i.awaitModalSubmit({
                        time: 120_000,
                        filter: m => m.user.id === user.id
                    });
                    const typed = submitted.fields.getTextInputValue('typerace_input').trim();
                    const elapsed = (Date.now() - startTime) / 1000;
                    await submitted.deferUpdate();
                    activeGames.delete(user.id);

                    // Case-insensitive match, collapse whitespace
                    const normalize = s => s.toLowerCase().replace(/\s+/g, ' ').trim();
                    if (normalize(typed) !== normalize(game.prompt)) {
                        await interaction.editReply({
                            flags: MessageFlags.IsComponentsV2,
                            components: [buildContainer(game.prompt, 'error')]
                        }).catch(() => null);
                        return;
                    }

                    const { reward, grade, wpm } = calcReward(elapsed, game.prompt);
                    await db.updateWallet(user.id, reward);
                    await db.addXP(user.id, 15).catch(() => null);

                    await interaction.editReply({
                        flags: MessageFlags.IsComponentsV2,
                        components: [buildContainer(game.prompt, 'won', { wpm, grade, reward, seconds: elapsed })]
                    }).catch(() => null);
                } catch {
                    activeGames.delete(user.id);
                    await interaction.editReply({
                        flags: MessageFlags.IsComponentsV2,
                        components: [buildContainer(game.prompt, 'timeout')]
                    }).catch(() => null);
                }
            }
        });

        collector.on('end', async (_, reason) => {
            if (reason === 'time') {
                activeGames.delete(user.id);
                await interaction.editReply({
                    flags: MessageFlags.IsComponentsV2,
                    components: [buildContainer(prompt, 'timeout')]
                }).catch(() => null);
            }
        });
    }
};
