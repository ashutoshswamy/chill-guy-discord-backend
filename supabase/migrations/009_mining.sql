-- Mining System Migration
-- Run after 008_fishing.sql. Does not touch existing tables.

-- ============================================================
-- USER MINING STATS
-- ============================================================
CREATE TABLE IF NOT EXISTS user_mining (
    user_id              TEXT        PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
    total_mined          INT         NOT NULL DEFAULT 0,
    total_earnings       BIGINT      NOT NULL DEFAULT 0,
    rarest_find_name     TEXT,
    rarest_find_rarity   TEXT,
    last_mined_at        TIMESTAMPTZ
);

-- ============================================================
-- MINING FINDS LOG
-- ============================================================
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
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_mining_finds_user_id  ON mining_finds(user_id);
CREATE INDEX IF NOT EXISTS idx_mining_finds_found_at ON mining_finds(found_at DESC);
