-- Migration 005: Lottery system tables
-- Created: 2026-06-17

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

CREATE INDEX IF NOT EXISTS idx_lottery_tickets_round ON lottery_tickets(round);

-- Seed the single state row
INSERT INTO lottery_state (id, pot, round, last_drawn_at)
VALUES (1, 0, 1, '1970-01-01T00:00:00Z')
ON CONFLICT (id) DO NOTHING;
