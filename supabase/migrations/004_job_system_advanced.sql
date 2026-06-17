-- Migration 004: Advanced job system — streaks, prestige, performance
-- Created: 2026-06-17

ALTER TABLE user_jobs
    ADD COLUMN IF NOT EXISTS streak           INT          NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS streak_last_at   TIMESTAMPTZ  DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS prestige         INT          NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS pay_multiplier   NUMERIC(5,2) NOT NULL DEFAULT 1.00,
    ADD COLUMN IF NOT EXISTS performance_score INT         NOT NULL DEFAULT 0;
