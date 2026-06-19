-- ============================================================
-- GUILD SETTINGS (per-server admin config)
-- ============================================================
CREATE TABLE IF NOT EXISTS guild_settings (
    guild_id            TEXT         PRIMARY KEY,
    tax_rate            NUMERIC(5,2) NOT NULL DEFAULT 5.00,
    tax_enabled         BOOLEAN      NOT NULL DEFAULT false,
    heist_min_players   INT          NOT NULL DEFAULT 2,
    heist_reward_pool   BIGINT       NOT NULL DEFAULT 50000,
    heist_cooldown_mins INT          NOT NULL DEFAULT 60,
    loan_interest_rate  NUMERIC(5,2) NOT NULL DEFAULT 10.00,
    loan_max_amount     BIGINT       NOT NULL DEFAULT 10000,
    loan_term_days      INT          NOT NULL DEFAULT 7,
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ============================================================
-- USER LOANS
-- ============================================================
CREATE TABLE IF NOT EXISTS user_loans (
    id            BIGSERIAL    PRIMARY KEY,
    user_id       TEXT         NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    principal     BIGINT       NOT NULL,
    interest_rate NUMERIC(5,2) NOT NULL,
    interest_amt  BIGINT       NOT NULL,
    total_owed    BIGINT       NOT NULL,
    amount_paid   BIGINT       NOT NULL DEFAULT 0,
    remaining     BIGINT       NOT NULL,
    taken_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    due_at        TIMESTAMPTZ  NOT NULL,
    paid_off      BOOLEAN      NOT NULL DEFAULT false,
    paid_off_at   TIMESTAMPTZ,
    defaulted     BOOLEAN      NOT NULL DEFAULT false,
    defaulted_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_user_loans_user_id  ON user_loans(user_id);
CREATE INDEX IF NOT EXISTS idx_user_loans_active    ON user_loans(user_id, paid_off, defaulted);
