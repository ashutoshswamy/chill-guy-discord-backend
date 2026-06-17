-- Migration 006: Global XP and level system
-- Created: 2026-06-17

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS xp    BIGINT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS level INT    NOT NULL DEFAULT 1;
