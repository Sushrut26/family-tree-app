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

Full discretion on *what* to trade, inside a **moderately aggressive, research-driven**
mandate (set 2026-08-14, replacing the original broad-diversification rules):

- **Concentrate** — 8–10 researched single names plus a `VOO` core, ~9–11% each.
  Fewer, better bets rather than a basket of everything.
- **Keep a `VOO` ballast core at 15–20%** — the anchor that keeps this *moderately*
  rather than fully aggressive.
- **Every dollar expresses a view** — each holding must answer "why is owning this
  better than the same dollars in `VOO`?" or get sold. Cash target just 2–5%.
- **Screen widely, buy rarely** — ≥2 brand-new candidates researched every cycle, but
  a high bar to actually buy (≥18/25 on a five-factor score).
- **Guardrails stay** — no single name over ~15%, no correlated theme over ~40%, and
  an automatic rotation back into `VOO` if it lags the S&P by more than 8 points over
  10 cycles.

*Why it changed:* by Cycle 12 the portfolio had drifted into 17 positions — six of
them overlapping ETFs — and was effectively an index fund with 14% idle cash. See
[`STATUS.md`](STATUS.md) for the full diagnosis.

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
