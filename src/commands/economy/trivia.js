const {
    SlashCommandBuilder,
    ContainerBuilder, SectionBuilder, TextDisplayBuilder, ThumbnailBuilder,
    SeparatorBuilder, SeparatorSpacingSize, MessageFlags,
    ActionRowBuilder, ButtonBuilder, ButtonStyle
} = require('discord.js');
const db = require('../../utils/db');
const { XP_REWARDS } = require('../../utils/xp');
const { getEmoji } = require('../../utils/emojis');

const coin = getEmoji('coin');

const COOLDOWN_MS = 30 * 60 * 1000; // 30 minutes
const WIN_REWARD  = { easy: 300, medium: 600, hard: 1200 };
const WIN_XP      = { easy: 15,  medium: 30,  hard: 60   };

const QUESTIONS = [
    // Easy
    { q: 'How many sides does a hexagon have?',           a: '6',          wrong: ['4','5','8'],           diff: 'easy',   cat: 'Math'     },
    { q: 'What color do you get mixing red and blue?',    a: 'Purple',     wrong: ['Green','Orange','Pink'], diff: 'easy', cat: 'Colors'   },
    { q: 'How many continents are there on Earth?',       a: '7',          wrong: ['5','6','8'],            diff: 'easy',  cat: 'Geography' },
    { q: 'What is the chemical symbol for water?',        a: 'H₂O',        wrong: ['CO₂','O₂','NaCl'],      diff: 'easy',  cat: 'Science'  },
    { q: 'How many days are in a week?',                  a: '7',          wrong: ['5','6','8'],            diff: 'easy',  cat: 'General'  },
    { q: 'What is the capital city of France?',           a: 'Paris',      wrong: ['London','Berlin','Rome'], diff: 'easy', cat: 'Geography' },
    { q: 'Which planet is closest to the Sun?',           a: 'Mercury',    wrong: ['Venus','Earth','Mars'], diff: 'easy',   cat: 'Space'    },
    { q: 'How many legs does a spider have?',             a: '8',          wrong: ['6','10','12'],          diff: 'easy',   cat: 'Animals'  },
    { q: 'What is 12 × 12?',                              a: '144',        wrong: ['124','132','148'],      diff: 'easy',   cat: 'Math'     },
    { q: 'What ocean is the largest?',                    a: 'Pacific',    wrong: ['Atlantic','Indian','Arctic'], diff: 'easy', cat: 'Geography' },
    // Medium
    { q: 'What is the powerhouse of the cell?',           a: 'Mitochondria', wrong: ['Nucleus','Ribosome','Golgi Body'], diff: 'medium', cat: 'Science' },
    { q: 'Who wrote "Romeo and Juliet"?',                 a: 'Shakespeare',  wrong: ['Dickens','Hemingway','Tolkien'],   diff: 'medium', cat: 'Literature' },
    { q: 'What year did World War II end?',               a: '1945',         wrong: ['1939','1943','1947'],              diff: 'medium', cat: 'History'   },
    { q: 'What is the speed of light (km/s)?',            a: '300,000',      wrong: ['150,000','500,000','250,000'],     diff: 'medium', cat: 'Science'  },
    { q: 'How many bones are in the human body?',         a: '206',          wrong: ['196','216','226'],                 diff: 'medium', cat: 'Biology'  },
    { q: 'What is the largest mammal?',                   a: 'Blue Whale',   wrong: ['Elephant','Great White Shark','Giraffe'], diff: 'medium', cat: 'Animals' },
    { q: 'Which element has the atomic number 79?',       a: 'Gold',         wrong: ['Silver','Platinum','Iron'],        diff: 'medium', cat: 'Chemistry' },
    { q: 'What is the capital of Japan?',                 a: 'Tokyo',        wrong: ['Osaka','Kyoto','Hiroshima'],       diff: 'medium', cat: 'Geography' },
    { q: 'How many strings does a standard guitar have?', a: '6',            wrong: ['4','7','8'],                       diff: 'medium', cat: 'Music'     },
    { q: 'What is the square root of 144?',               a: '12',           wrong: ['10','11','13'],                    diff: 'medium', cat: 'Math'      },
    // Hard
    { q: 'What is the Fibonacci number after 144?',       a: '233',          wrong: ['210','244','277'],                 diff: 'hard', cat: 'Math'       },
    { q: 'What element has symbol "W"?',                  a: 'Tungsten',     wrong: ['Wolfram','Wanadium','Widium'],     diff: 'hard', cat: 'Chemistry'  },
    { q: 'In what year was the Eiffel Tower built?',      a: '1889',         wrong: ['1875','1901','1867'],              diff: 'hard', cat: 'History'    },
    { q: 'What is the rarest blood type?',                a: 'AB-',          wrong: ['O-','B-','A-'],                   diff: 'hard', cat: 'Biology'    },
    { q: 'How many moons does Saturn have?',              a: '146',          wrong: ['82','95','63'],                    diff: 'hard', cat: 'Space'       },
    { q: 'Who developed the theory of relativity?',       a: 'Einstein',     wrong: ['Newton','Tesla','Bohr'],           diff: 'hard', cat: 'Physics'    },
    { q: 'What is the longest river in the world?',       a: 'Nile',         wrong: ['Amazon','Yangtze','Mississippi'],  diff: 'hard', cat: 'Geography'  },
    { q: 'What is 17 × 23?',                              a: '391',          wrong: ['381','401','371'],                 diff: 'hard', cat: 'Math'        },
];

function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

// Remove diffColor or keep a text version if needed

module.exports = {
    data: new SlashCommandBuilder()
        .setName('trivia')
        .setDescription('Answer a trivia question and win coins!')
        .addStringOption(opt =>
            opt.setName('difficulty')
                .setDescription('Question difficulty')
                .setRequired(false)
                .addChoices(
                    { name: 'Easy   (+300 coins)', value: 'easy'   },
                    { name: 'Medium (+600 coins)', value: 'medium' },
                    { name: 'Hard   (+1200 coins)', value: 'hard'  }
                )),

    async execute(interaction) {
        const { user } = interaction;
        const diff = interaction.options.getString('difficulty') || 'medium';

        // Cooldown check
        const cd = await db.checkAndSetCooldown(user.id, 'trivia', COOLDOWN_MS);
        if (cd.onCooldown) {
            const rem = cd.remaining;
            const m = Math.floor(rem / 60000), s = Math.floor((rem % 60000) / 1000);
            return interaction.editReply({
                content: `You've already played trivia recently! Come back in **${m}m ${s}s**.`,
                ephemeral: true
            });
        }

        const pool = QUESTIONS.filter(q => q.diff === diff);
        const q    = pool[Math.floor(Math.random() * pool.length)];
        const opts = shuffle([q.a, ...q.wrong]);
        const LABELS = ['A', 'B', 'C', 'D'];

        const buildContainer = (selected = null, expired = false) => {
            let bodyText = '';
            for (let i = 0; i < opts.length; i++) {
                const letter = LABELS[i];
                const val    = opts[i];
                let prefix = `${letter}. `;
                if (selected !== null) {
                    if (val === q.a) prefix = `[Correct] ${letter}. `;
                    else if (selected === i && val !== q.a) prefix = `[Wrong] ${letter}. `;
                    else prefix = `${letter}. `;
                }
                bodyText += `${prefix}${val}\n`;
            }

            const reward   = WIN_REWARD[diff];
            const statusLine = selected === null && !expired
                ? `-# You have **30 seconds** to answer!`
                : selected !== null
                    ? (opts[selected] === q.a
                        ? `**Correct!** You earned ${coin} **${reward.toLocaleString()}** coins!`
                        : `**Wrong!** The answer was **${q.a}**. No reward this time.`)
                    : `**Time's up!** The answer was **${q.a}**.`;

            return new ContainerBuilder()
                .addSectionComponents(
                    new SectionBuilder()
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent(
                                `## Trivia — ${diff.charAt(0).toUpperCase() + diff.slice(1)}\n` +
                                `Category: ${q.cat}\n\n**${q.q}**`
                            )
                        )
                        .setThumbnailAccessory(new ThumbnailBuilder().setURL(user.displayAvatarURL({ forceStatic: true })))
                )
                .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
                .addTextDisplayComponents(new TextDisplayBuilder().setContent(bodyText.trim()))
                .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
                .addTextDisplayComponents(new TextDisplayBuilder().setContent(statusLine))
                .addActionRowComponents(
                    new ActionRowBuilder().addComponents(
                        ...opts.map((opt, i) =>
                            new ButtonBuilder()
                                .setCustomId(`trivia_${i}`)
                                .setLabel(`${LABELS[i]}. ${opt}`)
                                .setStyle(selected === null && !expired
                                    ? ButtonStyle.Primary
                                    : opts[i] === q.a
                                        ? ButtonStyle.Success
                                        : selected === i
                                            ? ButtonStyle.Danger
                                            : ButtonStyle.Secondary)
                                .setDisabled(selected !== null || expired)
                        )
                    )
                );
        };

        const response = await interaction.editReply({
            flags: MessageFlags.IsComponentsV2,
            components: [buildContainer()]
        });

        const collector = response.createMessageComponentCollector({
            filter: i => i.user.id === user.id && i.customId.startsWith('trivia_'),
            time: 30_000,
            max: 1,
        });

        collector.on('collect', async i => {
            await i.deferUpdate();
            const idx     = parseInt(i.customId.split('_')[1], 10);
            const correct = opts[idx] === q.a;

            if (correct) {
                await db.updateWallet(user.id, WIN_REWARD[diff]);
                await db.addXP(user.id, WIN_XP[diff]).catch(() => null);
            } else {
                // Refund cooldown on wrong so they're not double-penalised? No — keep cooldown.
            }

            await interaction.editReply({
                flags: MessageFlags.IsComponentsV2,
                components: [buildContainer(idx)]
            }).catch(() => null);
        });

        collector.on('end', async (collected) => {
            if (collected.size === 0) {
                await interaction.editReply({
                    flags: MessageFlags.IsComponentsV2,
                    components: [buildContainer(null, true)]
                }).catch(() => null);
            }
        });
    }
};
