# Developer / Technical Notes

This document extracts the developer-focused details from `README.md` so the main README stays slim.

## Node / ESM / Jest
- The project uses ES modules (`"type": "module"` in `package.json`).
- Jest runs using Node's experimental VM modules; use the included `npm test` script (it already sets the required flags).

## Simulator (`scripts/simulate_endgame.js`)
- Exported function: `runSimulationFromConfig(config, { silent })`.
- CLI usage: `node scripts/simulate_endgame.js tests/mock_endgame.json`.
- Use `tests/mock_many_users.json` to reproduce big loads and last-second exact guesses.

## Helpers
- `lib/retry.js` — `withRetry(actionFn, { maxRetries, baseDelay, onRetry })` (exponential backoff helper used for API calls and chat sends).
- `lib/periodicAnnouncements.js` — `startPeriodicAnnouncements(options)` returns controller with `.stop()` used to safely stop periodic announcements before endgame.

## Env validation & runtime guarantees
- `MIN_POLLING` enforced to >= 2000ms to respect YouTube constraints.
- `FINAL_ACCEPT_MS` is used to accept last messages (default 100ms) and avoid lost last-second guesses.
- Use lowercase `true`/`false` for boolean envs; `validateBooleanEnv()` warns otherwise.

## Logs
- When `ENABLE_LOGS=true`, logs are written to `logs/` (see `USAGE.md` for file names).

## OAuth token
- First run: `node index.js` → follow OAuth flow → `token.json` created. Delete `token.json` to re-authorize.

## Release helper
- `prepare_custom_release.sh` copies a minimal set of files to a target dir (default `~/Desktop/bot`) for client delivery.

## Runtime tips and troubleshooting
- Ensure the `logs/` directory is writable by the user running the bot.
- If you see `MODULE_NOT_FOUND` for `lib/retry.js` in a release copy, include the `lib/` directory in the release package.
- To reproduce the endgame race locally, run the simulator with `tests/mock_many_users.json` and inspect `logs/bot_responses.log`.

## Recent changes (2025-08-20 -> 2025-08-22)

- Simulator: `scripts/simulate_endgame.js` now tracks per-user attempts during simulations and emits `ATTEMPTS_EXHAUSTED` simulated bot responses when a user exceeds `maxAttempts`. This enables tests to assert exhausted announcements that happen near the live end.
- Tests: added `__tests__/endgame.exhausted_near_end.test.js` (single-user near-end exhaustion) and `__tests__/endgame.multiple_exhausted_near_end.test.js` (multi-user exhaustion in final seconds).
- Developer note: small chore commit consolidated uncommitted changes and the `CHANGELOG.md` was updated accordingly.

## Notes for slow / legacy client machines

- Recommended `.env` adjustments for unstable or slow clients: increase `API_RETRY_ATTEMPTS` to 5, `API_RETRY_DELAY` to 1500ms, and raise `MIN_POLLING`/`MID_POLLING`/`MAX_POLLING` to 3000/7000/45000 respectively. Prefer exponential backoff with jitter in `lib/retry.js` rather than only raising attempts.
- Monitoring: after changing values, inspect `logs/` for increased 429/quota errors and for retry counts.

## Useful commands

Run tests:

```bash
npm ci
npm test
```

Run simulator:

```bash
node scripts/simulate_endgame.js tests/mock_endgame.json
node scripts/simulate_endgame.js tests/mock_many_users.json
```

Prepare a release copy (helper script):

```bash
./prepare_custom_release.sh
```
