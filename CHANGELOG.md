# Changelog

All notable changes to this project will be documented in this file.

## Unreleased
-### 2025-08-22
- Recent commits
- - test(sim): add multi-user exhausted near-end test (fd22f9a)
- - chore: commit all changes to main (7e3eb89)
- - test(sim): add exhausted attempts near-end simulator behavior and Jest test (3051e4a)

### 2025-08-20
- Refactor: centralized attempt validation and handling into `handleUserAttempt` to remove duplicated logic in message processing (working-tree change applied).
- Add Jest test `endgame.no_more_attempts_after_end.test.js` to ensure attempts submitted after `LIVE_DURATION` are ignored by the simulator.

### 2025-08-18
- Update USAGE.md: point to DEVELOPER.md and minor docs polish (commit 1a4e0ee)
- Extract Developer notes to DEVELOPER.md and slim README (commit ca72771)
- Add realistic live simulation Jest test (commit ed271d7)

### 2025-08-17
- Add `prepare_custom_relase.sh` helper (commit d643292)
- Stop periodic announcement controller before winner/end; add tests to prevent regressions (commit 7bf8068)
- Jest test for periodic announcements (commit 03c9d9e)
- Docs: add manual simulator test instructions to README (commit a20dcff)

### 2025-08-16
- Add `withRetry` helper, backoff simulator & Jest tests (commit 4969c1b)

### Earlier
- Various logging, polling, and refactor improvements (see git history for details).

---
_Generated automatically on 2025-08-20._
