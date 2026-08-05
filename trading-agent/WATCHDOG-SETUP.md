# Watchdog Routine — one-time setup (owner action)

Claude cannot create/modify Routines from this session (the approval popup doesn't
render — same glitch as during initial setup), so create this one manually in the
claude.ai **Routines** UI, the same way the "auto trader" Routine was created.

## Routine 1 — fix the trading schedule (edit existing "auto trader")

Change the schedule from `0 15 */3 * *` to:

```
0 15 * * 2,5
```

(Tue + Fri 15:00 UTC — always market days, steady ~3–4 day spacing, no month-boundary
drift, no wasted weekend fires.)

## Routine 2 — create the watchdog

- **Name:** `trading agent watchdog`
- **Schedule (cron):** `0 12 * * 3,6` (Wed + Sat 12:00 UTC — the morning after each
  trading fire)
- **Connectors:** Robinhood
- **Notifications:** push ON
- **Prompt:** paste exactly this:

```
You are the WATCHDOG for an autonomous trading agent (you do NOT trade — read-only on the broker; you only verify and repair records). Run one check, then stop.

1. In the family-tree-app repo: git fetch origin claude/autonomous-trading-agent-r1s6y2 and checkout that branch at origin's tip. Read trading-agent/STATUS.md, HEALTH.log, JOURNAL.md (tail), state.json.
2. Robinhood (account <ACCOUNT NUMBER HERE>, READ-ONLY — never place or cancel orders): get_equity_orders for the last 7 days, get_portfolio, get_equity_positions.
3. Verify: (a) every filled broker order from the last 7 days appears in JOURNAL.md; (b) state.json holdings match broker positions; (c) state.json last_run is under ~4 days old; (d) HEALTH.log has no START line without a matching OK line; (e) JOURNAL.md cycle entries are in ascending cycle order; (f) state.json parses as valid JSON.
4. If ALL checks pass: refresh the "Watchdog last check" line in STATUS.md ("Watchdog last check: <UTC date> ✅ all checks passed"), append a line to HEALTH.log (<UTC time> | cycle=- | OK | trades=- | value=$<broker total> | watchdog: all checks passed), commit as Claude <noreply@anthropic.com> with message "Watchdog: all checks passed <date>" and push. Final output: one short line saying all checks passed.
5. If ANY check FAILS: fix what is fixable from broker records — write reconstructed journal entries (clearly marked "RECONSTRUCTED by watchdog from broker records"), correct state.json holdings/cash to match the broker, reorder journal entries if out of order. Set the Alerts row in STATUS.md to describe the problem (⚠️ with one-line explanation). Append an ALERT line to HEALTH.log. Commit ("Watchdog ALERT: <summary>") and push. Final output: start with "ALERT:" and describe in 2-3 plain sentences what was wrong and what you fixed — this text reaches the owner's phone as a push notification.

Never modify anything outside the trading-agent/ folder. Never write the full account number, any personal name, or email into committed files. Commit only as Claude <noreply@anthropic.com>.
```

Replace `<ACCOUNT NUMBER HERE>` with the Agentic account number when pasting (it is
deliberately not written in this repo).

Once both are done, delete this file or leave it as reference.
