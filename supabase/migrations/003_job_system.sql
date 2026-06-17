-- Migration 003: Job system
-- Created: 2026-06-17

CREATE TABLE IF NOT EXISTS user_jobs (
    user_id          TEXT        PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
    job_id           TEXT        NOT NULL,
    rank             INT         NOT NULL DEFAULT 0,
    rank_work_count  INT         NOT NULL DEFAULT 0,
    total_work_count INT         NOT NULL DEFAULT 0,
    total_earned     BIGINT      NOT NULL DEFAULT 0,
    hired_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_worked_at   TIMESTAMPTZ DEFAULT NULL
);

CREATE INDEX IF NOT EXISTS idx_user_jobs_job_id ON user_jobs(job_id);
