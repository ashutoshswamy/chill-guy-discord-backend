-- Migration 002: Add daily/weekly/monthly claim timestamps to users
-- Created: 2026-06-17

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS daily_claimed_at   TIMESTAMPTZ DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS weekly_claimed_at  TIMESTAMPTZ DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS monthly_claimed_at TIMESTAMPTZ DEFAULT NULL;
