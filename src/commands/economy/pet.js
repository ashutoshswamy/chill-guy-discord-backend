const {
    SlashCommandBuilder,
    ContainerBuilder, SectionBuilder, TextDisplayBuilder, ThumbnailBuilder,
    SeparatorBuilder, SeparatorSpacingSize, MessageFlags,
    ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, StringSelectMenuOptionBuilder
} = require('discord.js');
const db = require('../../utils/db');
const { getEmoji } = require('../../utils/emojis');

const coin = getEmoji('coin');
const xp   = getEmoji('xp');

const {
    getPet, getPetList, getRarityConfig, getEvolveStage, getNextEvolveStage,
    xpToNextLevel, statBar, statEmoji, applyDecay, calcPetBonus,
    MAX_LEVEL, FEED_COOLDOWN_MS, PLAY_COOLDOWN_MS, EVOLVE_STAGES
} = require('../../utils/pets');

const MAX_PETS = 5;

function buildPetListContainer(pets, user) {
    let listText = '';
    for (const p of pets) {
        const petDef = getPet(p.pet_type);
        const rarity = getRarityConfig(p.rarity);
        const stage  = getEvolveStage(p.level);
        const decayed = applyDecay(p);
        const status = p.is_active ? '**Active**' : 'Inactive';
        listText +=
            `### ${p.name} - ${rarity.label}\n` +
            `${status} | Level **${p.level}** | ${stage.name} | ID: \`${p.id}\`\n` +
            `Hunger: ${decayed.hunger}/100 · Happiness: ${decayed.happiness}/100 · Health: ${decayed.health}/100\n\n`;
    }

    const container = new ContainerBuilder()
        .addSectionComponents(
            new SectionBuilder()
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        `## Your Pets (${pets.length}/${MAX_PETS})`
                    )
                )
                .setThumbnailAccessory(new ThumbnailBuilder().setURL(user.displayAvatarURL({ forceStatic: true })))
        )
        .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(listText.trim()))
        .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));

    // Select Menu to change active companion
    const select = new StringSelectMenuBuilder()
        .setCustomId('pet_select_active')
        .setPlaceholder('Set Active Companion')
        .addOptions(
            pets.map(p => {
                const petDef = getPet(p.pet_type);
                return new StringSelectMenuOptionBuilder()
                    .setLabel(`${p.name} (${petDef.name})`)
                    .setValue(p.id.toString())
                    .setDefault(p.is_active);
            })
        );

    container.addActionRowComponents(new ActionRowBuilder().addComponents(select));

    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            `-# Select a pet from the menu to activate it · Use \`/pet feed\` to nourish your active pet.`
        )
    );

    return container;
}

function formatMs(ms) {
    const m = Math.floor(ms / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function buildStatBlock(pet) {
    return (
        `${statEmoji(pet.hunger)}  **Hunger**    \`${statBar(pet.hunger)}\` ${pet.hunger}/100\n` +
        `${statEmoji(pet.happiness)} **Happiness** \`${statBar(pet.happiness)}\` ${pet.happiness}/100\n` +
        `${statEmoji(pet.energy)}   **Energy**    \`${statBar(pet.energy)}\` ${pet.energy}/100\n` +
        `${statEmoji(pet.health)}   **Health**    \`${statBar(pet.health)}\` ${pet.health}/100`
    );
}

function buildXpBlock(pet) {
    if (pet.level >= MAX_LEVEL) return `**Level:** ${pet.level} MAX`;
    const needed = xpToNextLevel(pet.level);
    return `**Level:** ${pet.level} | ${xp} **XP:** ${pet.xp}/${needed} \`${statBar(pet.xp, needed)}\``;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('pet')
        .setDescription('Advanced pet system - adopt, feed, play, evolve and more.')
        .addSubcommand(sub =>
            sub.setName('adopt')
                .setDescription('Adopt a new pet.')
                .addStringOption(opt =>
                    opt.setName('type')
                        .setDescription('Pet type to adopt')
                        .setRequired(true)
                        .addChoices(...getPetList().map(p => ({ name: `${p.emoji} ${p.name} (${p.rarity})`, value: p.id }))))
                .addStringOption(opt =>
                    opt.setName('name')
                        .setDescription('Name your pet')
                        .setRequired(true)
                        .setMaxLength(20)))
        .addSubcommand(sub =>
            sub.setName('status')
                .setDescription('View your active pet\'s stats.'))
        .addSubcommand(sub =>
            sub.setName('feed')
                .setDescription('Feed your active pet. 1 hour cooldown.'))
        .addSubcommand(sub =>
            sub.setName('play')
                .setDescription('Play with your active pet. 30 minute cooldown.'))
        .addSubcommand(sub =>
            sub.setName('list')
                .setDescription('List all your pets.'))
        .addSubcommand(sub =>
            sub.setName('select')
                .setDescription('Set a pet as your active companion.')
                .addIntegerOption(opt =>
                    opt.setName('id')
                        .setDescription('Pet ID (from /pet list)')
                        .setRequired(true)))
        .addSubcommand(sub =>
            sub.setName('rename')
                .setDescription('Rename your active pet.')
                .addStringOption(opt =>
                    opt.setName('name')
                        .setDescription('New name')
                        .setRequired(true)
                        .setMaxLength(20)))
        .addSubcommand(sub =>
            sub.setName('evolve')
                .setDescription('Evolve your active pet if it meets level requirements.'))
        .addSubcommand(sub =>
            sub.setName('release')
                .setDescription('Release a pet. This cannot be undone.')
                .addIntegerOption(opt =>
                    opt.setName('id')
                        .setDescription('Pet ID (from /pet list)')
                        .setRequired(true))),

    async execute(interaction) {
        const sub  = interaction.options.getSubcommand();
        const { user } = interaction;

        // ─── ADOPT ───────────────────────────────────────────────
        if (sub === 'adopt') {
            const petType = interaction.options.getString('type');
            const name    = interaction.options.getString('name').trim();
            const petDef  = getPet(petType);
            if (!petDef) return interaction.editReply({ content: 'Invalid pet type.', ephemeral: true });

            const existingPets = await db.getUserPets(user.id);
            if (existingPets.length >= MAX_PETS) {
                return interaction.editReply({
                    content: `You already have ${MAX_PETS} pets. Release one before adopting another.`,
                    ephemeral: true
                });
            }

            const profile = await db.getUser(user.id);
            if (profile.wallet < petDef.cost) {
                return interaction.editReply({
                    content: `Not enough coins! **${petDef.name}** costs ${coin} **${petDef.cost.toLocaleString()}** coins. You have ${coin} **${profile.wallet.toLocaleString()}**.`,
                    ephemeral: true
                });
            }

            const pet     = await db.adoptPet(user.id, petType, name, petDef.rarity, petDef.cost);
            const rarity  = getRarityConfig(petDef.rarity);
            const stage   = getEvolveStage(1);

            const container = new ContainerBuilder()
                .addSectionComponents(
                    new SectionBuilder()
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent(
                                `## ${name} Adopted!\n` +
                                `**${rarity.label}** ${petDef.name} - ${stage.name}`
                            )
                        )
                        .setThumbnailAccessory(new ThumbnailBuilder().setURL(user.displayAvatarURL({ forceStatic: true })))
                )
                .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        `**${petDef.description}**\n\n` +
                        `**Bonus:** +${(petDef.bonus.base * 100).toFixed(0)}% ${petDef.bonus.type} income (scales with level)\n` +
                        (petDef.special ? `**Special:** ${petDef.special.replace(/_/g, ' ')}\n` : '') +
                        `**Evolves:** at levels 10 (Adult) and 25 (Elder)\n` +
                        `**Cost Paid:** ${coin} ${petDef.cost.toLocaleString()} coins\n\n` +
                        `-# Use \`/pet feed\` and \`/pet play\` to keep **${name}** happy and level up.`
                    )
                );

            return interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [container] });
        }

        // ─── STATUS ───────────────────────────────────────────────
        if (sub === 'status') {
            const rawPet = await db.getActivePet(user.id);
            if (!rawPet) return interaction.editReply({ content: 'No active pet. Adopt one with `/pet adopt` or select one with `/pet select`.', ephemeral: true });

            const pet    = applyDecay(rawPet);
            await db.updatePetStats(rawPet.id, { hunger: pet.hunger, happiness: pet.happiness, energy: pet.energy, health: pet.health });

            const petDef = getPet(pet.pet_type);
            const rarity = getRarityConfig(pet.rarity);
            const stage  = getEvolveStage(pet.level);
            const bonus  = calcPetBonus(pet);
            const nextEvolve = getNextEvolveStage(pet.evolution_stage);

            let warnText = '';
            if (pet.hunger < 25)    warnText += '**Hungry!** Feed your pet soon.\n';
            if (pet.happiness < 25) warnText += '**Unhappy!** Play with your pet.\n';
            if (pet.health < 25)    warnText += '**Low health!** Feed immediately.\n';

            const container = new ContainerBuilder()
                .addSectionComponents(
                    new SectionBuilder()
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent(
                                `## ${pet.name}\n` +
                                `**${rarity.label}** ${petDef.name} - ${stage.name}`
                            )
                        )
                        .setThumbnailAccessory(new ThumbnailBuilder().setURL(user.displayAvatarURL({ forceStatic: true })))
                )
                .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
                .addTextDisplayComponents(new TextDisplayBuilder().setContent(buildXpBlock(pet)))
                .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
                .addTextDisplayComponents(new TextDisplayBuilder().setContent(buildStatBlock(pet)));

            if (warnText) {
                container
                    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
                    .addTextDisplayComponents(new TextDisplayBuilder().setContent(warnText.trim()));
            }

            container
                .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        `**Active Bonus:** +${(bonus * 100).toFixed(1)}% ${petDef.bonus.type} income\n` +
                        (nextEvolve ? `**Next Evolution:** ${nextEvolve.name} at level ${nextEvolve.minLevel}` : `**Evolution:** MAX - Elder`) +
                        (petDef.special ? `\n**Special:** ${petDef.special.replace(/_/g, ' ')}` : '') +
                        `\n**Pet ID:** \`${pet.id}\``
                    )
                );

            return interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [container] });
        }

        // ─── FEED ────────────────────────────────────────────────
        if (sub === 'feed') {
            const rawPet = await db.getActivePet(user.id);
            if (!rawPet) return interaction.editReply({ content: 'No active pet.', ephemeral: true });

            const result = await db.feedPet(rawPet.id, user.id);

            if (result.onCooldown) {
                return interaction.editReply({
                    content: `${rawPet.name} is still full! Feed again in **${formatMs(result.remaining)}**.`,
                    ephemeral: true
                });
            }

            const petDef = getPet(result.pet.pet_type);
            const msg    = petDef.feedMessages[Math.floor(Math.random() * petDef.feedMessages.length)]
                .replace(/\{name\}/g, result.pet.name);
            const rarity = getRarityConfig(result.pet.rarity);

            const container = new ContainerBuilder()
                .addSectionComponents(
                    new SectionBuilder()
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent(`## ${petDef.emoji} Fed ${result.pet.name}\n${msg}`)
                        )
                        .setThumbnailAccessory(new ThumbnailBuilder().setURL(user.displayAvatarURL({ forceStatic: true })))
                )
                .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        `**Hunger:** \`${statBar(result.pet.hunger)}\` ${result.pet.hunger}/100\n` +
                        `**Health:** \`${statBar(result.pet.health)}\` ${result.pet.health}/100\n` +
                        `${xp} **XP Gained:** +${result.xpGain}\n` +
                        (result.leveledUp ? `**Leveled up to ${result.newLevel}!**` : `**Level:** ${result.pet.level}`)
                    )
                );

            return interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [container] });
        }

        // ─── PLAY ────────────────────────────────────────────────
        if (sub === 'play') {
            const rawPet = await db.getActivePet(user.id);
            if (!rawPet) return interaction.editReply({ content: 'No active pet.', ephemeral: true });

            const result = await db.playWithPet(rawPet.id, user.id);

            if (result.onCooldown) {
                return interaction.editReply({
                    content: `${rawPet.name} needs more rest! Play again in **${formatMs(result.remaining)}**.`,
                    ephemeral: true
                });
            }
            if (result.noEnergy) {
                return interaction.editReply({
                    content: `${rawPet.name} is too tired to play right now. Come back later.`,
                    ephemeral: true
                });
            }

            const petDef = getPet(result.pet.pet_type);
            const msg    = petDef.playMessages[Math.floor(Math.random() * petDef.playMessages.length)]
                .replace(/\{name\}/g, result.pet.name);
            const rarity = getRarityConfig(result.pet.rarity);

            const container = new ContainerBuilder()
                .addSectionComponents(
                    new SectionBuilder()
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent(`## ${petDef.emoji} Played with ${result.pet.name}\n${msg}`)
                        )
                        .setThumbnailAccessory(new ThumbnailBuilder().setURL(user.displayAvatarURL({ forceStatic: true })))
                )
                .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        `**Happiness:** \`${statBar(result.pet.happiness)}\` ${result.pet.happiness}/100\n` +
                        `**Energy:** \`${statBar(result.pet.energy)}\` ${result.pet.energy}/100\n` +
                        `${xp} **XP Gained:** +${result.xpGain}\n` +
                        (result.leveledUp ? `**Leveled up to ${result.newLevel}!**` : `**Level:** ${result.pet.level}`)
                    )
                );

            return interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [container] });
        }

        // ─── LIST ────────────────────────────────────────────────
        if (sub === 'list') {
            const pets = await db.getUserPets(user.id);
            if (pets.length === 0) {
                return interaction.editReply({ content: 'You have no pets. Use `/pet adopt` to get one.', ephemeral: true });
            }

            const response = await interaction.editReply({
                flags: MessageFlags.IsComponentsV2,
                components: [buildPetListContainer(pets, user)]
            });

            const collector = response.createMessageComponentCollector({
                filter: i => i.user.id === user.id,
                time: 120_000,
            });

            collector.on('collect', async i => {
                try {
                    if (i.customId === 'pet_select_active') {
                        const petId = parseInt(i.values[0], 10);
                        const userPets = await db.getUserPets(user.id);
                        const targetPet = userPets.find(p => p.id === petId);

                        if (!targetPet) {
                            return i.reply({ content: `No pet with ID \`${petId}\` found.`, ephemeral: true }).catch(() => null);
                        }
                        if (targetPet.is_active) {
                            return i.reply({ content: `${targetPet.name} is already your active pet.`, ephemeral: true }).catch(() => null);
                        }

                        await db.setActivePet(user.id, petId);
                        const updatedPets = await db.getUserPets(user.id);

                        await i.deferUpdate();
                        const updatedContainer = buildPetListContainer(updatedPets, user);
                        await interaction.editReply({
                            flags: MessageFlags.IsComponentsV2,
                            components: [updatedContainer]
                        }).catch(() => null);
                    }
                } catch (err) {
                    console.error('[PET LIST INTERACTION ERROR]', err);
                }
            });

            collector.on('end', async () => {
                try {
                    const finalPets = await db.getUserPets(user.id);
                    const finalContainer = buildPetListContainer(finalPets, user);
                    for (const c of finalContainer.components || []) {
                        if (c.components) {
                            for (const comp of c.components) {
                                if (typeof comp.setDisabled === 'function') comp.setDisabled(true);
                            }
                        }
                        if (typeof c.setDisabled === 'function') c.setDisabled(true);
                    }
                    await interaction.editReply({
                        flags: MessageFlags.IsComponentsV2,
                        components: [finalContainer]
                    }).catch(() => null);
                } catch (err) {
                    // Ignore
                }
            });

            return;
        }

        // ─── SELECT ───────────────────────────────────────────────
        if (sub === 'select') {
            const petId = interaction.options.getInteger('id');
            const pets  = await db.getUserPets(user.id);
            const target = pets.find(p => p.id === petId);

            if (!target) return interaction.editReply({ content: `No pet with ID \`${petId}\` found.`, ephemeral: true });
            if (target.is_active) return interaction.editReply({ content: `${target.name} is already your active pet.`, ephemeral: true });

            await db.setActivePet(user.id, petId);
            const petDef = getPet(target.pet_type);

            return interaction.editReply({
                content: `${petDef.emoji} **${target.name}** is now your active companion!`,
            });
        }

        // ─── RENAME ───────────────────────────────────────────────
        if (sub === 'rename') {
            const newName = interaction.options.getString('name').trim();
            const rawPet  = await db.getActivePet(user.id);
            if (!rawPet) return interaction.editReply({ content: 'No active pet to rename.', ephemeral: true });

            await db.renamePet(rawPet.id, user.id, newName);
            const petDef = getPet(rawPet.pet_type);

            return interaction.editReply({
                content: `${petDef.emoji} **${rawPet.name}** has been renamed to **${newName}**.`,
            });
        }

        // ─── EVOLVE ───────────────────────────────────────────────
        if (sub === 'evolve') {
            const rawPet = await db.getActivePet(user.id);
            if (!rawPet) return interaction.editReply({ content: 'No active pet.', ephemeral: true });

            const nextStage = getNextEvolveStage(rawPet.evolution_stage);
            if (!nextStage) {
                return interaction.editReply({ content: `**${rawPet.name}** is already at max evolution (Elder).`, ephemeral: true });
            }
            if (rawPet.level < nextStage.minLevel) {
                return interaction.editReply({
                    content: `**${rawPet.name}** needs to be level **${nextStage.minLevel}** to evolve into **${nextStage.name}**. Currently level ${rawPet.level}.`,
                    ephemeral: true
                });
            }

            const evolved = await db.evolvePet(rawPet.id, user.id);
            const petDef  = getPet(evolved.pet_type);
            const rarity  = getRarityConfig(evolved.rarity);
            const stage   = getEvolveStage(evolved.level);

            const container = new ContainerBuilder()
                .addSectionComponents(
                    new SectionBuilder()
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent(
                                `## Evolution!\n${petDef.emoji}${stage.suffix} **${evolved.name}** evolved into a **${stage.name}**!`
                            )
                        )
                        .setThumbnailAccessory(new ThumbnailBuilder().setURL(user.displayAvatarURL({ forceStatic: true })))
                )
                .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        `${rarity.emoji} **${rarity.label}** ${petDef.name}\n` +
                        `**Stage:** ${stage.name} ${stage.suffix}\n` +
                        `**Bonus now scales higher** with level and happiness.\n` +
                        (getNextEvolveStage(evolved.evolution_stage)
                            ? `-# Next evolution: **Elder** at level 25`
                            : `-# **${evolved.name}** has reached maximum evolution.`)
                    )
                );

            return interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [container] });
        }

        // ─── RELEASE ─────────────────────────────────────────────
        if (sub === 'release') {
            const petId  = interaction.options.getInteger('id');
            const pets   = await db.getUserPets(user.id);
            const target = pets.find(p => p.id === petId);

            if (!target) return interaction.editReply({ content: `No pet with ID \`${petId}\` found.`, ephemeral: true });

            const petDef = getPet(target.pet_type);
            await db.releasePet(petId, user.id);

            return interaction.editReply({
                content: `${petDef.emoji} **${target.name}** has been released. Goodbye, friend.`,
            });
        }
    }
};
