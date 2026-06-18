const {
    SlashCommandBuilder,
    ContainerBuilder, SectionBuilder, TextDisplayBuilder, ThumbnailBuilder,
    SeparatorBuilder, SeparatorSpacingSize, MessageFlags,
    ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, StringSelectMenuOptionBuilder,
    AttachmentBuilder, MediaGalleryBuilder, MediaGalleryItemBuilder
} = require('discord.js');
const db = require('../../utils/db');
const { generateStockChart } = require('../../utils/stockChart');
const {
    EXCHANGES, STOCK_MAP, EXCHANGE_STOCKS,
    PRICE_STALE_MS, calcNewPrice,
    formatChange, formatPrice, priceBar,
} = require('../../utils/stocks');
const { getEmoji } = require('../../utils/emojis');

const coin = getEmoji('coin');

const EXCHANGE_KEYS = Object.keys(EXCHANGES);

// Split text into chunks that fit within TextDisplayBuilder's 4000 char limit
function splitContent(text, max = 3900) {
    if (text.length <= max) return [text];
    const chunks = [];
    const lines = text.split('\n');
    let current = '';
    for (const line of lines) {
        if ((current + '\n' + line).length > max) {
            if (current) chunks.push(current);
            current = line;
        } else {
            current = current ? current + '\n' + line : line;
        }
    }
    if (current) chunks.push(current);
    return chunks;
}

// ── Price refresh ─────────────────────────────────────────────
async function refreshPrices() {
    const stale = await db.getStaleTickers(PRICE_STALE_MS);
    if (!stale.length) return;

    const updates = stale.map(s => {
        const newPrice = calcNewPrice(s.current_price, s.base_price, s.volatility);
        const changePct = ((newPrice - s.current_price) / s.current_price) * 100;
        return {
            ticker:         s.ticker,
            previous_price: s.current_price,
            current_price:  newPrice,
            change_pct:     Math.round(changePct * 1000) / 1000,
        };
    });

    await db.updateStockPrices(updates);
}

// ── Helpers ───────────────────────────────────────────────────
function pad(str, len) {
    return String(str).padEnd(len);
}

function buildStocksContainer(exchange, page, dbStocks, user) {
    const exInfo = EXCHANGES[exchange];
    const totalPages = Math.ceil(dbStocks.length / 10);
    const currentPage = Math.max(1, Math.min(page, totalPages));

    const startIndex = (currentPage - 1) * 10;
    const pageStocks = dbStocks.slice(startIndex, startIndex + 10);

    const header = `${'TICK'.padEnd(7)} ${'Company'.padEnd(26)} ${'Change'.padEnd(10)} Price\n` + '─'.repeat(58) + '\n';
    let rows = '';
    for (const s of pageStocks) {
        const meta    = STOCK_MAP.get(s.ticker);
        const change  = s.change_pct !== 0
            ? (s.change_pct > 0 ? `+${s.change_pct.toFixed(2)}%` : `${s.change_pct.toFixed(2)}%`)
            : '0.00%';
        const price   = formatPrice(s.current_price);
        const company = (meta?.company || s.company_name || '').slice(0, 25);
        rows += `${pad(s.ticker, 7)} ${pad(company, 26)} ${pad(change, 10)} ${price}\n`;
    }

    const container = new ContainerBuilder()
        .addSectionComponents(
            new SectionBuilder()
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        `## ${exInfo.fullName}\n**Showing ${startIndex + 1}–${Math.min(startIndex + 10, dbStocks.length)} of ${dbStocks.length} stocks**`
                    )
                )
                .setThumbnailAccessory(new ThumbnailBuilder().setURL(user.displayAvatarURL({ forceStatic: true })))
        )
        .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent('```\n' + header + rows + '```'))
        .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));

    const select = new StringSelectMenuBuilder()
        .setCustomId('stocks_select_exchange')
        .setPlaceholder('Switch Stock Exchange')
        .addOptions(
            EXCHANGE_KEYS.map(k => new StringSelectMenuOptionBuilder()
                .setLabel(EXCHANGES[k].fullName)
                .setValue(k)
                .setDefault(k === exchange)
            )
        );

    const btnRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('stocks_prev')
            .setLabel('Previous')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(currentPage === 1),
        new ButtonBuilder()
            .setCustomId('stocks_page_num')
            .setLabel(`Page ${currentPage} / ${totalPages}`)
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(true),
        new ButtonBuilder()
            .setCustomId('stocks_next')
            .setLabel('Next')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(currentPage === totalPages)
    );

    container.addActionRowComponents(new ActionRowBuilder().addComponents(select));
    container.addActionRowComponents(btnRow);

    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            `-# Use \`/stocks info <ticker>\` for details · \`/stocks buy <ticker> <shares>\` to invest`
        )
    );
    container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(false));
    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            `-# This is a **simulated market** for entertainment only. All prices, tickers, and companies are fictional. Do not make real financial decisions based on this data.`
        )
    );

    return container;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('stocks')
        .setDescription('Invest in global stock markets.')
        .addSubcommand(sub =>
            sub.setName('view')
                .setDescription('Browse stocks on an exchange.')
                .addStringOption(opt =>
                    opt.setName('exchange')
                        .setDescription('Stock exchange to view')
                        .setRequired(true)
                        .addChoices(...EXCHANGE_KEYS.map(k => ({
                            name: `${EXCHANGES[k].fullName}`,
                            value: k
                        })))))
        .addSubcommand(sub =>
            sub.setName('info')
                .setDescription('Detailed info on a stock.')
                .addStringOption(opt =>
                    opt.setName('ticker')
                        .setDescription('Stock ticker (e.g. AAPL, NVDA)')
                        .setRequired(true)))
        .addSubcommand(sub =>
            sub.setName('buy')
                .setDescription('Buy shares of a stock.')
                .addStringOption(opt =>
                    opt.setName('ticker')
                        .setDescription('Stock ticker')
                        .setRequired(true))
                .addIntegerOption(opt =>
                    opt.setName('shares')
                        .setDescription('Number of shares to buy')
                        .setRequired(true)
                        .setMinValue(1)
                        .setMaxValue(10000)))
        .addSubcommand(sub =>
            sub.setName('sell')
                .setDescription('Sell shares of a stock.')
                .addStringOption(opt =>
                    opt.setName('ticker')
                        .setDescription('Stock ticker')
                        .setRequired(true))
                .addStringOption(opt =>
                    opt.setName('shares')
                        .setDescription('Number of shares to sell, or "all"')
                        .setRequired(true)))
        .addSubcommand(sub =>
            sub.setName('portfolio')
                .setDescription('View your stock portfolio.')
                .addUserOption(opt =>
                    opt.setName('user')
                        .setDescription('User to view')
                        .setRequired(false))),

    async execute(interaction) {
        const sub    = interaction.options.getSubcommand();
        const { user } = interaction;

        // ponytail: fire-and-forget — user sees current prices instantly, refresh lands before next interaction
        refreshPrices().catch(() => null);

        // ── VIEW ──────────────────────────────────────────────
        if (sub === 'view') {
            const exchange = interaction.options.getString('exchange');
            let dbStocks = await db.getStocksByExchange(exchange);

            if (!dbStocks.length) {
                return interaction.editReply({ content: 'No stocks found for that exchange. Run the migration first.', flags: MessageFlags.Ephemeral });
            }

            let currentPage = 1;
            let currentExchange = exchange;

            const response = await interaction.editReply({
                flags: MessageFlags.IsComponentsV2,
                components: [buildStocksContainer(currentExchange, currentPage, dbStocks, user)]
            });

            const collector = response.createMessageComponentCollector({
                filter: i => i.user.id === user.id,
                time: 120_000,
            });

            collector.on('collect', async i => {
                try {
                    await i.deferUpdate();

                    if (i.customId === 'stocks_prev') {
                        currentPage = Math.max(1, currentPage - 1);
                    } else if (i.customId === 'stocks_next') {
                        currentPage = currentPage + 1;
                    } else if (i.customId === 'stocks_select_exchange') {
                        currentExchange = i.values[0];
                        currentPage = 1;
                        dbStocks = await db.getStocksByExchange(currentExchange);
                    }

                    const updated = buildStocksContainer(currentExchange, currentPage, dbStocks, user);
                    await interaction.editReply({
                        flags: MessageFlags.IsComponentsV2,
                        components: [updated]
                    }).catch(() => null);
                } catch (err) {
                    console.error('[STOCKS INTERACTION ERROR]', err);
                }
            });

            collector.on('end', async () => {
                try {
                    const final = buildStocksContainer(currentExchange, currentPage, dbStocks, user);
                    for (const c of final.components || []) {
                        if (c.components) {
                            for (const comp of c.components) {
                                if (typeof comp.setDisabled === 'function') comp.setDisabled(true);
                            }
                        }
                        if (typeof c.setDisabled === 'function') c.setDisabled(true);
                    }
                    await interaction.editReply({
                        flags: MessageFlags.IsComponentsV2,
                        components: [final]
                    }).catch(() => null);
                } catch (err) {
                    // Ignore
                }
            });

            return;
        }

        // ── INFO ──────────────────────────────────────────────
        if (sub === 'info') {
            const ticker  = interaction.options.getString('ticker').toUpperCase().trim();
            const meta    = STOCK_MAP.get(ticker);
            if (!meta) {
                return interaction.editReply({
                    content: `Unknown ticker **${ticker}**. Use \`/stocks view\` to browse available tickers.`,
                    flags: MessageFlags.Ephemeral
                });
            }

            const stock = await db.getStock(ticker);
            if (!stock) {
                return interaction.editReply({
                    content: `Stock **${ticker}** not found in database. Run migration first.`,
                    flags: MessageFlags.Ephemeral
                });
            }

            const holding  = await db.getUserHolding(user.id, ticker);
            const exInfo   = EXCHANGES[stock.exchange];
            const changeStr = formatChange(stock.change_pct || 0);
            const bar       = priceBar(stock.current_price, stock.base_price);

            let holdingText = '';
            if (holding) {
                const plPerShare = stock.current_price - holding.avg_buy_price;
                const plTotal    = plPerShare * holding.shares;
                const plPct      = ((plPerShare / holding.avg_buy_price) * 100).toFixed(2);
                const plSign     = plTotal >= 0 ? '+' : '';
                holdingText = `\n\n**Your Position**\nShares: **${holding.shares.toLocaleString()}**\nAvg buy: ${coin} ${formatPrice(holding.avg_buy_price)}\nCurrent value: ${coin} ${formatPrice(stock.current_price * holding.shares)}\nP&L: ${plSign}${coin} ${formatPrice(plTotal)} (${plSign}${plPct}%)`;
            }

            // Generate chart image
            const chartBuffer = generateStockChart(
                ticker,
                meta.company,
                stock.current_price,
                stock.base_price,
                meta.volatility,
                stock.change_pct || 0
            );
            const chartFileName = `chart_${ticker.toLowerCase()}.png`;
            const attachment = new AttachmentBuilder(chartBuffer, { name: chartFileName });

            const container = new ContainerBuilder()
                .addSectionComponents(
                    new SectionBuilder()
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent(
                                `## ${ticker} - ${meta.company}\n${exInfo.fullName}`
                            )
                        )
                        .setThumbnailAccessory(new ThumbnailBuilder().setURL(user.displayAvatarURL({ forceStatic: true })))
                )
                .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        `**Price:** ${coin} ${formatPrice(stock.current_price)} coins\n` +
                        `**Change:** ${changeStr}\n` +
                        `**Previous:** ${coin} ${formatPrice(stock.previous_price || stock.current_price)}\n` +
                        `**Base price:** ${coin} ${formatPrice(stock.base_price)}\n` +
                        `**Volatility:** ${(meta.volatility * 100).toFixed(1)}% per update\n\n` +
                        `**Price vs Base:**\n${bar}` +
                        holdingText
                    )
                )
                .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
                .addMediaGalleryComponents(
                    new MediaGalleryBuilder().addItems(
                        new MediaGalleryItemBuilder()
                            .setURL(`attachment://${chartFileName}`)
                            .setDescription(`${ticker} price chart`)
                    )
                )
                .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        `-# Prices update every minute · \`/stocks buy ${ticker} <shares>\` to invest`
                    )
                )
                .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(false))
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        `-# This is a **simulated market** for entertainment only. All prices, tickers, and companies are fictional. Do not make real financial decisions based on this data.`
                    )
                );

            return interaction.editReply({
                flags: MessageFlags.IsComponentsV2,
                components: [container],
                files: [attachment]
            });
        }

        // ── BUY ───────────────────────────────────────────────
        if (sub === 'buy') {
            const ticker = interaction.options.getString('ticker').toUpperCase().trim();
            const shares = interaction.options.getInteger('shares');
            const meta   = STOCK_MAP.get(ticker);

            if (!meta) {
                return interaction.editReply({
                    content: `Unknown ticker **${ticker}**. Use \`/stocks view\` to browse.`,
                    flags: MessageFlags.Ephemeral
                });
            }

            const stock = await db.getStock(ticker);
            if (!stock) {
                return interaction.editReply({ content: 'Stock not found in DB. Run migration.', flags: MessageFlags.Ephemeral });
            }

            const total   = stock.current_price * shares;
            const profile = await db.getUser(user.id);

            if (profile.wallet < total) {
                return interaction.editReply({
                    content: `Not enough coins! **${shares}x ${ticker}** costs ${coin} **${formatPrice(total)}**. Your wallet: ${coin} **${formatPrice(profile.wallet)}**.`,
                    flags: MessageFlags.Ephemeral
                });
            }

            await db.buyStock(user.id, ticker, shares, stock.current_price);
            const updated = await db.getUser(user.id);
            const holding = await db.getUserHolding(user.id, ticker);

            const container = new ContainerBuilder()
                .addSectionComponents(
                    new SectionBuilder()
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent(
                                `## Shares Purchased\nBought **${shares.toLocaleString()}x ${ticker}** - ${meta.company}`
                            )
                        )
                        .setThumbnailAccessory(new ThumbnailBuilder().setURL(user.displayAvatarURL({ forceStatic: true })))
                )
                .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        `**Shares bought:** ${shares.toLocaleString()}\n` +
                        `**Price per share:** ${coin} ${formatPrice(stock.current_price)}\n` +
                        `**Total paid:** ${coin} ${formatPrice(total)}\n` +
                        `**Wallet remaining:** ${coin} ${formatPrice(updated.wallet)}\n\n` +
                        `**Total position:** ${holding.shares.toLocaleString()} shares @ avg ${coin} ${formatPrice(holding.avg_buy_price)}`
                    )
                )
                .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(false))
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        `-# This is a **simulated market** for entertainment only. All prices, tickers, and companies are fictional. Do not make real financial decisions based on this data.`
                    )
                );

            return interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [container] });
        }

        // ── SELL ──────────────────────────────────────────────
        if (sub === 'sell') {
            const ticker    = interaction.options.getString('ticker').toUpperCase().trim();
            const sharesRaw = interaction.options.getString('shares');
            const meta      = STOCK_MAP.get(ticker);

            if (!meta) {
                return interaction.editReply({
                    content: `Unknown ticker **${ticker}**. Use \`/stocks view\` to browse.`,
                    flags: MessageFlags.Ephemeral
                });
            }

            const stock   = await db.getStock(ticker);
            const holding = await db.getUserHolding(user.id, ticker);

            if (!holding || holding.shares === 0) {
                return interaction.editReply({
                    content: `You don't own any **${ticker}** shares.`,
                    flags: MessageFlags.Ephemeral
                });
            }

            let sharesToSell;
            if (sharesRaw.toLowerCase() === 'all') {
                sharesToSell = holding.shares;
            } else {
                sharesToSell = parseInt(sharesRaw, 10);
                if (isNaN(sharesToSell) || sharesToSell < 1) {
                    return interaction.editReply({ content: 'Invalid share amount. Enter a number or "all".', flags: MessageFlags.Ephemeral });
                }
                if (sharesToSell > holding.shares) {
                    return interaction.editReply({
                        content: `You only have **${holding.shares.toLocaleString()}** shares of ${ticker}.`,
                        flags: MessageFlags.Ephemeral
                    });
                }
            }

            const result  = await db.sellStock(user.id, ticker, sharesToSell, stock.current_price);
            const updated = await db.getUser(user.id);
            const pl      = result.profitLoss;
            const plSign  = pl >= 0 ? '+' : '';
            const plColor = pl >= 0 ? 0x00C853 : 0xFF1744;

            const container = new ContainerBuilder()
                .addSectionComponents(
                    new SectionBuilder()
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent(
                                `## Shares Sold\nSold **${sharesToSell.toLocaleString()}x ${ticker}** - ${meta.company}`
                            )
                        )
                        .setThumbnailAccessory(new ThumbnailBuilder().setURL(user.displayAvatarURL({ forceStatic: true })))
                )
                .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        `**Shares sold:** ${sharesToSell.toLocaleString()}\n` +
                        `**Sell price:** ${coin} ${formatPrice(stock.current_price)} per share\n` +
                        `**Total received:** ${coin} ${formatPrice(result.total)}\n` +
                        `**Profit / Loss:** ${plSign}${coin} ${formatPrice(Math.abs(pl))}\n\n` +
                        `**Wallet:** ${coin} ${formatPrice(updated.wallet)}`
                    )
                )
                .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(false))
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        `-# This is a **simulated market** for entertainment only. All prices, tickers, and companies are fictional. Do not make real financial decisions based on this data.`
                    )
                );

            return interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [container] });
        }

        // ── PORTFOLIO ─────────────────────────────────────────
        if (sub === 'portfolio') {
            const target = interaction.options.getUser('user') || user;
            const isSelf = target.id === user.id;

            const holdings = await db.getUserPortfolio(target.id);

            if (!holdings.length) {
                const container = new ContainerBuilder()
                    .addSectionComponents(
                        new SectionBuilder()
                            .addTextDisplayComponents(
                                new TextDisplayBuilder().setContent(
                                    `## ${isSelf ? 'Your' : `${target.displayName}'s`} Portfolio\nNo stock holdings yet.`
                                )
                            )
                            .setThumbnailAccessory(new ThumbnailBuilder().setURL(target.displayAvatarURL({ forceStatic: true })))
                    )
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(
                            `-# Start investing with \`/stocks buy <ticker> <shares>\``
                        )
                    )
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(
                            `-# This is a **simulated market** for entertainment only. All prices, tickers, and companies are fictional. Do not make real financial decisions based on this data.`
                        )
                    );
                return interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [container] });
            }

            let totalInvested  = 0;
            let totalValue     = 0;
            let portfolioLines = '';

            for (const h of holdings) {
                const stockData   = h.stocks;
                const currentPrice = stockData?.current_price || h.avg_buy_price;
                const value        = currentPrice * h.shares;
                const invested     = h.avg_buy_price * h.shares;
                const pl           = value - invested;
                const plPct        = ((pl / invested) * 100).toFixed(2);
                const plSign       = pl >= 0 ? '+' : '';

                totalInvested += invested;
                totalValue    += value;

                portfolioLines += `**${h.ticker}** x${h.shares.toLocaleString()}\n`;
                portfolioLines += `-# Avg ${coin} ${formatPrice(h.avg_buy_price)} · Now ${coin} ${formatPrice(currentPrice)} · ${plSign}${coin} ${formatPrice(pl)} (${plSign}${plPct}%)\n`;
            }

            const totalPL    = totalValue - totalInvested;
            const totalPlPct = totalInvested > 0 ? ((totalPL / totalInvested) * 100).toFixed(2) : '0.00';
            const totalPlSign = totalPL >= 0 ? '+' : '';

            const container = new ContainerBuilder()
                .addSectionComponents(
                    new SectionBuilder()
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent(
                                `## ${isSelf ? 'Your' : `${target.displayName}'s`} Portfolio\n**${holdings.length}** position${holdings.length !== 1 ? 's' : ''}`
                            )
                        )
                        .setThumbnailAccessory(new ThumbnailBuilder().setURL(target.displayAvatarURL({ forceStatic: true })))
                )
                .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
                .addTextDisplayComponents(new TextDisplayBuilder().setContent(portfolioLines.trim()))
                .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        `**Total invested:** ${coin} ${formatPrice(totalInvested)}\n` +
                        `**Current value:** ${coin} ${formatPrice(totalValue)}\n` +
                        `**Overall P&L:** ${totalPlSign}${coin} ${formatPrice(Math.abs(totalPL))} (${totalPlSign}${totalPlPct}%)`
                    )
                )
                .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(false))
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        `-# This is a **simulated market** for entertainment only. All prices, tickers, and companies are fictional. Do not make real financial decisions based on this data.`
                    )
                );

            return interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [container] });
        }
    }
};
