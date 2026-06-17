-- Migration 006: Pet system
-- Created: 2026-06-17

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

CREATE INDEX IF NOT EXISTS idx_user_pets_user_id   ON user_pets(user_id);
CREATE INDEX IF NOT EXISTS idx_user_pets_active     ON user_pets(user_id, is_active);
