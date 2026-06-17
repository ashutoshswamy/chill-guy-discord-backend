-- Chill Guy Bot — Global Economy Schema
-- Run this in your Supabase SQL editor to initialize the database.

-- ============================================================
-- USERS (global — no guild_id, like Dank Memer)
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
    user_id      TEXT        PRIMARY KEY,
    wallet       BIGINT      NOT NULL DEFAULT 1000,
    bank         BIGINT      NOT NULL DEFAULT 0,
    total_earned BIGINT      NOT NULL DEFAULT 0,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
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
-- HELPERS
-- ============================================================

-- Auto-update updated_at on users row change
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
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_inventory_user_id ON inventory(user_id);
