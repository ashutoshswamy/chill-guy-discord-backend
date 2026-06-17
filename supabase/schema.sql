
-- Chill Guy Bot — Global Economy Schema
-- Run this in your Supabase SQL editor to initialize the database.

-- ============================================================
-- USERS (global — no guild_id, like Dank Memer)
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
    user_id            TEXT        PRIMARY KEY,
    wallet             BIGINT      NOT NULL DEFAULT 1000,
    bank               BIGINT      NOT NULL DEFAULT 0,
    total_earned       BIGINT      NOT NULL DEFAULT 0,
    xp                 BIGINT      NOT NULL DEFAULT 0,
    level              INT         NOT NULL DEFAULT 1,
    daily_claimed_at   TIMESTAMPTZ DEFAULT NULL,
    weekly_claimed_at  TIMESTAMPTZ DEFAULT NULL,
    monthly_claimed_at TIMESTAMPTZ DEFAULT NULL,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- INVENTORY
-- ============================================================
CREATE TABLE IF NOT EXISTS inventory (
    id         BIGSERIAL   PRIMARY KEY,
    user_id    TEXT        NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    item_name  TEXT        NOT NULL,
    quantity   INT         NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, item_name)
);

-- ============================================================
-- JOBS SYSTEM
-- ============================================================
CREATE TABLE IF NOT EXISTS user_jobs (
    user_id           TEXT         PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
    job_id            TEXT         NOT NULL,
    rank              INT          NOT NULL DEFAULT 0,
    rank_work_count   INT          NOT NULL DEFAULT 0,
    total_work_count  INT          NOT NULL DEFAULT 0,
    total_earned      BIGINT       NOT NULL DEFAULT 0,
    streak            INT          NOT NULL DEFAULT 0,
    streak_last_at    TIMESTAMPTZ  DEFAULT NULL,
    prestige          INT          NOT NULL DEFAULT 0,
    pay_multiplier    NUMERIC(5,2) NOT NULL DEFAULT 1.00,
    performance_score INT          NOT NULL DEFAULT 0,
    hired_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    last_worked_at    TIMESTAMPTZ  DEFAULT NULL
);

-- ============================================================
-- LOTTERY SYSTEM
-- ============================================================
CREATE TABLE IF NOT EXISTS lottery_state (
    id            INT         PRIMARY KEY DEFAULT 1,
    pot           BIGINT      NOT NULL DEFAULT 0,
    round         INT         NOT NULL DEFAULT 1,
    last_drawn_at TIMESTAMPTZ NOT NULL DEFAULT '1970-01-01T00:00:00Z',
    CONSTRAINT single_row CHECK (id = 1)
);

CREATE TABLE IF NOT EXISTS lottery_tickets (
    id           BIGSERIAL   PRIMARY KEY,
    user_id      TEXT        NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    round        INT         NOT NULL,
    ticket_count INT         NOT NULL DEFAULT 1,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, round)
);

-- ============================================================
-- PETS SYSTEM
-- ============================================================
CREATE TABLE IF NOT EXISTS user_pets (
    id              BIGSERIAL   PRIMARY KEY,
    user_id         TEXT        NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    pet_type        TEXT        NOT NULL,
    name            TEXT        NOT NULL,
    rarity          TEXT        NOT NULL DEFAULT 'common',
    level           INT         NOT NULL DEFAULT 1,
    xp              INT         NOT NULL DEFAULT 0,
    hunger          INT         NOT NULL DEFAULT 100,
    happiness       INT         NOT NULL DEFAULT 100,
    energy          INT         NOT NULL DEFAULT 100,
    health          INT         NOT NULL DEFAULT 100,
    evolution_stage INT         NOT NULL DEFAULT 0,
    is_active       BOOLEAN     NOT NULL DEFAULT false,
    adopted_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_fed_at     TIMESTAMPTZ DEFAULT NULL,
    last_played_at  TIMESTAMPTZ DEFAULT NULL,
    last_stat_decay TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- COOLDOWNS SYSTEM
-- ============================================================
CREATE TABLE IF NOT EXISTS user_cooldowns (
    user_id    TEXT        NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    action     TEXT        NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (user_id, action)
);

-- ============================================================
-- FISHING SYSTEM
-- ============================================================
CREATE TABLE IF NOT EXISTS user_fishing (
    user_id              TEXT        PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
    total_caught         INT         NOT NULL DEFAULT 0,
    total_earnings       BIGINT      NOT NULL DEFAULT 0,
    biggest_catch_name   TEXT,
    biggest_catch_weight NUMERIC(10, 2),
    last_fished_at       TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS fishing_catches (
    id         BIGSERIAL   PRIMARY KEY,
    user_id    TEXT        NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    fish_name  TEXT        NOT NULL,
    rarity     TEXT        NOT NULL,
    weight     NUMERIC(10, 2) NOT NULL,
    value      BIGINT      NOT NULL,
    rod_used   TEXT        NOT NULL DEFAULT 'Basic Rod',
    caught_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- MINING SYSTEM
-- ============================================================
CREATE TABLE IF NOT EXISTS user_mining (
    user_id              TEXT        PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
    total_mined          INT         NOT NULL DEFAULT 0,
    total_earnings       BIGINT      NOT NULL DEFAULT 0,
    rarest_find_name     TEXT,
    rarest_find_rarity   TEXT,
    last_mined_at        TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS mining_finds (
    id          BIGSERIAL   PRIMARY KEY,
    user_id     TEXT        NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    ore_name    TEXT        NOT NULL,
    rarity      TEXT        NOT NULL,
    quantity    INT         NOT NULL DEFAULT 1,
    value       BIGINT      NOT NULL,
    pickaxe_used TEXT       NOT NULL DEFAULT 'Wooden Pickaxe',
    found_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- STOCK MARKET SYSTEM
-- ============================================================
CREATE TABLE IF NOT EXISTS stocks (
    ticker         TEXT           PRIMARY KEY,
    exchange       TEXT           NOT NULL,
    company_name   TEXT           NOT NULL,
    base_price     NUMERIC(12,4)  NOT NULL,
    current_price  NUMERIC(12,4)  NOT NULL,
    previous_price NUMERIC(12,4)  NOT NULL,
    volatility     NUMERIC(6,4)   NOT NULL DEFAULT 0.05,
    change_pct     NUMERIC(8,4)   NOT NULL DEFAULT 0,
    last_updated   TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_stocks (
    id             BIGSERIAL      PRIMARY KEY,
    user_id        TEXT           NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    ticker         TEXT           NOT NULL REFERENCES stocks(ticker),
    shares         INTEGER        NOT NULL DEFAULT 0,
    avg_buy_price  NUMERIC(12,4)  NOT NULL,
    UNIQUE(user_id, ticker)
);

CREATE TABLE IF NOT EXISTS stock_transactions (
    id              BIGSERIAL      PRIMARY KEY,
    user_id         TEXT           NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    ticker          TEXT           NOT NULL,
    type            TEXT           NOT NULL CHECK (type IN ('buy','sell')),
    shares          INTEGER        NOT NULL,
    price_per_share NUMERIC(12,4)  NOT NULL,
    total           NUMERIC(14,4)  NOT NULL,
    created_at      TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_inventory_user_id ON inventory(user_id);
CREATE INDEX IF NOT EXISTS idx_user_jobs_job_id ON user_jobs(job_id);
CREATE INDEX IF NOT EXISTS idx_lottery_tickets_round ON lottery_tickets(round);
CREATE INDEX IF NOT EXISTS idx_user_pets_user_id ON user_pets(user_id);
CREATE INDEX IF NOT EXISTS idx_user_pets_active ON user_pets(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_user_cooldowns_user ON user_cooldowns(user_id);
CREATE INDEX IF NOT EXISTS idx_fishing_catches_user_id ON fishing_catches(user_id);
CREATE INDEX IF NOT EXISTS idx_fishing_catches_caught_at ON fishing_catches(caught_at DESC);
CREATE INDEX IF NOT EXISTS idx_mining_finds_user_id ON mining_finds(user_id);
CREATE INDEX IF NOT EXISTS idx_mining_finds_found_at ON mining_finds(found_at DESC);
CREATE INDEX IF NOT EXISTS idx_stocks_exchange ON stocks(exchange);
CREATE INDEX IF NOT EXISTS idx_stocks_last_updated ON stocks(last_updated);
CREATE INDEX IF NOT EXISTS idx_user_stocks_user_id ON user_stocks(user_id);
CREATE INDEX IF NOT EXISTS idx_stock_tx_user_id ON stock_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_stock_tx_created_at ON stock_transactions(created_at DESC);

-- ============================================================
-- HELPERS / TRIGGERS
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- SEED DATA
-- ============================================================
INSERT INTO lottery_state (id, pot, round, last_drawn_at)
VALUES (1, 0, 1, '1970-01-01T00:00:00Z')
ON CONFLICT (id) DO NOTHING;

INSERT INTO stocks (ticker, exchange, company_name, base_price, current_price, previous_price, volatility, change_pct) VALUES

-- ── NYSE (50) ──────────────────────────────────────────────────
('BRK',  'NYSE', 'Berkshire Hathaway',       4800, 4800, 4800, 0.025, 0),
('JPM',  'NYSE', 'JPMorgan Chase',             220,  220,  220, 0.035, 0),
('V',    'NYSE', 'Visa Inc.',                  280,  280,  280, 0.030, 0),
('WMT',  'NYSE', 'Walmart',                    180,  180,  180, 0.025, 0),
('JNJ',  'NYSE', 'Johnson & Johnson',          160,  160,  160, 0.025, 0),
('PG',   'NYSE', 'Procter & Gamble',           170,  170,  170, 0.022, 0),
('MA',   'NYSE', 'Mastercard',                 480,  480,  480, 0.032, 0),
('BAC',  'NYSE', 'Bank of America',             45,   45,   45, 0.040, 0),
('XOM',  'NYSE', 'ExxonMobil',                 110,  110,  110, 0.045, 0),
('CVX',  'NYSE', 'Chevron',                    160,  160,  160, 0.040, 0),
('HD',   'NYSE', 'Home Depot',                 380,  380,  380, 0.030, 0),
('MRK',  'NYSE', 'Merck & Co.',                130,  130,  130, 0.030, 0),
('ABBV', 'NYSE', 'AbbVie',                     180,  180,  180, 0.035, 0),
('LLY',  'NYSE', 'Eli Lilly',                  800,  800,  800, 0.040, 0),
('PFE',  'NYSE', 'Pfizer',                      28,   28,   28, 0.040, 0),
('KO',   'NYSE', 'Coca-Cola',                   62,   62,   62, 0.020, 0),
('PEP',  'NYSE', 'PepsiCo',                    170,  170,  170, 0.022, 0),
('MCD',  'NYSE', 'McDonald''s',                290,  290,  290, 0.025, 0),
('DIS',  'NYSE', 'Walt Disney',                 95,   95,   95, 0.050, 0),
('COST', 'NYSE', 'Costco Wholesale',            870,  870,  870, 0.025, 0),
('TMO',  'NYSE', 'Thermo Fisher',              550,  550,  550, 0.030, 0),
('ABT',  'NYSE', 'Abbott Laboratories',        110,  110,  110, 0.028, 0),
('UNH',  'NYSE', 'UnitedHealth Group',         580,  580,  580, 0.030, 0),
('DHR',  'NYSE', 'Danaher Corp',               230,  230,  230, 0.032, 0),
('TXN',  'NYSE', 'Texas Instruments',          200,  200,  200, 0.038, 0),
('GE',   'NYSE', 'GE Aerospace',               170,  170,  170, 0.045, 0),
('HON',  'NYSE', 'Honeywell',                  210,  210,  210, 0.030, 0),
('MMM',  'NYSE', '3M Company',                 125,  125,  125, 0.040, 0),
('BA',   'NYSE', 'Boeing',                     185,  185,  185, 0.065, 0),
('CAT',  'NYSE', 'Caterpillar',                370,  370,  370, 0.040, 0),
('DE',   'NYSE', 'Deere & Company',            440,  440,  440, 0.038, 0),
('UPS',  'NYSE', 'United Parcel Service',      140,  140,  140, 0.035, 0),
('FDX',  'NYSE', 'FedEx',                      240,  240,  240, 0.042, 0),
('RTX',  'NYSE', 'RTX Corporation',            115,  115,  115, 0.035, 0),
('LMT',  'NYSE', 'Lockheed Martin',            520,  520,  520, 0.028, 0),
('GS',   'NYSE', 'Goldman Sachs',              490,  490,  490, 0.040, 0),
('MS',   'NYSE', 'Morgan Stanley',             115,  115,  115, 0.038, 0),
('AXP',  'NYSE', 'American Express',           230,  230,  230, 0.035, 0),
('BLK',  'NYSE', 'BlackRock',                  960,  960,  960, 0.032, 0),
('C',    'NYSE', 'Citigroup',                   68,   68,   68, 0.042, 0),
('WFC',  'NYSE', 'Wells Fargo',                 64,   64,   64, 0.040, 0),
('USB',  'NYSE', 'U.S. Bancorp',                48,   48,   48, 0.038, 0),
('TGT',  'NYSE', 'Target Corp',                150,  150,  150, 0.040, 0),
('SBUX', 'NYSE', 'Starbucks',                   95,   95,   95, 0.045, 0),
('NKE',  'NYSE', 'Nike',                        75,   75,   75, 0.040, 0),
('CL',   'NYSE', 'Colgate-Palmolive',           95,   95,   95, 0.022, 0),
('PM',   'NYSE', 'Philip Morris',               95,   95,   95, 0.028, 0),
('MO',   'NYSE', 'Altria Group',                48,   48,   48, 0.030, 0),
('T',    'NYSE', 'AT&T',                        17,   17,   17, 0.030, 0),
('VZ',   'NYSE', 'Verizon',                     40,   40,   40, 0.028, 0),

-- ── NASDAQ (50) ────────────────────────────────────────────────
('AAPL', 'NASDAQ', 'Apple Inc.',               190,  190,  190, 0.035, 0),
('MSFT', 'NASDAQ', 'Microsoft',                420,  420,  420, 0.032, 0),
('NVDA', 'NASDAQ', 'NVIDIA',                   880,  880,  880, 0.070, 0),
('AMZN', 'NASDAQ', 'Amazon',                   185,  185,  185, 0.045, 0),
('GOOGL','NASDAQ', 'Alphabet',                 170,  170,  170, 0.038, 0),
('META', 'NASDAQ', 'Meta Platforms',           520,  520,  520, 0.050, 0),
('TSLA', 'NASDAQ', 'Tesla',                    250,  250,  250, 0.090, 0),
('AVGO', 'NASDAQ', 'Broadcom',                1400, 1400, 1400, 0.045, 0),
('ASML', 'NASDAQ', 'ASML Holding',             980,  980,  980, 0.050, 0),
('AMD',  'NASDAQ', 'Advanced Micro Devices',   175,  175,  175, 0.070, 0),
('ORCL', 'NASDAQ', 'Oracle',                   140,  140,  140, 0.040, 0),
('CSCO', 'NASDAQ', 'Cisco Systems',             54,   54,   54, 0.028, 0),
('ADBE', 'NASDAQ', 'Adobe',                    540,  540,  540, 0.045, 0),
('QCOM', 'NASDAQ', 'Qualcomm',                 165,  165,  165, 0.050, 0),
('INTC', 'NASDAQ', 'Intel',                     25,   25,   25, 0.060, 0),
('NFLX', 'NASDAQ', 'Netflix',                  640,  640,  640, 0.055, 0),
('PYPL', 'NASDAQ', 'PayPal',                    62,   62,   62, 0.060, 0),
('INTU', 'NASDAQ', 'Intuit',                   680,  680,  680, 0.040, 0),
('AMAT', 'NASDAQ', 'Applied Materials',        220,  220,  220, 0.055, 0),
('MU',   'NASDAQ', 'Micron Technology',        115,  115,  115, 0.065, 0),
('KLAC', 'NASDAQ', 'KLA Corp',                 750,  750,  750, 0.050, 0),
('LRCX', 'NASDAQ', 'Lam Research',             920,  920,  920, 0.050, 0),
('SNPS', 'NASDAQ', 'Synopsys',                 520,  520,  520, 0.045, 0),
('CDNS', 'NASDAQ', 'Cadence Design',           310,  310,  310, 0.045, 0),
('PANW', 'NASDAQ', 'Palo Alto Networks',       370,  370,  370, 0.060, 0),
('CRWD', 'NASDAQ', 'CrowdStrike',              340,  340,  340, 0.070, 0),
('ZS',   'NASDAQ', 'Zscaler',                  220,  220,  220, 0.075, 0),
('FTNT', 'NASDAQ', 'Fortinet',                  75,   75,   75, 0.055, 0),
('MRVL', 'NASDAQ', 'Marvell Technology',        70,   70,   70, 0.065, 0),
('MELI', 'NASDAQ', 'MercadoLibre',            2100, 2100, 2100, 0.055, 0),
('REGN', 'NASDAQ', 'Regeneron',               1050, 1050, 1050, 0.040, 0),
('GILD', 'NASDAQ', 'Gilead Sciences',           87,   87,   87, 0.038, 0),
('BIIB', 'NASDAQ', 'Biogen',                   230,  230,  230, 0.050, 0),
('ILMN', 'NASDAQ', 'Illumina',                 130,  130,  130, 0.065, 0),
('IDXX', 'NASDAQ', 'IDEXX Laboratories',       480,  480,  480, 0.040, 0),
('VRTX', 'NASDAQ', 'Vertex Pharmaceuticals',   490,  490,  490, 0.040, 0),
('ALGN', 'NASDAQ', 'Align Technology',         240,  240,  240, 0.060, 0),
('DXCM', 'NASDAQ', 'DexCom',                    75,   75,   75, 0.065, 0),
('ISRG', 'NASDAQ', 'Intuitive Surgical',       420,  420,  420, 0.040, 0),
('HOLX', 'NASDAQ', 'Hologic',                   70,   70,   70, 0.045, 0),
('MRNA', 'NASDAQ', 'Moderna',                   65,   65,   65, 0.085, 0),
('HOOD', 'NASDAQ', 'Robinhood Markets',          22,   22,   22, 0.100, 0),
('COIN', 'NASDAQ', 'Coinbase Global',           195,  195,  195, 0.120, 0),
('PLTR', 'NASDAQ', 'Palantir Technologies',      28,   28,   28, 0.100, 0),
('RBLX', 'NASDAQ', 'Roblox Corp',               40,   40,   40, 0.100, 0),
('SNAP', 'NASDAQ', 'Snap Inc.',                  15,   15,   15, 0.120, 0),
('LYFT', 'NASDAQ', 'Lyft Inc.',                  18,   18,   18, 0.100, 0),
('UBER', 'NASDAQ', 'Uber Technologies',          72,   72,   72, 0.060, 0),
('ABNB', 'NASDAQ', 'Airbnb',                    150,  150,  150, 0.065, 0),
('DASH', 'NASDAQ', 'DoorDash',                  125,  125,  125, 0.080, 0),

-- ── LSE (50) ───────────────────────────────────────────────────
('SHEL', 'LSE', 'Shell PLC',                    285,  285,  285, 0.040, 0),
('AZN',  'LSE', 'AstraZeneca',                 1280, 1280, 1280, 0.032, 0),
('HSBA', 'LSE', 'HSBC Holdings',                720,  720,  720, 0.038, 0),
('ULVR', 'LSE', 'Unilever',                     420,  420,  420, 0.025, 0),
('BP',   'LSE', 'BP PLC',                       480,  480,  480, 0.045, 0),
('GSK',  'LSE', 'GSK PLC',                      175,  175,  175, 0.035, 0),
('DGE',  'LSE', 'Diageo',                       280,  280,  280, 0.028, 0),
('LSEG', 'LSE', 'London Stock Exchange Group',  980,  980,  980, 0.032, 0),
('BARC', 'LSE', 'Barclays',                     230,  230,  230, 0.045, 0),
('LLOY', 'LSE', 'Lloyds Banking Group',          55,   55,   55, 0.045, 0),
('RIO',  'LSE', 'Rio Tinto',                    540,  540,  540, 0.050, 0),
('BHP',  'LSE', 'BHP Group',                    220,  220,  220, 0.048, 0),
('GLEN', 'LSE', 'Glencore',                     480,  480,  480, 0.055, 0),
('AAL',  'LSE', 'Anglo American',               185,  185,  185, 0.058, 0),
('IMB',  'LSE', 'Imperial Brands',              205,  205,  205, 0.025, 0),
('BATS', 'LSE', 'British American Tobacco',     270,  270,  270, 0.025, 0),
('NG',   'LSE', 'National Grid',                105,  105,  105, 0.022, 0),
('REL',  'LSE', 'RELX Group',                   340,  340,  340, 0.028, 0),
('SGRO', 'LSE', 'Segro',                         90,   90,   90, 0.040, 0),
('LAND', 'LSE', 'Land Securities',               68,   68,   68, 0.040, 0),
('BLND', 'LSE', 'British Land',                  42,   42,   42, 0.042, 0),
('HMSO', 'LSE', 'Hammerson',                     32,   32,   32, 0.055, 0),
('IHG',  'LSE', 'InterContinental Hotels',      850,  850,  850, 0.035, 0),
('WTB',  'LSE', 'Whitbread',                    320,  320,  320, 0.038, 0),
('BRBY', 'LSE', 'Burberry Group',               110,  110,  110, 0.055, 0),
('MNDI', 'LSE', 'Mondi',                        128,  128,  128, 0.040, 0),
('DS',   'LSE', 'DS Smith',                      42,   42,   42, 0.042, 0),
('DLN',  'LSE', 'Derwent London',               255,  255,  255, 0.040, 0),
('EXPN', 'LSE', 'Experian',                     320,  320,  320, 0.032, 0),
('DPLM', 'LSE', 'Diploma',                      410,  410,  410, 0.038, 0),
('AUTO', 'LSE', 'Auto Trader Group',             70,   70,   70, 0.038, 0),
('STJ',  'LSE', 'St. James''s Place',           140,  140,  140, 0.045, 0),
('SMT',  'LSE', 'Scottish Mortgage Trust',       86,   86,   86, 0.055, 0),
('ABF',  'LSE', 'Associated British Foods',     185,  185,  185, 0.032, 0),
('AHT',  'LSE', 'Ashtead Group',                500,  500,  500, 0.040, 0),
('CCH',  'LSE', 'Coca-Cola HBC',                260,  260,  260, 0.028, 0),
('ENT',  'LSE', 'Entain PLC',                   123,  123,  123, 0.055, 0),
('FLTR', 'LSE', 'Flutter Entertainment',        185,  185,  185, 0.055, 0),
('GAW',  'LSE', 'Games Workshop',               950,  950,  950, 0.050, 0),
('HL',   'LSE', 'Hargreaves Lansdown',          126,  126,  126, 0.040, 0),
('INF',  'LSE', 'Informa',                       78,   78,   78, 0.032, 0),
('JD',   'LSE', 'JD Sports Fashion',            145,  145,  145, 0.055, 0),
('MKS',  'LSE', 'Marks & Spencer',              360,  360,  360, 0.040, 0),
('OCDO', 'LSE', 'Ocado Group',                   42,   42,   42, 0.090, 0),
('PSN',  'LSE', 'Persimmon',                     92,   92,   92, 0.050, 0),
('RKT',  'LSE', 'Reckitt Benckiser',            650,  650,  650, 0.028, 0),
('SBRY', 'LSE', 'J Sainsbury',                   27,   27,   27, 0.035, 0),
('SN',   'LSE', 'Smith & Nephew',               152,  152,  152, 0.038, 0),
('SPX',  'LSE', 'Spirax Group',                 148,  148,  148, 0.038, 0),
('SVT',  'LSE', 'Severn Trent',                 105,  105,  105, 0.022, 0),

-- ── TSE (50) ───────────────────────────────────────────────────
('TYT',   'TSE', 'Toyota Motor',                280,  280,  280, 0.035, 0),
('SNY',   'TSE', 'Sony Group',                  115,  115,  115, 0.045, 0),
('SBK',   'TSE', 'SoftBank Group',               75,   75,   75, 0.080, 0),
('NTT',   'TSE', 'Nippon Telegraph',            165,  165,  165, 0.025, 0),
('NTD',   'TSE', 'Nintendo',                    680,  680,  680, 0.050, 0),
('FASTR', 'TSE', 'Fast Retailing',              410,  410,  410, 0.040, 0),
('KYC',   'TSE', 'Keyence Corp',                580,  580,  580, 0.040, 0),
('MTF',   'TSE', 'Mitsubishi UFJ',              135,  135,  135, 0.040, 0),
('MBC',   'TSE', 'Mitsubishi Corp',             245,  245,  245, 0.040, 0),
('SHC',   'TSE', 'Shin-Etsu Chemical',          580,  580,  580, 0.038, 0),
('FNC',   'TSE', 'Fanuc Corp',                  400,  400,  400, 0.040, 0),
('JRE',   'TSE', 'East Japan Railway',          320,  320,  320, 0.025, 0),
('SVI',   'TSE', 'Seven & i Holdings',          210,  210,  210, 0.030, 0),
('HIT',   'TSE', 'Hitachi Ltd',                 135,  135,  135, 0.040, 0),
('DNS',   'TSE', 'Denso Corp',                  225,  225,  225, 0.042, 0),
('SMC',   'TSE', 'Sumitomo Mitsui',             310,  310,  310, 0.038, 0),
('MZH',   'TSE', 'Mizuho Financial',            245,  245,  245, 0.038, 0),
('ITC',   'TSE', 'Itochu Corp',                 710,  710,  710, 0.035, 0),
('KBT',   'TSE', 'Kubota Corp',                 205,  205,  205, 0.038, 0),
('KMT',   'TSE', 'Komatsu Ltd',                 405,  405,  405, 0.040, 0),
('CAN',   'TSE', 'Canon Inc.',                  395,  395,  395, 0.032, 0),
('DSK',   'TSE', 'Daiichi Sankyo',              420,  420,  420, 0.045, 0),
('TAK',   'TSE', 'Takeda Pharmaceutical',       385,  385,  385, 0.038, 0),
('AST',   'TSE', 'Astellas Pharma',             185,  185,  185, 0.040, 0),
('ESI',   'TSE', 'Eisai Co.',                   500,  500,  500, 0.050, 0),
('JPT',   'TSE', 'Japan Tobacco',               400,  400,  400, 0.025, 0),
('ASH',   'TSE', 'Asahi Group',                 220,  220,  220, 0.035, 0),
('KRN',   'TSE', 'Kirin Holdings',              200,  200,  200, 0.030, 0),
('AJN',   'TSE', 'Ajinomoto Co.',               265,  265,  265, 0.032, 0),
('KKM',   'TSE', 'Kikkoman Corp',               315,  315,  315, 0.030, 0),
('MFD',   'TSE', 'Mitsui Fudosan',              320,  320,  320, 0.035, 0),
('SRE',   'TSE', 'Sumitomo Realty',             275,  275,  275, 0.038, 0),
('RKN',   'TSE', 'Rakuten Group',                85,   85,   85, 0.085, 0),
('CPM',   'TSE', 'Capcom Co.',                  305,  305,  305, 0.055, 0),
('KNM',   'TSE', 'Konami Group',                645,  645,  645, 0.050, 0),
('KDD',   'TSE', 'KDDI Corp',                   420,  420,  420, 0.025, 0),
('NTX',   'TSE', 'NTT Data Group',              210,  210,  210, 0.035, 0),
('BDN',   'TSE', 'Bandai Namco',                365,  365,  365, 0.050, 0),
('PNC',   'TSE', 'Panasonic Holdings',          125,  125,  125, 0.040, 0),
('OMR',   'TSE', 'Omron Corp',                  550,  550,  550, 0.042, 0),
('MRB',   'TSE', 'Marubeni Corp',               220,  220,  220, 0.040, 0),
('MTS',   'TSE', 'Mitsui & Co.',                620,  620,  620, 0.038, 0),
('SMI',   'TSE', 'Sumitomo Corp',               240,  240,  240, 0.038, 0),
('OSG',   'TSE', 'Osaka Gas',                   195,  195,  195, 0.025, 0),
('FJF',   'TSE', 'Fujifilm Holdings',           800,  800,  800, 0.038, 0),
('NDC',   'TSE', 'Nidec Corp',                  500,  500,  500, 0.055, 0),
('DAK',   'TSE', 'Daikin Industries',           175,  175,  175, 0.038, 0),
('SCM',   'TSE', 'Secom Co.',                   450,  450,  450, 0.028, 0),
('RCT',   'TSE', 'Recruit Holdings',            550,  550,  550, 0.040, 0),
('YMH',   'TSE', 'Yamaha Motor',                125,  125,  125, 0.045, 0),

-- ── HKEX (50) ──────────────────────────────────────────────────
('TCT',  'HKEX', 'Tencent Holdings',            380,  380,  380, 0.055, 0),
('BABA', 'HKEX', 'Alibaba Group',                85,   85,   85, 0.070, 0),
('MTN',  'HKEX', 'Meituan',                     160,  160,  160, 0.065, 0),
('HBC',  'HKEX', 'HSBC Holdings HK',             72,   72,   72, 0.038, 0),
('AIA',  'HKEX', 'AIA Group',                    62,   62,   62, 0.040, 0),
('CHM',  'HKEX', 'China Mobile',                 50,   50,   50, 0.035, 0),
('JDH',  'HKEX', 'JD.com HK',                  130,  130,  130, 0.065, 0),
('PIN',  'HKEX', 'Ping An Insurance',            45,   45,   45, 0.050, 0),
('BYD',  'HKEX', 'BYD Company',                 250,  250,  250, 0.065, 0),
('CCB',  'HKEX', 'China Construction Bank',      50,   50,   50, 0.035, 0),
('ICB',  'HKEX', 'Industrial & Commercial Bank', 40,   40,   40, 0.032, 0),
('BOC',  'HKEX', 'Bank of China',                30,   30,   30, 0.032, 0),
('CLI',  'HKEX', 'China Life Insurance',         15,   15,   15, 0.045, 0),
('PCN',  'HKEX', 'PetroChina',                   50,   50,   50, 0.045, 0),
('CNOC', 'HKEX', 'CNOOC Ltd',                    18,   18,   18, 0.050, 0),
('XMI',  'HKEX', 'Xiaomi Corp',                  17,   17,   17, 0.065, 0),
('NTE',  'HKEX', 'NetEase HK',                  160,  160,  160, 0.055, 0),
('LIN',  'HKEX', 'Li Ning',                      22,   22,   22, 0.065, 0),
('SCH',  'HKEX', 'Sands China',                  25,   25,   25, 0.070, 0),
('GLE',  'HKEX', 'Galaxy Entertainment',          42,   42,   42, 0.065, 0),
('CIS',  'HKEX', 'CITIC Securities',              20,   20,   20, 0.050, 0),
('HSB',  'HKEX', 'Hang Seng Bank',               120,  120,  120, 0.030, 0),
('SHK',  'HKEX', 'Sun Hung Kai Properties',      112,  112,  112, 0.042, 0),
('CKH',  'HKEX', 'CK Hutchison Holdings',         52,   52,   52, 0.040, 0),
('PWR',  'HKEX', 'Power Assets Holdings',         58,   58,   58, 0.025, 0),
('CLP',  'HKEX', 'CLP Holdings',                  80,   80,   80, 0.022, 0),
('MTR',  'HKEX', 'MTR Corporation',               31,   31,   31, 0.025, 0),
('HKX',  'HKEX', 'HK Exchanges & Clearing',      330,  330,  330, 0.040, 0),
('SWP',  'HKEX', 'Swire Pacific',                 16,   16,   16, 0.040, 0),
('CPW',  'HKEX', 'Cathay Pacific Airways',          9,    9,    9, 0.065, 0),
('HLD',  'HKEX', 'Henderson Land Development',    30,   30,   30, 0.045, 0),
('NWD',  'HKEX', 'New World Development',           8,    8,    8, 0.065, 0),
('SNL',  'HKEX', 'Sino Land',                     11,   11,   11, 0.042, 0),
('WHF',  'HKEX', 'Wharf Holdings',                17,   17,   17, 0.045, 0),
('LKR',  'HKEX', 'Link REIT',                     70,   70,   70, 0.030, 0),
('FTRE', 'HKEX', 'Fortune REIT',                  11,   11,   11, 0.035, 0),
('CTG',  'HKEX', 'Country Garden',                  2,    2,    2, 0.150, 0),
('EVG',  'HKEX', 'Evergrande Group',                1,    1,    1, 0.200, 0),
('VNK',  'HKEX', 'China Vanke',                    8,    8,    8, 0.100, 0),
('LGF',  'HKEX', 'Longfor Group',                 12,   12,   12, 0.080, 0),
('SNC',  'HKEX', 'Sunac China',                     1,    1,    1, 0.180, 0),
('CRH',  'HKEX', 'China Resources Land',           40,   40,   40, 0.055, 0),
('CIT',  'HKEX', 'CITIC Pacific',                   9,    9,    9, 0.050, 0),
('NWS',  'HKEX', 'NWS Holdings',                  13,   13,   13, 0.040, 0),
('SGS',  'HKEX', 'Sino Gas International',          6,    6,    6, 0.060, 0),
('CGH',  'HKEX', 'China Gas Holdings',             13,   13,   13, 0.055, 0),
('ENN',  'HKEX', 'ENN Energy Holdings',            60,   60,   60, 0.050, 0),
('KNL',  'HKEX', 'Kunlun Energy',                   8,    8,    8, 0.055, 0),
('TEK',  'HKEX', 'Techtronic Industries',          25,   25,   25, 0.040, 0),
('WHL',  'HKEX', 'Wheelock & Co.',                 35,   35,   35, 0.040, 0)

ON CONFLICT (ticker) DO NOTHING;

INSERT INTO stocks (ticker, exchange, company_name, base_price, current_price, previous_price, volatility, change_pct) VALUES
('RELI',   'NSE', 'Reliance Industries',          280,  280,  280, 0.042, 0),
('TCS',    'NSE', 'Tata Consultancy Services',    410,  410,  410, 0.035, 0),
('HDFCB',  'NSE', 'HDFC Bank',                   175,  175,  175, 0.038, 0),
('INFY',   'NSE', 'Infosys',                      190,  190,  190, 0.040, 0),
('ICICIB', 'NSE', 'ICICI Bank',                   130,  130,  130, 0.042, 0),
('HUL',    'NSE', 'Hindustan Unilever',            260,  260,  260, 0.028, 0),
('AIRTEL', 'NSE', 'Bharti Airtel',                170,  170,  170, 0.045, 0),
('ITCL',   'NSE', 'ITC Ltd',                       48,   48,   48, 0.030, 0),
('WIPRO',  'NSE', 'Wipro',                         55,   55,   55, 0.045, 0),
('HCLT',   'NSE', 'HCL Technologies',             180,  180,  180, 0.040, 0),
('AXISB',  'NSE', 'Axis Bank',                    125,  125,  125, 0.045, 0),
('KOTAKB', 'NSE', 'Kotak Mahindra Bank',          180,  180,  180, 0.038, 0),
('LT',     'NSE', 'Larsen & Toubro',              360,  360,  360, 0.038, 0),
('SUNP',   'NSE', 'Sun Pharmaceutical',           170,  170,  170, 0.042, 0),
('MARUTI', 'NSE', 'Maruti Suzuki',               1200, 1200, 1200, 0.038, 0),
('BAJFIN', 'NSE', 'Bajaj Finance',                700,  700,  700, 0.050, 0),
('TITAN',  'NSE', 'Titan Company',                360,  360,  360, 0.042, 0),
('ASPNT',  'NSE', 'Asian Paints',                 340,  340,  340, 0.035, 0),
('NESTLE', 'NSE', 'Nestle India',                 250,  250,  250, 0.028, 0),
('PGRID',  'NSE', 'Power Grid Corp',               31,   31,   31, 0.028, 0),
('NTPC',   'NSE', 'NTPC',                          37,   37,   37, 0.032, 0),
('ONGC',   'NSE', 'ONGC',                          27,   27,   27, 0.048, 0),
('TATAST', 'NSE', 'Tata Steel',                   160,  160,  160, 0.058, 0),
('TECHM',  'NSE', 'Tech Mahindra',                160,  160,  160, 0.048, 0),
('BAJAUTO','NSE', 'Bajaj Auto',                   900,  900,  900, 0.038, 0),
('JSWS',   'NSE', 'JSW Steel',                     94,   94,   94, 0.055, 0),
('HINDZN', 'NSE', 'Hindustan Zinc',                68,   68,   68, 0.042, 0),
('COAL',   'NSE', 'Coal India',                    48,   48,   48, 0.040, 0),
('UCEM',   'NSE', 'UltraTech Cement',            1100, 1100, 1100, 0.038, 0),
('GRASIM', 'NSE', 'Grasim Industries',            270,  270,  270, 0.040, 0),
('ADANIE', 'NSE', 'Adani Enterprises',            320,  320,  320, 0.075, 0),
('ADANIP', 'NSE', 'Adani Ports',                  135,  135,  135, 0.065, 0),
('ADANIG', 'NSE', 'Adani Green Energy',           190,  190,  190, 0.085, 0),
('ADANIT', 'NSE', 'Adani Total Gas',              105,  105,  105, 0.080, 0),
('DIVIS',  'NSE', 'Divi''s Laboratories',         560,  560,  560, 0.042, 0),
('DRRED',  'NSE', 'Dr. Reddy''s Laboratories',    680,  680,  680, 0.040, 0),
('CIPLA',  'NSE', 'Cipla',                        160,  160,  160, 0.038, 0),
('APOLLO', 'NSE', 'Apollo Hospitals',             680,  680,  680, 0.042, 0),
('EICHER', 'NSE', 'Eicher Motors',                450,  450,  450, 0.042, 0),
('SHREEC', 'NSE', 'Shree Cement',                2800, 2800, 2800, 0.038, 0),
('SBIN',   'NSE', 'State Bank of India',           82,   82,   82, 0.045, 0),
('BOB',    'NSE', 'Bank of Baroda',                24,   24,   24, 0.050, 0),
('INDUSB', 'NSE', 'IndusInd Bank',                140,  140,  140, 0.050, 0),
('HAVL',   'NSE', 'Havells India',                170,  170,  170, 0.042, 0),
('DABUR',  'NSE', 'Dabur India',                   53,   53,   53, 0.032, 0),
('PIDIL',  'NSE', 'Pidilite Industries',          310,  310,  310, 0.038, 0),
('GODREJ', 'NSE', 'Godrej Consumer Products',     135,  135,  135, 0.040, 0),
('MTRSON', 'NSE', 'Motherson Sumi Systems',        19,   19,   19, 0.055, 0),
('TATAM',  'NSE', 'Tata Motors',                  100,  100,  100, 0.055, 0),
('MHM',    'NSE', 'Mahindra & Mahindra',          290,  290,  290, 0.045, 0)
ON CONFLICT (ticker) DO NOTHING;
INSERT INTO stocks (ticker, exchange, company_name, base_price, current_price, previous_price, volatility, change_pct) VALUES
('BTC',   'CRYPTO', 'Bitcoin',              6500,    6500,    6500,   0.060, 0),
('ETH',   'CRYPTO', 'Ethereum',              350,     350,     350,   0.070, 0),
('BNB',   'CRYPTO', 'BNB',                   58,      58,      58,   0.065, 0),
('SOL',   'CRYPTO', 'Solana',               160,     160,     160,   0.080, 0),
('XRP',   'CRYPTO', 'XRP',                  0.55,    0.55,    0.55,  0.075, 0),
('DOGE',  'CRYPTO', 'Dogecoin',             0.15,    0.15,    0.15,  0.100, 0),
('ADA',   'CRYPTO', 'Cardano',              0.45,    0.45,    0.45,  0.080, 0),
('TRX',   'CRYPTO', 'TRON',                 0.12,    0.12,    0.12,  0.070, 0),
('AVAX',  'CRYPTO', 'Avalanche',              35,      35,      35,   0.085, 0),
('SHIB',  'CRYPTO', 'Shiba Inu (×1000)',    0.002,   0.002,   0.002, 0.150, 0),
('DOT',   'CRYPTO', 'Polkadot',               7,       7,       7,   0.085, 0),
('LINK',  'CRYPTO', 'Chainlink',              14,      14,      14,   0.080, 0),
('MATIC', 'CRYPTO', 'Polygon',              0.70,    0.70,    0.70,  0.090, 0),
('UNI',   'CRYPTO', 'Uniswap',                8,       8,       8,   0.085, 0),
('LTC',   'CRYPTO', 'Litecoin',              85,      85,      85,   0.065, 0),
('ATOM',  'CRYPTO', 'Cosmos',                 8,       8,       8,   0.085, 0),
('XLM',   'CRYPTO', 'Stellar',              0.10,    0.10,    0.10,  0.080, 0),
('FIL',   'CRYPTO', 'Filecoin',               6,       6,       6,   0.090, 0),
('NEAR',  'CRYPTO', 'NEAR Protocol',          6,       6,       6,   0.090, 0),
('APT',   'CRYPTO', 'Aptos',                  8,       8,       8,   0.095, 0),
('ARB',   'CRYPTO', 'Arbitrum',               1,       1,       1,   0.100, 0),
('OP',    'CRYPTO', 'Optimism',             2.5,     2.5,     2.5,   0.100, 0),
('HBAR',  'CRYPTO', 'Hedera',              0.10,    0.10,    0.10,   0.080, 0),
('VET',   'CRYPTO', 'VeChain',             0.04,    0.04,    0.04,   0.090, 0),
('ICP',   'CRYPTO', 'Internet Computer',     10,      10,      10,   0.090, 0),
('MKR',   'CRYPTO', 'Maker',              2000,    2000,    2000,    0.070, 0),
('AAVE',  'CRYPTO', 'Aave',                 90,      90,      90,   0.075, 0),
('CRV',   'CRYPTO', 'Curve DAO',           0.40,    0.40,    0.40,  0.110, 0),
('COMP',  'CRYPTO', 'Compound',             55,      55,      55,   0.080, 0),
('SNX',   'CRYPTO', 'Synthetix',             2,       2,       2,   0.110, 0),
('GRT',   'CRYPTO', 'The Graph',           0.20,    0.20,    0.20,  0.100, 0),
('ENJ',   'CRYPTO', 'Enjin Coin',          0.30,    0.30,    0.30,  0.100, 0),
('SAND',  'CRYPTO', 'The Sandbox',         0.40,    0.40,    0.40,  0.110, 0),
('MANA',  'CRYPTO', 'Decentraland',        0.35,    0.35,    0.35,  0.110, 0),
('AXS',   'CRYPTO', 'Axie Infinity',         7,       7,       7,   0.100, 0),
('GALA',  'CRYPTO', 'Gala',               0.03,    0.03,    0.03,   0.130, 0),
('IMX',   'CRYPTO', 'Immutable X',           2,       2,       2,   0.110, 0),
('ROSE',  'CRYPTO', 'Oasis Network',       0.10,    0.10,    0.10,  0.120, 0),
('FLOW',  'CRYPTO', 'Flow',               0.80,    0.80,    0.80,   0.100, 0),
('ALGO',  'CRYPTO', 'Algorand',            0.20,    0.20,    0.20,  0.090, 0),
('XTZ',   'CRYPTO', 'Tezos',              0.80,    0.80,    0.80,   0.085, 0),
('EOS',   'CRYPTO', 'EOS',               0.70,    0.70,    0.70,   0.090, 0),
('ZEC',   'CRYPTO', 'Zcash',               30,      30,      30,   0.080, 0),
('TON',   'CRYPTO', 'Toncoin',              5,       5,       5,   0.080, 0),
('BCH',   'CRYPTO', 'Bitcoin Cash',        480,     480,     480,   0.070, 0),
('SUI',   'CRYPTO', 'Sui',                1.5,     1.5,     1.5,   0.110, 0),
('SEI',   'CRYPTO', 'Sei Network',        0.40,    0.40,    0.40,  0.120, 0),
('WLD',   'CRYPTO', 'Worldcoin',            2,       2,       2,   0.110, 0),
('PEPE',  'CRYPTO', 'Pepe (×1000)',       0.001,   0.001,   0.001, 0.180, 0),
('FLOKI', 'CRYPTO', 'Floki (×1000)',      0.002,   0.002,   0.002, 0.170, 0)
ON CONFLICT (ticker) DO NOTHING;
