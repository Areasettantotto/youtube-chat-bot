# Guide to Using the YouTube Chat Bot

## 1. Requirements
- Node.js >= 16
- Google OAuth2 credentials (`client_secret.json`)

## 2. Configuration

### `.env` File
Insert the game variables here:
```
PREZZO_GIUSTO=49.99
MAX_TENTATIVI=3
```
### `client_secret.json` File
Download the OAuth2 credentials from the Google Cloud Console and place them in this file. See `client_secret.txt` for detailed instructions.

## 3. Install dependencies

```bash
npm install
```

## 4. Start the bot

```bash
node index.js
```

## 5. Important notes
- Never share the `.env` and `client_secret.json` files publicly.
- Invalid attempts are logged in `logs/tentativi_scartati.log`.
- You can change the game settings without modifying the code, just by updating `.env` and `config.json`.

## 6. Troubleshooting
- If the bot does not start, check that all configuration files are present and correct.
- If you have authentication issues, delete `token.json` and restart the bot to repeat the procedure.
