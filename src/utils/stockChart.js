'use strict';

const { createCanvas } = require('@napi-rs/canvas');

// ── Canvas dimensions ──────────────────────────────────────────────────────
const W   = 960;
const H   = 420;
const PAD = { top: 72, right: 48, bottom: 48, left: 88 };

// ── Seeded PRNG (mulberry32) ───────────────────────────────────────────────
function mulberry32(seed) {
    return function () {
        seed |= 0; seed = seed + 0x6D2B79F5 | 0;
        let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
}

function tickerSeed(ticker) {
    let h = 0;
    for (let i = 0; i < ticker.length; i++) {
        h = Math.imul(31, h) + ticker.charCodeAt(i) | 0;
    }
    return h >>> 0;
}

// ── Simulate price history ─────────────────────────────────────────────────
// Uses a seeded RNG so the same ticker always produces the same-looking shape,
// then snaps the last point to the real currentPrice for accuracy.
function simulatePriceHistory(ticker, currentPrice, basePrice, volatility, points = 60) {
    const rng = mulberry32(tickerSeed(ticker));
    const prices = [];

    let price = basePrice;
    // Calculate drift so we naturally arrive near currentPrice at the end
    const totalDrift = currentPrice - basePrice;
    const drift      = totalDrift / points;

    for (let i = 0; i < points; i++) {
        const noise  = (rng() * 2 - 1) * volatility * price * 0.6;
        const jitter = drift * (0.4 + rng() * 1.2);
        price = Math.max(basePrice * 0.05, price + jitter + noise);
        prices.push(price);
    }
    // Anchor final point
    prices[prices.length - 1] = currentPrice;
    return prices;
}

// ── Formatting ─────────────────────────────────────────────────────────────
function fmt(p) {
    if (p >= 1000) return p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (p >= 10)   return p.toFixed(2);
    if (p >= 1)    return p.toFixed(3);
    return p.toFixed(4);
}

// ── Rounded rect helper ────────────────────────────────────────────────────
function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
}

/**
 * Generate a stock price chart as a PNG Buffer.
 * @param {string} ticker
 * @param {string} companyName
 * @param {number} currentPrice
 * @param {number} basePrice
 * @param {number} volatility
 * @param {number} changePct
 * @returns {Buffer} PNG image buffer
 */
function generateStockChart(ticker, companyName, currentPrice, basePrice, volatility, changePct) {
    const prices   = simulatePriceHistory(ticker, currentPrice, basePrice, volatility);
    const minP     = Math.min(...prices);
    const maxP     = Math.max(...prices);
    // Add 5% padding so the line never touches the very edge
    const padRange = (maxP - minP) * 0.12 || currentPrice * 0.05;
    const lo       = minP - padRange;
    const hi       = maxP + padRange;
    const range    = hi - lo;

    const isPos     = changePct >= 0;
    const lineColor = isPos ? '#3bdc86' : '#ff5569';
    const glowColor = isPos ? 'rgba(59,220,134,0.35)' : 'rgba(255,85,105,0.35)';
    const fillTop   = isPos ? 'rgba(59,220,134,0.18)' : 'rgba(255,85,105,0.18)';

    const canvas = createCanvas(W, H);
    const ctx    = canvas.getContext('2d');

    // ── Background gradient ──────────────────────────────────────
    const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
    bgGrad.addColorStop(0, '#12141f');
    bgGrad.addColorStop(1, '#0b0d15');
    roundRect(ctx, 0, 0, W, H, 16);
    ctx.fillStyle = bgGrad;
    ctx.fill();

    // ── Coordinate helpers ───────────────────────────────────────
    const plotW = W - PAD.left - PAD.right;
    const plotH = H - PAD.top - PAD.bottom;

    function mapX(i) {
        return PAD.left + (i / (prices.length - 1)) * plotW;
    }
    function mapY(p) {
        return PAD.top + plotH - ((p - lo) / range) * plotH;
    }

    // ── Grid lines ───────────────────────────────────────────────
    const GRID_LINES = 4;
    ctx.strokeStyle = 'rgba(255,255,255,0.055)';
    ctx.lineWidth   = 1;
    ctx.font        = '13px "Courier New", monospace';
    ctx.fillStyle   = 'rgba(140,150,180,0.65)';
    ctx.textAlign   = 'right';
    for (let i = 0; i <= GRID_LINES; i++) {
        const y = PAD.top + (plotH / GRID_LINES) * i;
        ctx.beginPath();
        ctx.moveTo(PAD.left, y);
        ctx.lineTo(W - PAD.right, y);
        ctx.stroke();

        const priceAtLine = hi - (range / GRID_LINES) * i;
        ctx.fillText(fmt(priceAtLine), PAD.left - 10, y + 5);
    }

    // ── Clip plot area before drawing curve ──────────────────────
    ctx.save();
    ctx.beginPath();
    ctx.rect(PAD.left, PAD.top, plotW, plotH);
    ctx.clip();

    // ── Fill gradient under curve ────────────────────────────────
    const areaGrad = ctx.createLinearGradient(0, PAD.top, 0, PAD.top + plotH);
    areaGrad.addColorStop(0, fillTop);
    areaGrad.addColorStop(0.7, 'rgba(0,0,0,0)');

    ctx.beginPath();
    ctx.moveTo(mapX(0), mapY(prices[0]));
    for (let i = 1; i < prices.length; i++) {
        const x0 = mapX(i - 1), y0 = mapY(prices[i - 1]);
        const x1 = mapX(i),     y1 = mapY(prices[i]);
        const cx  = (x0 + x1) / 2;
        ctx.bezierCurveTo(cx, y0, cx, y1, x1, y1);
    }
    ctx.lineTo(mapX(prices.length - 1), PAD.top + plotH);
    ctx.lineTo(mapX(0), PAD.top + plotH);
    ctx.closePath();
    ctx.fillStyle = areaGrad;
    ctx.fill();

    // ── Price line ───────────────────────────────────────────────
    ctx.beginPath();
    ctx.moveTo(mapX(0), mapY(prices[0]));
    for (let i = 1; i < prices.length; i++) {
        const x0 = mapX(i - 1), y0 = mapY(prices[i - 1]);
        const x1 = mapX(i),     y1 = mapY(prices[i]);
        const cx  = (x0 + x1) / 2;
        ctx.bezierCurveTo(cx, y0, cx, y1, x1, y1);
    }
    ctx.strokeStyle = lineColor;
    ctx.lineWidth   = 2.5;
    ctx.lineJoin    = 'round';
    ctx.stroke();

    // ── Base price dashed reference ──────────────────────────────
    if (basePrice > lo && basePrice < hi) {
        const baseY = mapY(basePrice);
        ctx.setLineDash([6, 5]);
        ctx.strokeStyle = 'rgba(200,210,240,0.2)';
        ctx.lineWidth   = 1.2;
        ctx.beginPath();
        ctx.moveTo(PAD.left, baseY);
        ctx.lineTo(W - PAD.right, baseY);
        ctx.stroke();
        ctx.setLineDash([]);
    }

    ctx.restore(); // un-clip

    // ── Current price endpoint dot ───────────────────────────────
    const endX = mapX(prices.length - 1);
    const endY = mapY(currentPrice);

    // Outer glow
    const glowGrad = ctx.createRadialGradient(endX, endY, 0, endX, endY, 18);
    glowGrad.addColorStop(0, glowColor);
    glowGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.beginPath();
    ctx.arc(endX, endY, 18, 0, Math.PI * 2);
    ctx.fillStyle = glowGrad;
    ctx.fill();

    // White ring
    ctx.beginPath();
    ctx.arc(endX, endY, 6, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    // Colored inner dot
    ctx.beginPath();
    ctx.arc(endX, endY, 4, 0, Math.PI * 2);
    ctx.fillStyle = lineColor;
    ctx.fill();

    // ── Header: ticker (large) + company name ────────────────────
    const HEADER_Y = 38;
    ctx.textAlign  = 'left';
    ctx.font       = 'bold 28px sans-serif';
    ctx.fillStyle  = '#ffffff';
    ctx.fillText(ticker, PAD.left, HEADER_Y);

    const tickerW = ctx.measureText(ticker).width;
    ctx.font      = '15px sans-serif';
    ctx.fillStyle = 'rgba(160,170,200,0.75)';
    ctx.fillText(companyName, PAD.left + tickerW + 14, HEADER_Y);

    // ── Header: price (right-aligned) ────────────────────────────
    const changeLabel = `${isPos ? '+' : ''}${changePct.toFixed(2)}%`;
    const priceLabel  = fmt(currentPrice);

    // Change badge background
    const changeText = ` ${changeLabel} `;
    ctx.font         = 'bold 13px sans-serif';
    const badgeW     = ctx.measureText(changeText).width + 6;
    const badgeH     = 22;
    const badgeX     = W - PAD.right - badgeW;
    const badgeY     = HEADER_Y - 20;
    roundRect(ctx, badgeX, badgeY, badgeW, badgeH, 6);
    ctx.fillStyle = isPos ? 'rgba(59,220,134,0.18)' : 'rgba(255,85,105,0.18)';
    ctx.fill();
    ctx.fillStyle = lineColor;
    ctx.textAlign = 'center';
    ctx.fillText(changeText, badgeX + badgeW / 2, badgeY + 15);

    // Price
    ctx.font      = 'bold 22px "Courier New", monospace';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'right';
    ctx.fillText(priceLabel, W - PAD.right - badgeW - 12, HEADER_Y);

    // ── Footer label ─────────────────────────────────────────────
    ctx.font      = '12px sans-serif';
    ctx.fillStyle = 'rgba(100,110,140,0.7)';
    ctx.textAlign = 'center';
    ctx.fillText('Price history (60 snapshots)  ·  updates every minute', W / 2, H - 12);

    return canvas.toBuffer('image/png');
}

module.exports = { generateStockChart };
