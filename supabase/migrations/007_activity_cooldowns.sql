-- Migration 007: Persistent activity cooldowns (hunt, dig, chop, mine, etc.)
-- Created: 2026-06-17

CREATE TABLE IF NOT EXISTS user_cooldowns (
    user_id    TEXT        NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    action     TEXT        NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (user_id, action)
);

CREATE INDEX IF NOT EXISTS idx_user_cooldowns_user ON user_cooldowns(user_id);
