-- Migration 001: Set default wallet balance to 1000 coins
-- Created: 2026-06-17

ALTER TABLE users ALTER COLUMN wallet SET DEFAULT 1000;
