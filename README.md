# Chill Guy — Discord Economy & Pet Bot

A feature-rich Discord bot with an advanced economy, job system, virtual pets, simulated stock market, and grinding activities.

---

## Commands Reference

### Core & Utility

| Command | Description | Details |
| ------- | ----------- | ------- |
| `/ping` | Check bot Latency. | Cooldown: None |
| `/help` | Browse help commands. | Cooldown: None · Dropdown & page pagination |

---

### Economy

**Wallet & Banking**

| Command | Description | Details |
| ------- | ----------- | ------- |
| `/balance [user]` | Check wallet, bank, and net worth. | Cooldown: None · Option: user (optional) |
| `/deposit <amount \| all>` | Deposit coins into bank safety. | Cooldown: None · Protects coins from robberies |
| `/withdraw <amount \| all>` | Withdraw coins to wallet for spending. | Cooldown: None |
| `/pay <user> <amount>` | Send wallet coins to another user. | Cooldown: None · Action is irreversible |

**Daily Allowances**

| Command | Description | Details |
| ------- | ----------- | ------- |
| `/daily` | Claim daily allowance of 500-1000 coins. | Cooldown: 24 hours |
| `/weekly` | Claim weekly allowance of 5000-8000 coins. | Cooldown: 7 days |
| `/monthly` | Claim monthly allowance of 25000-40000 coins. | Cooldown: 30 days |

**Grinding & Begging**

| Command | Description | Details |
| ------- | ----------- | ------- |
| `/beg` | Beg for spare change. | Cooldown: 45s · Payout: 5-50 coins |
| `/search` | Search funny locations for loose change or items. | Cooldown: 30s · Payout depends on risk level |

---

### Gambling & Robbing

| Command | Description | Details |
| ------- | ----------- | ------- |
| `/coinflip <amount> <heads \| tails>` | Standard 50/50 flip. | Cooldown: 15s · Win: 2x bet |
| `/slots <amount>` | Spin reels and match symbols. | Cooldown: 15s · Win up to 50x bet |
| `/blackjack <amount>` | Play Blackjack against the dealer. | Cooldown: 15s · Win: 2x bet (2.5x blackjack) |
| `/roulette <amount> <bet>` | Bet on colors or specific numbers. | Cooldown: 15s · Win: Red/Black (2x), Green (14x), Number (36x) |
| `/higherlower <amount>` | Guess if the next card is higher/lower. | Cooldown: 15s · Multiplier climbs up to 30x |
| `/crash <amount>` | Cash out before the multiplier crashes. | Cooldown: 15s · Volatility: Extreme |
| `/rps <amount>` | Classic Rock-Paper-Scissors. | Cooldown: 15s · Draw refunds bet |
| `/cockfight <amount>` | Bet on your active pet rooster. | Cooldown: 15s (Rooster recovery: 5m) |
| `/horserace <amount> <horse>` | Bet on 1 of 5 horses. | Cooldown: 15s · Win: 2x to 8x (depends on odds) |
| `/scratchcard [tier]` | Match 3 items on a 3x3 grid. | Cooldown: 15s · Win up to 20x |
| `/mines <bet> [mines]` | Play Mines. Reveal safe tiles to multiply your bet. | Cooldown: 15s · Grid size: 4x4 |
| `/rob <target>` | Attempt to steal from another wallet. | Cooldown: 10m · Success: 40% (fine on failure) |
| `/lottery buy <tickets>` | Buy lottery tickets (100 coins each). | Cooldown: None · Draw occurs every 24 hours |
| `/lottery info` | Check current lottery pot, round, and your tickets. | Cooldown: None |
| `/lottery draw` | Draw the lottery winner. | Cooldown: Available 24h after last draw |

---

### Jobs & Careers

| Command | Description | Details |
| ------- | ----------- | ------- |
| `/job list` | Browse all available jobs, ranks, and pay. | Cooldown: None |
| `/job apply <job>` | Apply for a job path. | Cooldown: None · Requires minimum level to apply |
| `/job info` | Check current job performance and streak details. | Cooldown: None |
| `/job resign` | Resign from your current career. | Cooldown: None · Resets rank progress |
| `/job prestige` | Reset job rank for permanent pay multipliers. | Cooldown: None · Max prestige: 5 |
| `/work` | Work your active job shift. | Cooldown: 1h · Promotes every 15 shifts |

---

### Activities & Harvesting

Requires permanent tools bought from the `/shop`.

| Command | Description | Required Tool | Details |
| ------- | ----------- | ------------- | ------- |
| `/hunt` | Hunt for game in the wilderness. | Hunting Rifle | Cooldown: 1h |
| `/dig` | Dig for buried treasures. | Shovel | Cooldown: 45m |
| `/chop` | Chop down trees for valuable timber. | Axe | Cooldown: 45m |
| `/mine` | Mine ore veins and rare gems. | Pickaxe | Cooldown: 45m |
| `/fish` | Cast a fishing line. | Fishing Pole | Cooldown: 45m |

---

### Pets System

| Command | Description | Details |
| ------- | ----------- | ------- |
| `/pet adopt <type> <name>` | Adopt a pet companion. | Cooldown: None · Costs coins · Max pets: 5 |
| `/pet status` | View active pet hunger, happiness, energy, and health. | Cooldown: None |
| `/pet feed` | Restore hunger and health. | Cooldown: 1h (cooldown-free with Pet Food item) |
| `/pet play` | Boost happiness, uses energy. | Cooldown: 30m |
| `/pet list` | View all owned pets and stats. | Cooldown: None · Set active companion via select menu |
| `/pet select <id>` | Set active companion pet. | Cooldown: None |
| `/pet rename <name>` | Give your active pet a new name. | Cooldown: None |
| `/pet evolve` | Evolve active pet at lvl 10 (Adult) and lvl 25 (Elder). | Cooldown: None |
| `/pet release <id>` | Release owned pet into wild. | Cooldown: None · Action is permanent |

---

### Simulated Stock Market

Supported Stock Exchanges: **NYSE, NASDAQ, LSE, TSE, HKEX, NSE, CRYPTO** (350 total tickers).

| Command | Description | Details |
| ------- | ----------- | ------- |
| `/stocks view <exchange>` | View stock exchange listings. | Cooldown: None · Prices update every 30 minutes |
| `/stocks info <ticker>` | Detailed stock metrics & volatility. | Cooldown: None · Shows personal holdings if owned |
| `/stocks buy <ticker> <shares>` | Purchase stock shares. | Cooldown: None · Deducted from wallet balance |
| `/stocks sell <ticker> <shares \| all>` | Sell stock shares. | Cooldown: None · Earned added to wallet balance |
| `/stocks portfolio [user]` | View current stock portfolio. | Cooldown: None · Displays average buy prices and P&L |

---

### Shop & Items

| Command | Description | Details |
| ------- | ----------- | ------- |
| `/shop view [category]` | Browse the shop items. | Cooldown: None · Category filtering dropdown available |
| `/shop buy <item>` | Buy permanent tools or consumables. | Cooldown: None · Tools are one-time purchase |
| `/shop sell <item> [amount]` | Sell gathered loot or items. | Cooldown: None · Added to wallet balance |
| `/inventory [user]` | View owned items, tools, and value. | Cooldown: None · Displays estimated sell value |
| `/lootbox open <tier>` | Open a lootbox from your inventory. | Cooldown: None · Rewards coins, XP, and consumable items |
| `/lootbox tiers` | View all lootbox tiers, drop rates, and potential rewards. | Cooldown: None |

---

### Progression & Stats

| Command | Description | Details |
| ------- | ----------- | ------- |
| `/rank [user]` | Check level, total XP, and progression. | Cooldown: None · View level pay bonuses |

---

## Deployment & Setup

### Requirements
- Node.js (v16.x or higher)
- Supabase account (PostgreSQL Database)
- Discord Bot Token & Application Client ID

### Setup Environment
Create a `.env` file in the root directory:
```env
TOKEN=your_discord_bot_token
CLIENT_ID=your_discord_client_id
GUILD_ID=your_testing_guild_id_here
SUPABASE_URL=your_supabase_project_url
SUPABASE_KEY=your_supabase_anon_or_service_key
```

### Database Initialization
Initialize database tables and run schema/migration SQL scripts in your Supabase SQL editor:
1. Run [schema.sql](file:///Users/ashutoshswamy/Documents/Discord%20Bots/Chill%20Guy/chillguy/supabase/schema.sql)
2. Run all migration scripts in [supabase/migrations/](file:///Users/ashutoshswamy/Documents/Discord%20Bots/Chill%20Guy/chillguy/supabase/migrations) in sequence (`000` to `011`).

### Installation
Install dependencies:
```bash
npm install
```

### Deploy Slash Commands
Deploy application command bindings to Discord:
```bash
# Deploys to the GUILD_ID (for testing) if defined in `.env`, or GLOBALLY if not defined
npm run deploy
```

### Run Bot
Start execution locally:
```bash
npm start
```
