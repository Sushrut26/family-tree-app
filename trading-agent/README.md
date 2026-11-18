# Autonomous AI Trading Agent 🤖📈

An experiment: an AI that manages a real (small) stock portfolio **fully
autonomously — no human in the loop.** On a recurring schedule it wakes up, reads
its own journal, analyzes the market, decides what to buy and sell, places the
orders, and writes down what it did and why. Then it goes back to sleep.

The point isn't to make money. The point is to watch **how an AI trades** when left
entirely to its own judgment over a long period.

> **Where this lives:** this `trading-agent/` folder is an isolated experiment living
> inside the `family-tree-app` repo, on the branch
> `claude/autonomous-trading-agent-r1s6y2`. It is completely decoupled from the
> family-tree application — it shares the repo only as a durable, writable home for the
> agent's memory. Nothing here touches the app.

## The setup

| | |
|---|---|
| **Broker** | Robinhood |
| **Account** | "Agentic" account `••••6885` — the only account the agent can touch |
| **Starting capital** | $1,000 cash |
| **What it can trade** | US equities only |
| **What it *can't* do** | No options, margin, shorting, or leverage (disabled on the account — so the most it can ever lose is what it buys) |
| **Cadence** | One decision cycle roughly every 3 days |
| **Human involvement** | None. The AI decides everything. |

## How it works

There is no trading bot in the traditional sense — no strategy code, no API keys in
this repo. The "agent" is Claude itself, driven by three things:

1. **A schedule** — a recurring trigger ("Routine") wakes an AI session every ~3 days
   during US market hours.
2. **This folder as memory** — every cycle the agent reads [`STRATEGY.md`](STRATEGY.md)
   (its standing instructions), [`JOURNAL.md`](JOURNAL.md) (everything it has done so
   far), and [`state.json`](state.json) (current holdings + thesis). Because this
   memory lives in git, the agent remembers itself across sessions.
3. **Live tools** — Robinhood market-data and order tools, plus web research and the
   `finance` analysis skills.

Each cycle follows the loop documented in [`STRATEGY.md`](STRATEGY.md):
**read state → check the market → research → decide → place orders → journal → commit.**

## The rules the AI gives itself

**v3 (2026-10-04)** — aim: beat the S&P 500 after costs. Full rules in
[`STRATEGY.md`](STRATEGY.md); the core of it:

- **Up to 10 researched stocks around a `VOO` core (≥15%).** Unused cash above 5% goes
  into `VOO` — if the agent has no good ideas, it owns the index rather than cash.
- **Rank everything, every cycle.** Holdings and candidates are scored fresh on five
  factors; the trend factor is mechanical (50/200-day moving averages), not self-graded.
- **Swap rule:** a candidate scoring ≥3 points above the weakest holding replaces it
  (max 2 swaps per cycle). This replaced the count and cash bands that froze the agent
  for 12 cycles.
- **Sell rules:** an invalidation trigger fires, or a **stop-loss** (≥12% down *and* below
  a falling 50-day average), or it's swapped out, or it's trimmed above 15%.
- **Guardrails kept** because they have evidence behind them: no chasing >5% intraday
  spikes, spread checks, a specific "why not just own VOO?" answer for every stock, ≤40%
  in any correlated theme, and an automatic retreat into `VOO` if it lags the S&P by
  >8 points over 10 cycles.

## Owner to-dos (things only you can change, in claude.ai → Routines)

1. **Replace the "auto trader" prompt** ([open it](https://claude.ai/code/routines/trig_0197RVvY9HFPZY9S5iLrrLPw)) — it still carries the July rules (15–20 names,
   5–15% cash, $50 buys), which contradict STRATEGY.md every cycle. Replace it with:

   > You are the autonomous trading agent for the small "Agentic" Robinhood account
   > (account number `<ACCOUNT NUMBER>`). Scheduled and unattended — no human in the loop;
   > make every decision yourself. Run exactly ONE cycle, then stop. In the family-tree-app
   > repo, `git fetch origin claude/autonomous-trading-agent-r1s6y2` and check out that
   > branch at origin's tip. Read trading-agent/STRATEGY.md first and follow it exactly —
   > it is the single source of truth for rules, cycle steps and file formats, and it wins
   > any conflict with this prompt. Use that account number in every Robinhood call and
   > never write it into a file. Commit as Claude <noreply@anthropic.com> and push before
   > you stop — an uncommitted cycle is a lost cycle.

2. **Delete the "trading agent watchdog" Routine** ([open it](https://claude.ai/code/routines/trig_016a6NSte2o6jFezS9oC3ub4)). It fires twice a week and reports
   success but has never recorded a check (most likely no repo access). Every cycle now
   runs the same checks itself.
3. **Trim connectors on both Routines to Robinhood only.** They also carry Gmail,
   Gamma, Indeed and Vercel, which an unattended trading agent doesn't need — Gmail in
   particular is a needless risk.

## Watching along

- **[`STATUS.md`](STATUS.md) — start here.** A one-page dashboard the agent rewrites
  every cycle: account value, vs-SPY, last/next run, recent runs, and any alerts.
  Bookmark it on GitHub — the web view always shows the latest push.
- [`JOURNAL.md`](JOURNAL.md) — the running log of every cycle, in plain English.
- [`HEALTH.log`](HEALTH.log) — one line per run; a quick way to spot a died-mid-run
  cycle (`START` line with no matching `OK`).
- The git history of this branch — every cycle is a heartbeat commit + a result commit.
- A **watchdog Routine** independently cross-checks broker records against the journal
  after trading days and raises alerts in `STATUS.md` if anything is off.

> If checking from a local clone, run `git fetch` first — a stale clone can make a
> perfectly healthy agent look dead.

## Stopping it

This runs unattended until stopped. To stop:
- Tell Claude **"stop trading"**, or
- Delete the recurring Routine (`delete_trigger`), or
- In Robinhood, revoke the Agentic account's agent access.

## ⚠️ Disclaimer

This is a personal experiment with money the owner is fully prepared to lose. An AI
has **no proven edge** in public markets; over a long horizon this portfolio may well
**bleed value** to bid/ask spreads and the general difficulty of beating the market.
Nothing here is investment advice, a recommendation, or a strategy anyone should copy.
It is a curiosity project about autonomous-agent behavior.

Since 2026-08-14 the portfolio is deliberately **concentrated**, which raises
**variance, not expected return** — it is what makes beating the index possible and
equally what makes badly lagging it possible. Most professional managers with far
greater resources fail to beat the index over time. The change makes the experiment
actually *test* stock-picking; it does not create an edge.
