# 📊 STATUS — at-a-glance dashboard

> Bookmark this file on GitHub to check on the agent from anywhere:
> `github.com/Sushrut26/family-tree-app/blob/claude/autonomous-trading-agent-r1s6y2/trading-agent/STATUS.md`
> The agent rewrites this file every cycle. **GitHub always shows the latest push** —
> no stale-clone problem like a local checkout has.

## Current state

| | |
|---|---|
| **Last completed cycle** | 14 — 2026-08-18 (deployed settled cash: 6 buys, 2 new names) |
| **Account value** | $1,024.30 (as of 2026-08-18 ~11:14 ET) |
| **Cash** | $35.01 (~3.4% — inside the 2-5% target band; the Cycle 13 T+1 proceeds fully settled and were deployed this cycle) |
| **Positions** | 13 (VOO core + 12 single names — added `AMT` + `UNP`, topped up `VOO`/`MSFT`/`AMZN`/`NVDA`) |
| **vs SPY since inception** | portfolio +2.43% vs SPY +2.22% (as of 2026-08-18) — +0.21pt gap, safety valve not tripped |
| **Realized P&L (all-time)** | +$6.84 (8 closed trades; unchanged this cycle — no sells) |
| **Next scheduled run** | per cron `0 15 */3 * *` (drifts month-to-month; see Known quirks) |
| **Strategy** | Moderately aggressive, research-driven (changed 2026-08-14). Target: **8–10 single names + a `VOO` core (15–20%)**, ~9–11% per name, cash 2–5%, correlated-theme cap 40%. Every holding must justify itself against just buying `VOO`. |
| **Alerts** | ℹ️ **Restructure deployment complete** — Cycle 14 finished deploying the Cycle-13 sale proceeds: bought `UNP` (new, 22/25) and `AMT` (new, 19/25, the confirmed-breakout name), topped up `VOO`/`MSFT`/`AMZN`/`NVDA`. Now 13 positions (one over the 8-10 single-name band — will normalize via ordinary trims, not forced). AI/cloud theme at 32.1% (under the 40% cap but climbing — favor other names next cycle). |

## Health check — how to tell it's alive

1. **This file's "last completed cycle" date** should never be more than ~4 days old
   (weekend cycles still update it — the agent runs and reconciles even when the
   market is closed).
2. **`HEALTH.log`** — one line per run. A missing line for a scheduled fire, or a
   `START` line with no matching `OK`, means a run died mid-way.
3. **Git history of this branch** — every cycle ends in a commit named `Cycle N: …`.
4. **Robinhood app** → Agentic account (••••6885) → order history. Every order the
   agent places is tagged as agent-placed on Robinhood's side.

⚠️ **If checking from a local clone: `git fetch` first.** A stale local clone falsely
looks like the agent stopped (this exact false alarm happened 2026-08-05).

## Recent runs

| Date (UTC) | Cycle | Result |
|---|---|---|
| 2026-08-18 | 14 | ✅ Deployed settled cash: bought `UNP` (new, 22/25) + `AMT` (new, 19/25), topped up `VOO`/`MSFT`/`AMZN`/`NVDA`. 11→13 positions, cash to 3.4%. |
| 2026-08-14 | 13 | ✅ Restructure: sold `SCHD`/`XLI`/`XLV`/`VXUS`/`IJR`/`JPM`/`COST` (7), bought `VOO` top-up + new `V` position (2). 17→11 positions. `AMT` confirmed SMA breakout. |
| 2026-08-11 | 12 | ✅ No trades — cash near top of band; LIN fundamentals strengthened (record backlog, raised guide) but still below 50-day SMA; AMT/CAT unchanged, no re-entry |
| 2026-08-07 | 11 | ✅ No trades — cash in band; LIN/AMT still below 50-day SMA; CAT's earnings spike fully faded, still no re-entry |
| 2026-08-04 | 10 | ✅ No trades — cash in band; CAT re-buy rejected (>5% same-day spike); LIN add rejected (trend 1/5) |
| 2026-08-01 | 9 | ✅ Market closed (Sat) — reconciled clean |
| 2026-07-31 | 8 | ✅ Bought XLI + XLV ($50 each); completed invalidation/earnings migration |

## What changed on 2026-08-14 (and why)

A review found the agent had quietly become a **closet index fund**: 17 positions, six
of them ETFs that duplicated `VOO` and each other, eleven single names all already
inside `VOO`, and ~39% of the account (14% idle cash + ~$253 of duplicate ETFs)
expressing no research view. It returned +2.81% vs SPY's +2.89% — tracking the index
and losing to it slightly — and hadn't traded in four cycles.

The cause was a self-contradicting brief: "maximize long-term profit" paired with
rules that mandated becoming the index. The owner chose a concentrated,
research-driven strategy instead. Key changes:

- **Fewer, bigger positions** — 9–11 total instead of 17, ~$100 each instead of ~$50,
  so research can actually move the result.
- **One ETF only.** `VOO` as a real 15–20% ballast core; no more sector/style ETFs
  that duplicate it.
- **Cash to work** — target 2–5%, down from 5–15%.
- **The beat-the-index test** — every holding must answer "why is this better than
  the same dollars in `VOO`?" or be sold.
- **Wider research funnel** — ≥2 brand-new candidates screened every cycle, using
  saved scanners. The old no-trade stretch came from re-checking three stale names,
  not from too high a bar.
- **The quality bar and the >5% no-chase rule were deliberately left alone** — both
  have evidence they work.
- **New safety valve** — if the portfolio lags SPY by >8 points over 10 cycles, half
  the active book rotates back into `VOO` automatically.

Trade-off worth understanding: concentration raises **variance**, not expected return.
It's what makes beating the index possible, and equally what makes lagging it badly
possible.

## Known quirks

- **Cron `*/3` resets every month** — fires drift (Jul 28 → Jul 31 → Aug 1 → Aug 4)
  and land on weekends. Weekend fires are harmless (agent reconciles, defers trades).
  Recommended fix (owner action, in the claude.ai Routines UI): change the schedule to
  `0 15 * * 2,5` (Tue + Fri, 15:00 UTC) — always market days, steady ~3–4 day spacing.
