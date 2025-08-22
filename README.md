# YouTube Chat Bot - Contest Manager

**Copyright (c) 2025 Marco Busato - All Rights Reserved**

An advanced bot for managing contests in YouTube Live Chat, featuring multilingual support, detailed logging, attempt management, automatic announcements, and flexible configuration via `.env` file.

## 🚀 Main Features
- **Contest management with limited attempts**: Each user has a maximum number of attempts to guess the correct price.
- **Automatic chat announcements**:
  - Contest start and end messages
  - Winner announcement (exact or closest)
  - Personalized messages for users who exhaust their attempts
  - Periodic announcement of the last 10 users who have exhausted their attempts (configurable)
- **Multilingual support**: Italian, English, Russian, Chinese, Arabic. All messages are localized.
- **Advanced logging**: All actions and messages are recorded in dedicated log files for analysis and debugging.
- **Automatic OAuth2 token management**: Secure credential handling and automatic renewal.
- **Flexible configuration**: All main parameters are configurable via `.env` file.
- **High traffic management**: Dynamic polling and periodic announcements to maintain order and transparency.
- **Security and ownership**: Proprietary software, copying, distribution, and unauthorized use are strictly prohibited.

## 🌍 Multilingual Support
The bot supports 5 languages for all contest messages:
- 🇮🇹 Italian
- 🇬🇧 English
- 🇷🇺 Russian
- 🇨🇳 Chinese
- 🇸🇦 Arabic

## 🤖 Messages and Disclosure
All messages include the appropriate bot disclosure for each language:
- `🤖 [BOT]` (Italian/English)
- `🤖 [БОТ]` (Russian)
- `🤖 [机器人]` (Chinese)
- `🤖 [بوت]` (Arabic)

## 📝 Logging
- All messages and actions are recorded in dedicated log files:
  - Bot messages
  - Valid attempts
  - Discarded attempts
  - Participants
  - Exhausted attempts announcements
  - Console output
- Logs are useful for analysis, debugging, and auditing.

## ⚙️ Configuration via `.env`
All main parameters are configurable:
- Maximum attempts (`MAX_ATTEMPTS`)
- Contest duration (`LIVE_DURATION`)
- Enable/disable periodic announcements (`PERIODIC_EXHAUSTED_ANNOUNCEMENTS`)
- Periodic announcement interval (`PERIODIC_ANNOUNCEMENT_INTERVAL`)
- Message and log files
- Traffic thresholds for dynamic polling
- Extra discount for the closest guess (`EXTRA_DISCOUNT_FOR_THE_NEAREST`)

## ✅ Running tests

To run the full test suite locally (includes the endgame simulator tests and retry/backoff unit tests):

1. Install dependencies (recommended):

```bash
npm ci
```

2. Run the test suite:

```bash
npm test
# or for quieter output in CI:
npm test --silent
```

Notes:
- Tests are configured to run under Node's experimental VM modules for ESM support. The test script in `package.json` already handles this.
- Ensure the `logs/` directory is writable by the user running the tests; tests write temporary log files into `logs/`.
- If you want to run a single test file, use Jest's path, for example:

```bash
npx jest __tests__/endgame.closest.winner.test.js
```

## 🧪 Manual tests (simulator)

You can run the built-in simulator to test end-of-live behavior locally without connecting to YouTube.

1. Run the simulator with a mock config file (examples in `tests/`):

```bash
node scripts/simulate_endgame.js tests/mock_endgame.json
# or for the CI short scenario:
node scripts/simulate_endgame.js tests/mock_endgame_ci.json
# closest-winner scenario:
node scripts/simulate_endgame.js tests/mock_endgame_closest.json
```

2. Inspect logs produced in the `logs/` folder:

```bash
cat logs/bot_responses.log
cat logs/valid_attempts.log
```

The simulator writes `CONTEST_START`, `✅ Valid attempt`, `EXACT_WINNER`, `CLOSEST_WINNER`, and `NO_MORE_ATTEMPTS` lines depending on the scenario.



## 🔄 Periodic Announcement of Exhausted Users
The bot automatically sends, at regular intervals, a summary message in chat listing the last 10 users who have exhausted their available attempts. This message is configurable and designed for contests with high traffic.

### Example of Periodic Message
```
⚠️ 🤖 [BOT] The following users have exhausted their 3 attempts:
🟢 @Marco Busato
🟢 @OtherUser
🟢 @ThirdUser
Their future attempts will not be considered.
```

## 🛡️ Ownership and License
This software is **PROPRIETARY** and the exclusive intellectual property of **Marco Busato** (GitHub: @Areasettantotto).
- Copying, distribution, modification, and unauthorized use are strictly prohibited.
- Any violation will be prosecuted legally.

## 📧 Contact
For licensing or legal inquiries:
- Email: areasettantotto@icloud.com
- GitHub: [@Areasettantotto](https://github.com/Areasettantotto)

---

**⚠️ VIOLATION WARNING**: Unauthorized use of this software may result in legal action and claims for damages.

For developer and technical notes, see `DEVELOPER.md`.

## Recent changes (2025-08-20 -> 2025-08-22)

- Simulator: `scripts/simulate_endgame.js` now tracks per-user attempts and emits `ATTEMPTS_EXHAUSTED` simulated bot responses when a user exceeds `maxAttempts`. This enables tests and local simulation to reliably assert exhausted-announcement behavior that may occur very close to the live end.
- Tests: added endgame simulator tests:
  - `__tests__/endgame.exhausted_near_end.test.js` — single-user exhausted near the end
  - `__tests__/endgame.multiple_exhausted_near_end.test.js` — multi-user exhaustion in the final seconds
- `CHANGELOG.md` and `DEVELOPER.md` were updated to reflect these changes.

## Notes for slow / legacy client machines

If your client runs on older hardware or has an unstable connection, consider tuning `.env` to improve reliability:

Recommended example for legacy Windows 10 machines:

```properties
API_RETRY_ATTEMPTS=5
API_RETRY_DELAY=1500
MIN_POLLING=3000
MID_POLLING=7000
MAX_POLLING=45000
POLL_ERROR_RETRY=20000
MESSAGE_DELAY=2500
```

Prefer implementing exponential backoff with jitter in `lib/retry.js` rather than relying solely on higher retry counts. After changes, monitor `logs/` for 429/quota errors and retry patterns.

For developer notes and detailed simulator usage see `DEVELOPER.md` and `CHANGELOG.md`.
