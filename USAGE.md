# YouTube Chat Bot - Usage Guide

**Copyright (c) 2025 Marco Busato - All Rights Reserved**

Complete setup and usage instructions for the YouTube Live Chat Contest Bot.

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [Initial Setup](#initial-setup)
3. [Configuration](#configuration)
4. [Running the Bot](#running-the-bot)
5. [Contest Management](#contest-management)
6. [Multilingual Support](#multilingual-support)
7. [Logging System](#logging-system)
8. [Troubleshooting](#troubleshooting)

## 🔧 Prerequisites

### Required Software
- **Node.js** (v18+ recommended)
- **npm** (comes with Node.js)
- **YouTube Channel** with live streaming enabled
- **Google Cloud Console** account

### Required Files
- `client_secret.json` (from Google Console)
- `token.json` (generated during first run)
- `.env` (copied from `.env.example`)

## 🚀 Initial Setup

### 1. Clone and Install
```bash
git clone https://github.com/Areasettantotto/youtube-chat-bot
cd youtube-chat-bot
npm install
```

### 2. Google API Setup
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable **YouTube Data API v3**
4. Create **OAuth 2.0 Client ID** credentials
5. Download credentials as `client_secret.json`
6. Place file in project root directory

### 3. Environment Configuration
```bash
# Copy example configuration
cp .env.example .env

# Edit .env with your settings
nano .env
```

## ⚙️ Configuration

### Basic Settings
```env
# Contest configuration
CORRECT_PRICE=60.56              # Target price for the contest
MAX_ATTEMPTS=3                   # Maximum attempts per user
LIVE_DURATION=20                 # Contest duration in minutes
EXTRA_DISCOUNT_FOR_THE_NEAREST=true  # Award closest guess if no exact winner

# Logging
ENABLE_LOGS=true                 # Enable/disable logging system
LOGS_DIR=logs                    # Directory for log files
```

### Language Selection
```env
# Choose your language file
MESSAGES_FILE=messages/messages.json           # 🇬🇧 English
MESSAGES_FILE=messages/messages-italian.json   # 🇮🇹 Italian
MESSAGES_FILE=messages/messages-russian.json   # 🇷🇺 Russian
MESSAGES_FILE=messages/messages-cinese.json    # 🇨🇳 Chinese
MESSAGES_FILE=messages/messages-arabo.json     # 🇸🇦 Arabic
```

### Extra Discount Thresholds
Configure time-based discount percentages:

```env
# Example: 3 time periods with different discounts
EXTRADISCOUNT_THRESHOLDS=[{"min":0,"max":5,"discount":80},{"min":6,"max":15,"discount":70},{"min":16,"max":"LIVE_DURATION_MINUTES","discount":60}]

# Example: 2 time periods
EXTRADISCOUNT_THRESHOLDS=[{"min":0,"max":10,"discount":85},{"min":11,"max":"LIVE_DURATION_MINUTES","discount":65}]
```

**Time Period Examples:**
- Minutes 0-5: 80% discount
- Minutes 6-15: 70% discount
- Minutes 16-20: 60% discount

### Advanced Configuration
```env
# API Polling (milliseconds)
MIN_POLLING=5000                 # Fast polling (high traffic)
MID_POLLING=10000               # Medium polling
MAX_POLLING=30000               # Slow polling (low traffic)
MESSAGE_DELAY=2000              # Delay between bot messages
POLL_ERROR_RETRY=10000          # Retry delay on API errors

# Traffic Thresholds for Dynamic Polling
HIGH_TRAFFIC_THRESHOLD=10       # Messages count for high traffic detection
MEDIUM_TRAFFIC_THRESHOLD=2      # Messages count for medium traffic detection

# Log Files (optional customization)
DISCARDS_LOG_FILENAME=discarded_attempts.log
LOG_ATTEMPTS_SUCCESS_FILENAME=valid_attempts.log
ERROR_STARTING_LOG_FILENAME=startup_errors.json
ATTEMPTS_EXHAUSTED_LOG_FILENAME=exhausted_attempts.log
PARTICIPANTS_LOG_FILENAME=participants.log
```

## 🎮 Running the Bot

### First Run (Authorization)
```bash
node index.js
```

1. Bot will open browser for Google authorization
2. Sign in with your YouTube channel account
3. Grant permissions to the bot
4. Copy authorization code back to terminal
5. `token.json` will be saved automatically

### Normal Operation
```bash
node index.js
```

**Expected Output:**
```
📋 Loaded languages config: 5 languages available
🌍 Loaded messages: Italiano (messages/messages-italian.json)
⚙️ Loaded 3 custom discount thresholds from .env
📁 Directory logs created automatically
🚀 Listening to chat...
🟢 Contest started, from now you have 20 minutes and 3 attempts to get extraordinary extra discounts!!
```

## 🏆 Contest Management

### Contest Flow
1. **Start**: Bot announces contest start in chat
2. **Monitoring**: Bot tracks all numeric messages
3. **Validation**: Only valid numbers are accepted
4. **Attempt Tracking**: Users limited to MAX_ATTEMPTS
5. **Time Management**: Contest runs for LIVE_DURATION minutes
6. **Winner Detection**: Exact price match wins immediately
7. **End Game**: Closest guess wins if no exact match

### User Experience
- Users submit numeric guesses in chat
- Invalid formats are logged but ignored
- Users get notified when exceeding max attempts
- Winner gets personalized congratulations message
- Time-based discount percentage announced

### Bot Messages
All messages include `🤖 [BOT]` disclosure for transparency and YouTube compliance.

## 🌍 Multilingual Support

### Available Languages
- **🇬🇧 English** (`messages/messages.json`)
- **🇮🇹 Italian** (`messages/messages-italian.json`)
- **🇷🇺 Russian** (`messages/messages-russian.json`)
- **🇨🇳 Chinese** (`messages/messages-cinese.json`)
- **🇸🇦 Arabic** (`messages/messages-arabo.json`)

### Language Configuration
The bot automatically detects selected language and displays:
```
🌍 Loaded messages: Italiano (messages/messages-italian.json)
```

### Bot Disclosure by Language
- English/Italian: `🤖 [BOT]`
- Russian: `🤖 [БОТ]`
- Chinese: `🤖 [机器人]`
- Arabic: `🤖 [بوت]`

## 📊 Logging System

### Log Files (when `ENABLE_LOGS=true`)
- **`participants.log`** - New unique participants
- **`valid_attempts.log`** - Successful attempts and winners
- **`discarded_attempts.log`** - Invalid attempts and reasons
- **`exhausted_attempts.log`** - Users exceeding max attempts
- **`startup_errors.json`** - Bot startup issues

### Log Format
```
[2025-07-24T15:30:45.123Z] ✅ Valid attempt User123: "60.50"
[2025-07-24T15:30:50.456Z] NEW PARTICIPANT: User456 (Total: 15)
[2025-07-24T15:31:00.789Z] EXACT WINNER: User123 with €60.56 - Extra discount: 80% - Minute: 1
```

### Disable Logging
```env
ENABLE_LOGS=false
```

## 🔄 Periodic Announcement of Exhausted Users

The bot automatically sends, at regular intervals, a summary message in chat listing the last 10 users who have exhausted their available attempts. This message is repeated every X seconds (configurable) and helps maintain transparency and order during high-traffic contests.

### Configuration via `.env`
- `PERIODIC_EXHAUSTED_ANNOUNCEMENTS=true`
  Enable/disable the periodic announcement feature (true/false)
- `PERIODIC_ANNOUNCEMENT_INTERVAL=45`
  Interval (in seconds) between announcements

### Example of Periodic Message
```
⚠️ 🤖 [BOT] The following users have exhausted their 3 attempts:
🟢 @Marco Busato
🟢 @OtherUser
🟢 @ThirdUser
Their future attempts will not be considered.
```

### Notes
- All parameters are configurable via `.env`
- The list always shows the last 10 users who have exhausted their attempts
- The feature is designed for high-traffic contests
- Periodic messages are recurring and do not affect bot performance

## 🔍 Troubleshooting

### Common Issues

#### "No active live stream found"
- **Solution**: Start a live stream on your YouTube channel before running the bot
- **Check**: Stream must be live (not scheduled or ended)

#### "Error reading client_secret.json"
- **Solution**: Ensure file exists in project root
- **Check**: File downloaded from Google Console correctly

#### "Invalid EXTRADISCOUNT_THRESHOLDS format"
- **Solution**: Verify JSON syntax in `.env` file
- **Example**: `[{"min":0,"max":10,"discount":80}]`

#### "Error retrieving live stream"
- **Solution**: Check YouTube Data API quota and permissions
- **Verify**: Google Cloud Console project has YouTube Data API v3 enabled

### Debug Mode
Add detailed logging for troubleshooting:
```env
ENABLE_LOGS=true
MIN_POLLING=3000  # Faster polling for testing
```

### API Limits
- **YouTube Data API**: 10,000 units/day (default)
- **Live Chat Messages**: ~1 unit per request
- **Monitor usage** in Google Cloud Console

### Token Refresh
If authentication fails:
1. Delete `token.json`
2. Run bot again
3. Re-authorize when prompted

## 📞 Support

For technical issues or questions:
- **Email**: areasettantotto@icloud.com
- **GitHub**: [@Areasettantotto](https://github.com/Areasettantotto)

---

**⚠️ Important**: This software is proprietary. See [LICENSE](LICENSE) for terms and conditions.

## 🔧 Developer Notes (quick)

- Tests & ESM
  - Tests run under ESM using Node's experimental VM modules. Use the repo's `npm test` script which already sets the required flags.

- Simulator API
  - `scripts/simulate_endgame.js` exports `runSimulationFromConfig(config, options)` and also works as a CLI (`node scripts/simulate_endgame.js tests/mock_endgame.json`).

- Helper script: `prepare_custom_release.sh`
  - Creates a client-ready folder with required files (default `~/Desktop/bot`). Useful for secure transfers via TeamViewer.

- Important runtime guarantees
  - `MIN_POLLING` is clamped to at least 2000ms.
  - `FINAL_ACCEPT_MS` accepts final messages during the last 100ms of the live to avoid missed last-second guesses.

- Internal libraries
  - `lib/retry.js` provides `withRetry(...)` using exponential backoff.
  - `lib/periodicAnnouncements.js` provides a controller from `startPeriodicAnnouncements(...)` with a `.stop()` method that is invoked before announcing winners to avoid race conditions.

- Running in background
  - Use `pm2 start index.js --name youtube-bot` or `nohup node index.js > logs/console_output.log 2>&1 &`.

## Recent changes (2025-08-20 -> 2025-08-22)

- Simulator: `scripts/simulate_endgame.js` now emits `ATTEMPTS_EXHAUSTED` simulated bot responses when a simulated user exceeds `maxAttempts`. This helps validate last-second exhausted announcements in tests.
- Tests: see `__tests__/endgame.exhausted_near_end.test.js` and `__tests__/endgame.multiple_exhausted_near_end.test.js` for examples.

## Notes for slow / legacy client machines

If deploying to an older Windows 10 machine, consider tuning the `.env` values to reduce false negatives from transient network errors and race conditions. Recommended adjustments include:

```properties
API_RETRY_ATTEMPTS=5
API_RETRY_DELAY=1500
MIN_POLLING=3000
MID_POLLING=7000
MAX_POLLING=45000
POLL_ERROR_RETRY=20000
MESSAGE_DELAY=2500
```

After applying changes, run the simulator and monitor logs under `logs/` to verify behavior.
