# Chill Guy — Discord Economy & Pet Bot

A feature-rich Discord bot with an advanced economy, job system, virtual pets, simulated stock market, and grinding activities.

---

## Commands Reference

### Core & Utility

| Command | Description           | Details                                     |
| ------- | --------------------- | ------------------------------------------- |
| `/ping` | Check bot Latency.    | Cooldown: None                              |
| `/help` | Browse help commands. | Cooldown: None · Dropdown & page pagination |
| `/cooldowns [user]` | Check active action & reward cooldowns. | Cooldown: None |

---

### Economy

**Wallet & Banking**

| Command                     | Description                            | Details                                        |
| --------------------------- | -------------------------------------- | ---------------------------------------------- |
| `/balance [user]`           | Check wallet, bank, and net worth.     | Cooldown: None · Option: user (optional)       |
| `/deposit <amount \| all>`  | Deposit coins into bank safety.        | Cooldown: None · Protects coins from robberies |
| `/withdraw <amount \| all>` | Withdraw coins to wallet for spending. | Cooldown: None                                 |
| `/pay <user> <amount>`      | Send wallet coins to another user.     | Cooldown: None · Action is irreversible        |
| `/gift <coins \| item> <user>` | Gift coins or items to another user. | Cooldown: None · Irreversible               |

**Daily Allowances**

| Command    | Description                                   | Details            |
| ---------- | --------------------------------------------- | ------------------ |
| `/daily`   | Claim daily allowance of 500-1000 coins.      | Cooldown: 24 hours |
| `/weekly`  | Claim weekly allowance of 5000-8000 coins.    | Cooldown: 7 days   |
| `/monthly` | Claim monthly allowance of 25000-40000 coins. | Cooldown: 30 days  |

**Grinding & Begging**

| Command   | Description                                       | Details                                      |
| --------- | ------------------------------------------------- | -------------------------------------------- |
| `/beg`    | Beg for spare change.                             | Cooldown: 45s · Payout: 5-50 coins           |
| `/search` | Search funny locations for loose change or items. | Cooldown: 30s · Payout depends on risk level |

---

### Gambling & Robbing

| Command                               | Description                                         | Details                                                        |
| ------------------------------------- | --------------------------------------------------- | -------------------------------------------------------------- |
| `/coinflip <amount> <heads \| tails>` | Standard 50/50 flip.                                | Cooldown: 15s · Win: 2x bet                                    |
| `/slots <amount>`                     | Spin reels and match symbols.                       | Cooldown: 15s · Win up to 50x bet                              |
| `/blackjack <amount>`                 | Play Blackjack against the dealer.                  | Cooldown: 15s · Win: 2x bet (2.5x blackjack)                   |
| `/roulette <amount> <bet>`            | Bet on colors or specific numbers.                  | Cooldown: 15s · Win: Red/Black (2x), Green (14x), Number (36x) |
| `/higherlower <amount>`               | Guess if the next card is higher/lower.             | Cooldown: 15s · Multiplier climbs up to 30x                    |
| `/crash <amount>`                     | Cash out before the multiplier crashes.             | Cooldown: 15s · Volatility: Extreme                            |
| `/rps <amount>`                       | Classic Rock-Paper-Scissors.                        | Cooldown: 15s · Draw refunds bet                               |
| `/cockfight <amount>`                 | Bet on your active pet rooster.                     | Cooldown: 15s (Rooster recovery: 5m)                           |
| `/horserace <amount> <horse>`         | Bet on 1 of 5 horses.                               | Cooldown: 15s · Win: 2x to 8x (depends on odds)                |
| `/scratchcard [tier]`                 | Match 3 items on a 3x3 grid.                        | Cooldown: 15s · Win up to 20x                                  |
| `/mines <bet> [mines]`                | Play Mines. Reveal safe tiles to multiply your bet. | Cooldown: 15s · Grid size: 4x4                                 |
| `/plinko <amount>`                    | Drop a ball down Plinko board for multipliers.       | Cooldown: 15s · Multipliers: 0.5x to 4.0x                      |
| `/dice <amount> <bet>`                | Bet on a pair of dice sum or odd/even.              | Cooldown: 15s · Payout depends on target odds                  |
| `/hack`                               | Hack a mainframe by matching key sequence.          | Cooldown: 30s · Requires speed & accuracy                      |
| `/scramble`                           | Unscramble a word within 30 seconds.                | Cooldown: 30s · Earn: 150-250 coins                            |
| `/crime`                              | Commit a crime (shoplift, atm, gta, heist).         | Cooldown: 45s · Heavy fines on fail                            |
| `/rob <target>`                       | Attempt to steal from another wallet.               | Cooldown: 10m · Success: 40% (fine on failure)                 |
| `/bankrob <target>`                   | Attempt to rob another user's bank.                | Cooldown: 1h · Success: 15% (fine on failure)                  |
| `/lottery buy <tickets>`              | Buy lottery tickets (100 coins each).               | Cooldown: None · Draw occurs every 24 hours                    |
| `/lottery info`                       | Check current lottery pot, round, and your tickets. | Cooldown: None                                                 |
| `/lottery draw`                       | Draw the lottery winner.                            | Cooldown: Available 24h after last draw                        |

---

### Jobs & Careers

| Command            | Description                                       | Details                                          |
| ------------------ | ------------------------------------------------- | ------------------------------------------------ |
| `/job list`        | Browse all available jobs, ranks, and pay.        | Cooldown: None                                   |
| `/job apply <job>` | Apply for a job path.                             | Cooldown: None · Requires minimum level to apply |
| `/job info`        | Check current job performance and streak details. | Cooldown: None                                   |
| `/job resign`      | Resign from your current career.                  | Cooldown: None · Resets rank progress            |
| `/job prestige`    | Reset job rank for permanent pay multipliers.     | Cooldown: None · Max prestige: 5                 |
| `/work`            | Work your active job shift.                       | Cooldown: 1h · Promotes every 15 shifts          |

---

### Activities & Harvesting

Requires permanent tools bought from the `/shop`.

| Command | Description                          | Required Tool | Details       |
| ------- | ------------------------------------ | ------------- | ------------- |
| `/hunt` | Hunt for game in the wilderness.     | Hunting Rifle | Cooldown: 1h  |
| `/dig`  | Dig for buried treasures.            | Shovel        | Cooldown: 45m |
| `/chop` | Chop down trees for valuable timber. | Axe           | Cooldown: 45m |
| `/mine` | Mine ore veins and rare gems.        | Pickaxe       | Cooldown: 45m |
| `/fish` | Cast a fishing line.                 | Fishing Pole  | Cooldown: 45m |

---

### Pets System

| Command                    | Description                                             | Details                                               |
| -------------------------- | ------------------------------------------------------- | ----------------------------------------------------- |
| `/pet adopt <type> <name>` | Adopt a pet companion.                                  | Cooldown: None · Costs coins · Max pets: 5            |
| `/pet status`              | View active pet hunger, happiness, energy, and health.  | Cooldown: None                                        |
| `/pet feed`                | Restore hunger and health.                              | Cooldown: 1h (cooldown-free with Pet Food item)       |
| `/pet play`                | Boost happiness, uses energy.                           | Cooldown: 30m                                         |
| `/pet list`                | View all owned pets and stats.                          | Cooldown: None · Set active companion via select menu |
| `/pet select <id>`         | Set active companion pet.                               | Cooldown: None                                        |
| `/pet rename <name>`       | Give your active pet a new name.                        | Cooldown: None                                        |
| `/pet evolve`              | Evolve active pet at lvl 10 (Adult) and lvl 25 (Elder). | Cooldown: None                                        |
| `/pet release <id>`        | Release owned pet into wild.                            | Cooldown: None · Action is permanent                  |

---

### Simulated Stock Market

Supported Stock Exchanges: **NYSE, NASDAQ, LSE, TSE, HKEX, NSE, CRYPTO** (350 total tickers).

| Command                                 | Description                          | Details                                              |
| --------------------------------------- | ------------------------------------ | ---------------------------------------------------- |
| `/stocks view <exchange>`               | View stock exchange listings.        | Cooldown: None · Prices update every 30 minutes      |
| `/stocks info <ticker>`                 | Detailed stock metrics & volatility. | Cooldown: None · Shows personal holdings if owned    |
| `/stocks buy <ticker> <shares>`         | Purchase stock shares.               | Cooldown: None · Deducted from wallet balance        |
| `/stocks sell <ticker> <shares \| all>` | Sell stock shares.                   | Cooldown: None · Earned added to wallet balance      |
| `/stocks portfolio [user]`              | View current stock portfolio.        | Cooldown: None · Displays average buy prices and P&L |

---

### Shop & Items

| Command                      | Description                                                | Details                                                  |
| ---------------------------- | ---------------------------------------------------------- | -------------------------------------------------------- |
| `/shop view [category]`      | Browse the shop items.                                     | Cooldown: None · Category filtering dropdown available   |
| `/shop buy <item>`           | Buy permanent tools or consumables.                        | Cooldown: None · Tools are one-time purchase             |
| `/shop sell <item> [amount]` | Sell gathered loot or items.                               | Cooldown: None · Added to wallet balance                 |
| `/craft`                     | Turn raw materials into upgraded items & tools.            | Cooldown: None · Multiple recipes available              |
| `/trade <user>`              | Trade coins and items with another player.                 | Cooldown: None · Requires accept state from both         |
| `/inventory [user]`          | View owned items, tools, and value.                        | Cooldown: None · Displays estimated sell value           |
| `/lootbox open <tier>`       | Open a lootbox from your inventory.                        | Cooldown: None · Rewards coins, XP, and consumable items |
| `/lootbox tiers`             | View all lootbox tiers, drop rates, and potential rewards. | Cooldown: None                                           |

---

### Progression & Stats

| Command        | Description                             | Details                                 |
| -------------- | --------------------------------------- | --------------------------------------- |
| `/profile [user]` | View comprehensive statistics and wallet/bank/rank summary. | Cooldown: None                        |
| `/rank [user]` | Check level, total XP, and progression. | Cooldown: None · View level pay bonuses |
| `/achievements [user]` | Check completed and locked career achievements. | Cooldown: None                        |
| `/streak [user]` | Check daily claim and job work shift streaks. | Cooldown: None                        |
| `/quest`       | View daily quests and rewards progress.  | Cooldown: None · Resets every 24 hours  |
| `/leaderboard [type] [scope]` | View global or server ranking leaderboards. | Cooldown: None · Filter options      |

---
