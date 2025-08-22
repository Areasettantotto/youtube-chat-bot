# Messages Configuration

This folder contains all the message files for different languages used by the YouTube Chat Bot.

## Structure

```
messages/
├── index.json                  # Languages configuration and metadata
├── messages.json              # English (default)
├── messages-italian.json      # Italian
├── messages-russian.json      # Russian
├── messages-cinese.json       # Chinese
└── messages-arabo.json        # Arabic
```

## How to use

### Change language
1. Edit the `.env` file in the root directory
2. Update the `MESSAGES_FILE` variable:
   ```env
   MESSAGES_FILE=messages/messages-italian.json
   ```
3. Restart the bot

### Available languages
- 🇬🇧 English: `messages/messages.json`
- 🇮🇹 Italian: `messages/messages-italian.json`
- 🇷🇺 Russian: `messages/messages-russian.json`
- 🇨🇳 Chinese: `messages/messages-cinese.json`
- 🇸🇦 Arabic: `messages/messages-arabo.json`

### Add a new language
1. Copy `messages.json` to `messages-{language}.json`
2. Translate all messages keeping the `{placeholders}` intact
3. Update `index.json` to include the new language
4. Set `MESSAGES_FILE=messages/messages-{language}.json` in `.env`

## Message placeholders

All messages support these placeholders:
- `{LIVE_DURATION_MINUTES}` - Live stream duration
- `{MAX_ATTEMPTS}` - Maximum attempts per user
- `{author}` - Username of participant
- `{user}` - Username of winner/participant
- `{lastAttempt}` - Last exhausted attempt value
- `{CORRECT_PRICE}` - Correct price to guess
- `{value}` - Price value guessed by user
- `{extraDiscount}` - Extra discount percentage
- `{minute}` - Minute when attempt was made

## Fallback system

1. **Primary**: Load file specified in `MESSAGES_FILE`
2. **Fallback**: Load `messages/messages.json` (English)
3. **Last resort**: Use hard-coded English messages

This ensures the bot always works even if message files are missing.
