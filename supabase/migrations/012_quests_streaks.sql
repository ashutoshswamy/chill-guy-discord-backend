-- Chill Guy Bot — Quests and Streaks Schema

-- ============================================================
-- USER STREAKS
-- ============================================================
CREATE TABLE IF NOT EXISTS user_streaks (
    user_id        TEXT        PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
    daily_streak   INT         NOT NULL DEFAULT 0,
    last_daily_at  TIMESTAMPTZ,
    highest_streak INT         NOT NULL DEFAULT 0,
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- USER QUESTS
-- ============================================================
CREATE TABLE IF NOT EXISTS user_quests (
    user_id      TEXT        NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    quest_id     TEXT        NOT NULL,
    description  TEXT        NOT NULL,
    quest_type   TEXT        NOT NULL, -- 'work', 'fish', 'mine', 'gamble', 'trivia'
    progress     INT         NOT NULL DEFAULT 0,
    target       INT         NOT NULL,
    reward_coins INT         NOT NULL,
    reward_xp    INT         NOT NULL,
    completed    BOOLEAN     NOT NULL DEFAULT false,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at   TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (user_id, quest_id)
);

CREATE INDEX IF NOT EXISTS idx_user_quests_user ON user_quests(user_id);
CREATE INDEX IF NOT EXISTS idx_user_quests_expires ON user_quests(expires_at);
