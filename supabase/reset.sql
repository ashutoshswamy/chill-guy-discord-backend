-- Chill Guy Bot — RESET
-- Wipes all data and schema. Irreversible.

DROP TABLE IF EXISTS stock_transactions  CASCADE;
DROP TABLE IF EXISTS user_stocks         CASCADE;
DROP TABLE IF EXISTS stocks              CASCADE;
DROP TABLE IF EXISTS mining_finds        CASCADE;
DROP TABLE IF EXISTS user_mining         CASCADE;
DROP TABLE IF EXISTS fishing_catches     CASCADE;
DROP TABLE IF EXISTS user_fishing        CASCADE;
DROP TABLE IF EXISTS user_cooldowns      CASCADE;
DROP TABLE IF EXISTS user_pets           CASCADE;
DROP TABLE IF EXISTS lottery_tickets     CASCADE;
DROP TABLE IF EXISTS lottery_state       CASCADE;
DROP TABLE IF EXISTS user_jobs           CASCADE;
DROP TABLE IF EXISTS inventory           CASCADE;
DROP TABLE IF EXISTS users               CASCADE;

DROP FUNCTION IF EXISTS update_updated_at() CASCADE;
