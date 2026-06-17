-- Fishing System Migration
-- Run after schema.sql. Does not touch existing tables.

-- ============================================================
-- USER FISHING STATS
-- ============================================================
CREATE TABLE IF NOT EXISTS user_fishing (
    user_id              TEXT        PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
    total_caught         INT         NOT NULL DEFAULT 0,
    total_earnings       BIGINT      NOT NULL DEFAULT 0,
    biggest_catch_name   TEXT,
    biggest_catch_weight NUMERIC(10, 2),
    last_fished_at       TIMESTAMPTZ
);

-- ============================================================
-- FISHING CATCH LOG
-- ============================================================
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
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_fishing_catches_user_id   ON fishing_catches(user_id);
CREATE INDEX IF NOT EXISTS idx_fishing_catches_caught_at ON fishing_catches(caught_at DESC);
