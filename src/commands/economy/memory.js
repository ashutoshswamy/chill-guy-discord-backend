const {
    SlashCommandBuilder,
    ContainerBuilder, TextDisplayBuilder,
    SeparatorBuilder, SeparatorSpacingSize, MessageFlags,
    ActionRowBuilder, ButtonBuilder, ButtonStyle
} = require('discord.js');
const db = require('../../utils/db');
const { getEmoji } = require('../../utils/emojis');

const coin = getEmoji('coin');
const COOLDOWN_MS = 20 * 60 * 1000;
const GRID_SIZE = 16; // 4x4
const PAIRS = ['🎰', '💎', '🎲', '🎯', '🃏', '🎮', '🏆', '💰'];
const WIN_REWARD = 800;

function createBoard() {
    const cards = [...PAIRS, ...PAIRS];
    for (let i = cards.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [cards[i], cards[j]] = [cards[j], cards[i]];
    }
    return cards;
}

function buildRows(cards, matched, revealed) {
    const rows = [];
    for (let r = 0; r < 4; r++) {
        const row = new ActionRowBuilder();
        for (let c = 0; c < 4; c++) {
            const idx = r * 4 + c;
            const isMatched = matched.has(idx);
            const isRevealed = revealed.includes(idx);
            row.addComponents(
                new ButtonBuilder()
                    .setCustomId(`memory_${idx}`)
                    .setStyle(isMatched ? ButtonStyle.Success : isRevealed ? ButtonStyle.Secondary : ButtonStyle.Primary)
                    .setLabel(isMatched || isRevealed ? cards[idx] : '❓')
                    .setDisabled(isMatched || revealed.length === 2)
            );
        }
        rows.push(row);
    }
    return rows;
}

function buildContainer(cards, matched, revealed, status = 'live', pairs = 0) {
    let info;
    if (status === 'won') info = `**All pairs found!** +${coin} **${WIN_REWARD.toLocaleString()}** coins!`;
    else if (status === 'timeout') info = `**Time's up!** You matched **${pairs}/8** pairs.`;
    else info = `-# Match all 8 pairs! Pairs found: **${pairs}/8**`;

    return new ContainerBuilder()
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## Memory Match\n-# Click cards to flip and find matching pairs!`))
        .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(info))
        .addActionRowComponents(...buildRows(cards, matched, revealed));
}

const activeGames = new Map();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('memory')
        .setDescription('Flip cards to find matching pairs and win coins!'),

    async execute(interaction) {
        const { user } = interaction;

        if (activeGames.has(user.id)) {
            return interaction.editReply({ content: 'You already have a Memory game running! Finish it first.', ephemeral: true });
        }

        const cd = await db.checkAndSetCooldown(user.id, 'memory', COOLDOWN_MS);
        if (cd.onCooldown) {
            const m = Math.floor(cd.remaining / 60000), s = Math.floor((cd.remaining % 60000) / 1000);
            return interaction.editReply({ content: `On cooldown! Come back in **${m}m ${s}s**.`, ephemeral: true });
        }

        const cards = createBoard();
        const matched = new Set();
        activeGames.set(user.id, { cards, matched, revealed: [], locked: false });

        const response = await interaction.editReply({
            flags: MessageFlags.IsComponentsV2,
            components: [buildContainer(cards, matched, [], 'live', 0)]
        });

        const collector = response.createMessageComponentCollector({
            filter: i => i.user.id === user.id && i.customId.startsWith('memory_'),
            time: 5 * 60 * 1000,
        });

        collector.on('collect', async i => {
            const game = activeGames.get(user.id);
            if (!game || game.locked) {
                await i.deferUpdate().catch(() => null);
                return;
            }

            const idx = parseInt(i.customId.split('_')[1]);
            if (game.matched.has(idx) || game.revealed.includes(idx)) {
                await i.deferUpdate().catch(() => null);
                return;
            }

            await i.deferUpdate();
            game.revealed.push(idx);

            if (game.revealed.length === 1) {
                // First card flipped
                await interaction.editReply({
                    flags: MessageFlags.IsComponentsV2,
                    components: [buildContainer(game.cards, game.matched, game.revealed, 'live', game.matched.size / 2)]
                }).catch(() => null);
            } else if (game.revealed.length === 2) {
                // Second card flipped — show both then check
                game.locked = true;
                await interaction.editReply({
                    flags: MessageFlags.IsComponentsV2,
                    components: [buildContainer(game.cards, game.matched, game.revealed, 'live', game.matched.size / 2)]
                }).catch(() => null);

                const [a, b] = game.revealed;
                const isMatch = game.cards[a] === game.cards[b];

                await new Promise(r => setTimeout(r, 1200));

                if (isMatch) {
                    game.matched.add(a);
                    game.matched.add(b);
                }
                game.revealed = [];
                game.locked = false;

                const pairs = game.matched.size / 2;
                const won = game.matched.size === GRID_SIZE;

                if (won) {
                    await db.updateWallet(user.id, WIN_REWARD);
                    await db.addXP(user.id, 30).catch(() => null);
                    activeGames.delete(user.id);
                    collector.stop('won');
                    await interaction.editReply({
                        flags: MessageFlags.IsComponentsV2,
                        components: [buildContainer(game.cards, game.matched, [], 'won', pairs)]
                    }).catch(() => null);
                } else {
                    await interaction.editReply({
                        flags: MessageFlags.IsComponentsV2,
                        components: [buildContainer(game.cards, game.matched, [], 'live', pairs)]
                    }).catch(() => null);
                }
            }
        });

        collector.on('end', async (_, reason) => {
            if (reason === 'time') {
                const game = activeGames.get(user.id);
                if (!game) return;
                const pairs = game.matched.size / 2;
                activeGames.delete(user.id);
                await interaction.editReply({
                    flags: MessageFlags.IsComponentsV2,
                    components: [buildContainer(game.cards, game.matched, [], 'timeout', pairs)]
                }).catch(() => null);
            }
        });
    }
};
