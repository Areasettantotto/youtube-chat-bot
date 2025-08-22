/*
 * YouTube Chat Bot - Contest Manager
 * Copyright (c) 2025 Marco Busato (GitHub: areasettantotto)
 * All Rights Reserved - Proprietary Software
 *
 * This software is the exclusive property of Marco Busato.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 * See LICENSE file for full terms and conditions.
 */

import fs from 'fs';
import { google } from 'googleapis';
import dotenv from 'dotenv';
import { withRetry } from './lib/retry.js';

dotenv.config();

// Boolean validation helper function
function validateBooleanEnv(envVar, varName, defaultValue = false) {
  const value = process.env[envVar];
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (value && value !== 'true' && value !== 'false') {
    console.warn(`⚠️  WARNING: ${varName} has invalid value "${value}". Use "true" or "false" (lowercase). Defaulting to ${defaultValue}.`);
  }
  return defaultValue;
}

// Enable/disable logging - MUST be declared early
const ENABLE_LOGS = validateBooleanEnv('ENABLE_LOGS', 'ENABLE_LOGS', false);

// Ensure the environment variables are set
const LOGS_DIR = process.env.LOGS_DIR || 'logs';

// Log filenames with defaults
const DISCARDS_LOG_FILENAME = process.env.DISCARDS_LOG_FILENAME || 'discarded_attempts.log';
const LOG_ATTEMPTS_SUCCESS_FILENAME = process.env.LOG_ATTEMPTS_SUCCESS_FILENAME || 'valid_attempts.log';
const ERROR_STARTING_LOG_FILENAME = process.env.ERROR_STARTING_LOG_FILENAME || 'startup_errors.json';
const ATTEMPTS_EXHAUSTED_LOG_FILENAME = process.env.ATTEMPTS_EXHAUSTED_LOG_FILENAME || 'exhausted_attempts.log';
const PARTICIPANTS_LOG_FILENAME = process.env.PARTICIPANTS_LOG_FILENAME || 'participants.log';
const BOT_RESPONSES_LOG_FILENAME = process.env.BOT_RESPONSES_LOG_FILENAME || 'bot_responses.log';
const CONSOLE_OUTPUT_LOG_FILENAME = process.env.CONSOLE_OUTPUT_LOG_FILENAME || 'console_output.log';

// Construct full log file paths directly
const DISCARDS_LOG_FILE = `${LOGS_DIR}/${DISCARDS_LOG_FILENAME}`;
const LOG_ATTEMPTS_SUCCESS_FILE = `${LOGS_DIR}/${LOG_ATTEMPTS_SUCCESS_FILENAME}`;
const ERROR_STARTING_LOG_FILE = `${LOGS_DIR}/${ERROR_STARTING_LOG_FILENAME}`;
const ATTEMPTS_EXHAUSTED_LOG_FILE = `${LOGS_DIR}/${ATTEMPTS_EXHAUSTED_LOG_FILENAME}`;
const PARTICIPANTS_LOG_FILE = `${LOGS_DIR}/${PARTICIPANTS_LOG_FILENAME}`;
const BOT_RESPONSES_LOG_FILE = `${LOGS_DIR}/${BOT_RESPONSES_LOG_FILENAME}`;
const CONSOLE_OUTPUT_LOG_FILE = `${LOGS_DIR}/${CONSOLE_OUTPUT_LOG_FILENAME}`;

// Ensure logs directory exists
if (ENABLE_LOGS && !fs.existsSync(LOGS_DIR)) {
  fs.mkdirSync(LOGS_DIR, { recursive: true });
  console.log(`📁 Directory ${LOGS_DIR} created automatically`);
}

// Centralized logging system with file output redirection
const originalConsoleLog = console.log;
const originalConsoleWarn = console.warn;
const originalConsoleError = console.error;

// Function to write to console output log
function writeToConsoleLog(message) {
  if (ENABLE_LOGS) {
    const timestamp = new Date().toISOString();
    fs.appendFileSync(CONSOLE_OUTPUT_LOG_FILE, `[${timestamp}] ${message}\n`);
  }
}

// Function to write bot responses to dedicated log
function writeBotResponse(message, context = '') {
  if (ENABLE_LOGS) {
    const timestamp = new Date().toISOString();
    const logEntry = context ? `[${timestamp}] ${context}: ${message}\n` : `[${timestamp}] ${message}\n`;
    fs.appendFileSync(BOT_RESPONSES_LOG_FILE, logEntry);
  }
}

const log = {
  info: (msg) => {
    const message = `ℹ️  ${msg}`;
    originalConsoleLog(message);
    writeToConsoleLog(message);
  },
  warn: (msg) => {
    const message = `⚠️  ${msg}`;
    originalConsoleWarn(message);
    writeToConsoleLog(message);
  },
  error: (msg) => {
    const message = `❌ ${msg}`;
    originalConsoleError(message);
    writeToConsoleLog(message);
  },
  success: (msg) => {
    const message = `✅ ${msg}`;
    originalConsoleLog(message);
    writeToConsoleLog(message);
  },
  debug: (msg) => {
    const message = `🔍 ${msg}`;
    originalConsoleLog(message);
    writeToConsoleLog(message);
  },
  token: (msg) => {
    const message = `🔑 ${msg}`;
    originalConsoleLog(message);
    writeToConsoleLog(message);
  },
  contest: (msg) => {
    const message = `🎯 ${msg}`;
    originalConsoleLog(message);
    writeToConsoleLog(message);
  },
  config: (msg) => {
    const message = `⚙️  ${msg}`;
    originalConsoleLog(message);
    writeToConsoleLog(message);
  },
  file: (msg) => {
    const message = `📁 ${msg}`;
    originalConsoleLog(message);
    writeToConsoleLog(message);
  },
  lang: (msg) => {
    const message = `🌍 ${msg}`;
    originalConsoleLog(message);
    writeToConsoleLog(message);
  },
  participant: (msg) => {
    const message = `👤 ${msg}`;
    originalConsoleLog(message);
    writeToConsoleLog(message);
  },
  timer: (msg) => {
    const message = `⏰ ${msg}`;
    originalConsoleLog(message);
    writeToConsoleLog(message);
  },
  shutdown: (msg) => {
    const message = `🏁 ${msg}`;
    originalConsoleLog(message);
    writeToConsoleLog(message);
  },
  api: (msg) => {
    const message = `🚀 ${msg}`;
    originalConsoleLog(message);
    writeToConsoleLog(message);
  },
};

// Load user messages from external JSON file
const MESSAGES_FILE = process.env.MESSAGES_FILE || 'messages/messages.json';
const MESSAGES_INDEX_FILE = 'messages/index.json';
let MESSAGES = {};
let LANGUAGES_CONFIG = {};

// Load languages configuration
try {
  LANGUAGES_CONFIG = JSON.parse(fs.readFileSync(MESSAGES_INDEX_FILE, 'utf8'));
  log.config(`Loaded languages config: ${Object.keys(LANGUAGES_CONFIG.available_languages).length} languages available`);
} catch (err) {
  log.warn(`Warning: Could not load languages config from ${MESSAGES_INDEX_FILE}: ${err.message}`);
}

// Load messages--
try {
  MESSAGES = JSON.parse(fs.readFileSync(MESSAGES_FILE, 'utf8'));
  const selectedLang = Object.values(LANGUAGES_CONFIG.available_languages || {})
    .find(lang => MESSAGES_FILE.includes(lang.file))?.name || 'Unknown';
  log.lang(`Loaded messages: ${selectedLang} (${MESSAGES_FILE})`);
} catch (err) {
  log.error(`Error loading messages file ${MESSAGES_FILE}: ${err.message}`);
  log.error('Using default English messages as fallback');

  // Fallback to default English messages
  const fallbackFile = 'messages/messages.json';
  try {
    MESSAGES = JSON.parse(fs.readFileSync(fallbackFile, 'utf8'));
    log.success(`Loaded fallback messages from ${fallbackFile}`);
  } catch (fallbackErr) {
    log.error(`Could not load fallback messages: ${fallbackErr.message}`);
    // Hard-coded fallback as last resort
    MESSAGES = {
      contest: {
        start: "🤖 [BOT] 🟢 Contest started, from now you have {LIVE_DURATION_MINUTES} minutes and {MAX_ATTEMPTS} attempts to get extraordinary extra discounts!!",
        attemptsExhausted: "⛔ 🤖 [BOT] {author}, you have exceeded the maximum number of {MAX_ATTEMPTS} available attempts. Your last attempt {lastAttempt} (and subsequent ones) will not be considered valid.",
        periodicExhaustedAnnouncement: "⚠️ 🤖 [BOT] The following users have exhausted their {MAX_ATTEMPTS} attempts: {usersList} (and {remainingCount} more). Their future attempts will not be considered.",
        periodicExhaustedAnnouncementSimple: "⚠️ 🤖 [BOT] The following users have exhausted their {MAX_ATTEMPTS} attempts: {usersList}. Their future attempts will not be considered.",
        timeExpiredClosestWinner: "⏰ Time is up and {user} got closest to the correct price — €{CORRECT_PRICE} — with an offer of €{value}! Well done! You earned an extra discount of {extraDiscount}% 🎁 (Attempt at minute {minute})",
        timeExpiredNoParticipants: "⏰ Time expired! The correct price was €{CORRECT_PRICE}. Nobody participated in the contest!",
        timeExpiredNoWinner: "⏰ Time expired! No winner this time!",
        exactWinner: "🎉 Congratulations {author}! You guessed the exact discounted price: €{CORRECT_PRICE}. You can buy the pack with an extra discount of {extraDiscount}%. (Guessed at minute: {minute})",
        noMoreAttempts: "⛔ No more attempts are allowed for anyone."
      }
    };
    log.debug(`Using hard-coded English messages as last resort`);
  }
}

// Helper function to replace placeholders in messages
function formatMessage(template, variables = {}) {
  let message = template;
  for (const [key, value] of Object.entries(variables)) {
    const placeholder = `{${key}}`;
    message = message.replace(new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g'), value || 'unknown');
  }
  return message;
}

// Configuration constants
const CORRECT_PRICE = process.env.CORRECT_PRICE;
const MAX_ATTEMPTS = parseInt(process.env.MAX_ATTEMPTS, 10); // Default to 10 attempts if not specified
const LIVE_DURATION_MINUTES = parseInt(process.env.LIVE_DURATION, 10) || 30; // Live duration in minutes, default 30

// Configurable extra discount thresholds - loaded from .env
let EXTRADISCOUNT_THRESHOLDS = [];

// Load thresholds from environment (required)
if (process.env.EXTRADISCOUNT_THRESHOLDS) {
  try {
    // Replace LIVE_DURATION_MINUTES placeholder with actual value
    const rawThresholds = process.env.EXTRADISCOUNT_THRESHOLDS.replace(/"LIVE_DURATION_MINUTES"/g, LIVE_DURATION_MINUTES);
    const customThresholds = JSON.parse(rawThresholds);

    // Validate the structure
    if (Array.isArray(customThresholds) && customThresholds.every(t =>
      typeof t.min === 'number' && typeof t.max === 'number' && typeof t.discount === 'number'
    )) {
      EXTRADISCOUNT_THRESHOLDS = customThresholds;
      log.config(`Loaded ${customThresholds.length} custom discount thresholds from .env`);
    } else {
      log.error('Invalid EXTRADISCOUNT_THRESHOLDS format in .env. Please check the configuration.');
      process.exit(1);
    }
  } catch (e) {
    log.error(`Error parsing EXTRADISCOUNT_THRESHOLDS in .env: ${e.message}`);
    log.error('Please check the JSON format in your .env file.');
    process.exit(1);
  }
} else {
  log.error('EXTRADISCOUNT_THRESHOLDS not found in .env file. This configuration is required.');
  log.error('Please add EXTRADISCOUNT_THRESHOLDS to your .env file following the format in .env.example');
  process.exit(1);
}

// Extra discount for the nearest guess
const EXTRA_DISCOUNT_FOR_THE_NEAREST = validateBooleanEnv('EXTRA_DISCOUNT_FOR_THE_NEAREST', 'EXTRA_DISCOUNT_FOR_THE_NEAREST', false);

// Initialize attempt tracking
const attemptsForUser = {};
const attemptsUser = {}; // Stores all attempts with timestamp
const exhaustedAttemptsAnnounced = {}; // Tracks users who have already received the attempts exhausted message
const lastAttemptWasExhausted = {}; // Stores the last exhausted attempt per user
let winnerAnnounced = false;
let gameEnding = false; // Flag to prevent race conditions during game closure

// OAuth2 configuration
const SCOPES = ['https://www.googleapis.com/auth/youtube.force-ssl'];
const TOKEN_PATH = process.env.TOKEN_PATH || 'token.json';
const CLIENT_SECRET_PATH = process.env.CLIENT_SECRET_PATH || 'client_secret.json';

// Polling configuration
const MIN_POLLING = Math.max(parseInt(process.env.MIN_POLLING, 10) || 5000, 2000);
const MID_POLLING = parseInt(process.env.MID_POLLING, 10) || 10000;
const MAX_POLLING = parseInt(process.env.MAX_POLLING, 10) || 30000;
const MESSAGE_DELAY = parseInt(process.env.MESSAGE_DELAY, 10) || 2000;
const POLL_ERROR_RETRY = parseInt(process.env.POLL_ERROR_RETRY, 10) || 10000;

// Periodic exhausted announcements configuration
const PERIODIC_EXHAUSTED_ANNOUNCEMENTS = validateBooleanEnv('PERIODIC_EXHAUSTED_ANNOUNCEMENTS', 'PERIODIC_EXHAUSTED_ANNOUNCEMENTS', false);
const PERIODIC_ANNOUNCEMENT_INTERVAL = parseInt(process.env.PERIODIC_ANNOUNCEMENT_INTERVAL, 10) || 45;

// API retry configuration
let API_RETRY_ATTEMPTS = parseInt(process.env.API_RETRY_ATTEMPTS, 10) || 3;
let API_RETRY_DELAY = parseInt(process.env.API_RETRY_DELAY, 10) || 1000;

// Validate API retry configuration
if (API_RETRY_ATTEMPTS < 1 || API_RETRY_ATTEMPTS > 10) {
  log.warn(`API_RETRY_ATTEMPTS value ${API_RETRY_ATTEMPTS} out of range (1-10), using default 3`);
  API_RETRY_ATTEMPTS = 3;
}

if (API_RETRY_DELAY < 100 || API_RETRY_DELAY > 10000) {
  log.warn(`API_RETRY_DELAY value ${API_RETRY_DELAY} out of range (100-10000ms), using default 1000`);
  API_RETRY_DELAY = 1000;
}

// Display and timing configuration
let MAX_USERS_DISPLAY = parseInt(process.env.MAX_USERS_DISPLAY, 10) || 10;
let FINAL_MESSAGE_DELAY_MULTIPLIER = parseInt(process.env.FINAL_MESSAGE_DELAY_MULTIPLIER, 10) || 3;

// Validate configuration values
if (MAX_USERS_DISPLAY < 1 || MAX_USERS_DISPLAY > 50) {
  log.warn(`MAX_USERS_DISPLAY value ${MAX_USERS_DISPLAY} out of range (1-50), using default 10`);
  MAX_USERS_DISPLAY = 10;
}

if (FINAL_MESSAGE_DELAY_MULTIPLIER < 1 || FINAL_MESSAGE_DELAY_MULTIPLIER > 10) {
  log.warn(`FINAL_MESSAGE_DELAY_MULTIPLIER value ${FINAL_MESSAGE_DELAY_MULTIPLIER} out of range (1-10), using default 3`);
  FINAL_MESSAGE_DELAY_MULTIPLIER = 3;
}

// Traffic thresholds for dynamic polling
const HIGH_TRAFFIC_THRESHOLD = parseInt(process.env.HIGH_TRAFFIC_THRESHOLD, 10) || 10;
const MEDIUM_TRAFFIC_THRESHOLD = parseInt(process.env.MEDIUM_TRAFFIC_THRESHOLD, 10) || 2;

// Log polling configuration
log.config(`Polling intervals: MIN=${MIN_POLLING}ms, MID=${MID_POLLING}ms, MAX=${MAX_POLLING}ms`);
log.config(`Traffic thresholds: HIGH>${HIGH_TRAFFIC_THRESHOLD}, MEDIUM>${MEDIUM_TRAFFIC_THRESHOLD} messages`);
log.config(`API retry: ${API_RETRY_ATTEMPTS} attempts with ${API_RETRY_DELAY}ms base delay`);

// YouTube API authorization function
async function authorize(credentials) {
  // Validate SCOPES configuration
  if (!SCOPES || !Array.isArray(SCOPES)) {
    throw new Error('❌ SCOPES is not defined or is not an array.');
  }

  const { client_secret, client_id, redirect_uris } = credentials.installed;

  // Validate redirect_uris from credentials
  if (!redirect_uris?.length) {
    throw new Error('❌ No redirect URIs defined in credentials.');
  }

  const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

  if (fs.existsSync(TOKEN_PATH)) {
    let token;
    try {
      token = JSON.parse(fs.readFileSync(TOKEN_PATH));
    } catch (e) {
      log.error('Error reading token.json. The file may be corrupted.');
      fs.unlinkSync(TOKEN_PATH); // elimina token corrotto
      return await authorize(credentials); // riavvia processo auth senza callback
    }
    oAuth2Client.setCredentials(token);

    // Check if token is about to expire (within 24 hours)
    if (token.expiry_date) {
      const now = Date.now();
      const expiryTime = token.expiry_date;
      const timeUntilExpiry = expiryTime - now;
      const hoursUntilExpiry = timeUntilExpiry / (1000 * 60 * 60);

      if (timeUntilExpiry <= 0) {
        if (!token.refresh_token) {
          log.error('CRITICAL: Access token expired and no refresh token is available! You must re-authorize the bot.');
          log.error('💡 TIP: Delete token.json and restart the bot to obtain a new refresh token.');
        } else {
          log.info('Access token expired, but refresh token is available. It will be refreshed automatically.');
          try {
            const { token } = await oAuth2Client.getAccessToken();
            // getAccessToken aggiorna già le credenziali interne se serve
            fs.writeFileSync(TOKEN_PATH, JSON.stringify(oAuth2Client.credentials));
            log.success('Access token refreshed and saved (via getAccessToken).');
          } catch (err) {
            log.error(`Failed to refresh token: ${err.message || err}`);
          }
        }
      } else if (hoursUntilExpiry <= 24) {
        log.warn(`WARNING: Access token will expire in ${Math.round(hoursUntilExpiry)} hours!`);
        if (!token.refresh_token) {
          log.error('CRITICAL: No refresh token available! You may need to re-authorize the bot soon.');
          log.error('💡 TIP: Delete token.json and restart the bot to get a new refresh token.');
        } else {
          log.success('Refresh token available - automatic renewal should work.');
        }
      } else {
        log.success(`Access token is valid for ${Math.round(hoursUntilExpiry)} more hours.`);
      }
    } else {
      log.warn('WARNING: Token expiry information not available.');
    }

    return oAuth2Client;
  } else {
    const authUrl = oAuth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent', // Force refresh_token to be returned even if user already authorized
      scope: SCOPES,
    });
    log.token('Opening browser to authorize the bot...');
    // Open the browser automatically on all platforms
    try {
      const open = (await import('open')).default;
      await open(authUrl);
      log.success('Browser opened successfully for authorization.');
    } catch (importErr) {
      if (importErr.code === 'MODULE_NOT_FOUND') {
        log.warn('The "open" module is not installed. Browser will not open automatically.');
        log.info('💡 TIP: Install with "npm install open" for automatic browser opening.');
      } else {
        log.warn(`Unable to open browser automatically: ${importErr.message}`);
      }
      log.token('Please manually open this URL in your browser:');
      console.log(`\n🔗 ${authUrl}\n`);
    }

    // Convert callback-based input to Promise
    return new Promise((resolve, reject) => {
      process.stdout.write('👉 Paste the authorization code here: ');
      process.stdin.setEncoding('utf8');
      process.stdin.once('data', async (code) => {
        code = code.trim();
        try {
          const { tokens } = await oAuth2Client.getToken(code);
          oAuth2Client.setCredentials(tokens);

          if (tokens.refresh_token) {
            fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens));
          } else if (fs.existsSync(TOKEN_PATH)) {
            // Merge with old tokens to preserve refresh_token
            const oldTokens = JSON.parse(fs.readFileSync(TOKEN_PATH));
            const mergedTokens = { ...oldTokens, ...tokens };
            fs.writeFileSync(TOKEN_PATH, JSON.stringify(mergedTokens));
          } else {
            fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens));
          }
          log.success(`Token saved in ${TOKEN_PATH}`);
          resolve(oAuth2Client);
        } catch (err) {
          log.error(`Error saving token: ${err.message || err}`);
          reject(err);
        }
        process.stdin.pause();
      });
    });
  }
}
// Retrieve the active live chat ID from the YouTube channel
function getLiveChatId(youtube, callback) {
  youtube.liveBroadcasts.list({
    part: 'snippet,status',
    mine: true
  }, (err, res) => {
    if (err) {
      log.error(`Error retrieving live stream: ${err.message || err}`);
      return;
    }
    const broadcasts = res.data.items;
    if (!broadcasts || broadcasts.length === 0) {
      log.error('No live stream found in your channel.');
      return;
    }
    // Find the active live (status.lifeCycleStatus === 'live')
    const live = broadcasts.find(b => b.status && b.status.lifeCycleStatus === 'live');
    if (!live) {
      log.error('No active live stream found.');
      return;
    }
    const liveChatId = live.snippet.liveChatId;
    if (!liveChatId) {
      log.error('No liveChatId found in active live stream.');
      return;
    }
    callback(liveChatId);
  });
}

function listenChat(auth) {
  const youtube = google.youtube({ version: 'v3', auth });

  // Initialize chat polling
  getLiveChatId(youtube, (liveChatId) => {
    log.api('Listening to chat...');

    // Function to send messages with automatic retry (configurable from .env)
    async function sendMessageWithRetry(messageText, context, maxRetries = API_RETRY_ATTEMPTS) {
      return withRetry(async (attempt) => {
        try {
          const response = await youtube.liveChatMessages.insert({
            part: 'snippet',
            requestBody: {
              snippet: {
                liveChatId,
                type: 'textMessageEvent',
                textMessageDetails: {
                  messageText: messageText
                }
              }
            }
          });

          writeBotResponse(messageText, context);
          log.success(`${context} message sent successfully (attempt ${attempt}/${maxRetries})`);

          return response;
        } catch (err) {
          log.error(`${context} message failed (attempt ${attempt}/${maxRetries}): ${err.message || err}`);
          // Rethrow to allow withRetry to handle retries
          throw err;
        }
      }, {
        maxRetries,
        baseDelay: API_RETRY_DELAY,
        onRetry: (attempt, wait, err) => {
          log.info(`🔍 Retrying ${context} in ${wait}ms (exponential backoff attempt ${attempt})...`);
        }
      });
    }

    // Game start message
    const startMessage = formatMessage(MESSAGES.contest.start, {
      LIVE_DURATION_MINUTES,
      MAX_ATTEMPTS
    });
    log.contest(startMessage);
    // Send the message also to the chat
    sendMessageWithRetry(startMessage, 'CONTEST_START').then(() => {
      log.success('Contest start message sent to chat');
    }).catch((err) => {
      log.error(`Error sending contest start message to chat: ${err.message || err}`);
    });

    // Initialize polling variables
    let nextPageToken = null;
    const processedMessageIds = new Set();
    let liveStartTime = null;

    // Function to log attempts
    function logAttempt(author, text, status) {
      if (!ENABLE_LOGS) return;

      // Check if this is a bot message (should not go to discarded_attempts.log)
      // More precise detection to avoid false positives from user messages
      const isBotMessage = (text.startsWith('🤖 [BOT]') ||
                          text.startsWith('🤖 [БОТ]') ||
                          text.startsWith('🤖 [机器人]') ||
                          text.startsWith('🤖 [بوت]')) &&
                          (text.includes('⛔') ||
                          text.includes('🎉') ||
                          text.includes('⏰') ||
                          text.includes('⚠️') ||
                          text.includes('🟢'));

      const logEntry = `[${new Date().toISOString()}] ${status} ${author}: "${text}"\n`;

      // If it's a bot message, log it to bot_responses.log instead
      if (isBotMessage) {
        writeBotResponse(text, `USER_ATTEMPT_${status.replace(/[❌⚠️✅]/g, '').trim().toUpperCase().replace(/\s+/g, '_')}`);
        return;
      }

      // Log only user attempts: invalid/discarded to discarded_attempts.log, valid to valid_attempts.log
      if (status.includes('❌') || status.includes('⚠️')) {
        fs.appendFileSync(DISCARDS_LOG_FILE, logEntry);
      } else if (status === '✅ Valid attempt') {
        fs.appendFileSync(LOG_ATTEMPTS_SUCCESS_FILE, logEntry);
      }

      // Also send to console output log
      writeToConsoleLog(logEntry.trim());
    }

    // Set to track unique participants
    const uniqueParticipants = new Set();
    function logNewParticipant(author) {
      if (!uniqueParticipants.has(author)) {
        uniqueParticipants.add(author);
        const total = uniqueParticipants.size;
        const logEntry = `[${new Date().toISOString()}] NEW PARTICIPANT: ${author} (Total: ${total})\n`;

        // Only write to file if logging is enabled
        if (ENABLE_LOGS) {
          fs.appendFileSync(PARTICIPANTS_LOG_FILE, logEntry);
        }

        // Also send to console output log
        writeToConsoleLog(logEntry.trim());
      }
    }

    // Centralized validation and attempt handling to avoid duplicated code
    async function handleUserAttempt(text, author) {
      // Accept numbers with dot OR comma as decimal separator (improved validation)
      if (!/^\d+([.,]\d{1,3})?$/.test(text)) {
        logAttempt(author, text, '❌ Invalid format (only numbers with optional 1-3 decimal places, dot or comma as separator, no other characters)');
        return { accepted: false };
      }

      // Normalize comma to dot for parsing
      const normalizedText = text.replace(',', '.');
      const parsed = parseFloat(normalizedText);
      if (typeof parsed !== 'number' || isNaN(parsed)) {
        logAttempt(author, text, '❌ Not a valid number');
        return { accepted: false };
      }
      const number = parsed;

      if (!attemptsForUser[author]) attemptsForUser[author] = 0;
      if (!exhaustedAttemptsAnnounced[author]) exhaustedAttemptsAnnounced[author] = false;

      attemptsForUser[author]++;

      if (attemptsForUser[author] > MAX_ATTEMPTS) {
        lastAttemptWasExhausted[author] = number; // Save the last exhausted attempt
        logAttempt(author, text, '⚠️ Attempts exhausted');
        if (!exhaustedAttemptsAnnounced[author]) {
          try {
            const exhaustedMessage = formatMessage(MESSAGES.contest.attemptsExhausted, {
              author,
              MAX_ATTEMPTS,
              lastAttempt: lastAttemptWasExhausted[author] || 'unknown'
            });
            await sendMessageWithRetry(exhaustedMessage, 'ATTEMPTS_EXHAUSTED');
            if (ENABLE_LOGS) {
              fs.appendFileSync(ATTEMPTS_EXHAUSTED_LOG_FILE, `[${new Date().toISOString()}] Exhausted attempts announced to ${author}\n`);
            }
            exhaustedAttemptsAnnounced[author] = true;
          } catch (err) {
            log.error(`Error sending exhausted attempts message: ${err.message || JSON.stringify(err)}`);
          }
        }
        return { accepted: false };
      }

      logAttempt(author, text, '✅ Valid attempt');
      return { accepted: true, value: number };
    }

    // Function to calculate the extra discount based on minute
    // Automatic function to calculate extra discount based on minute
    function calculateExtraDiscount(minute) {
      for (const threshold of EXTRADISCOUNT_THRESHOLDS) {
        if (minute >= threshold.min && minute <= threshold.max) {
          return threshold.discount;
        }
      }
      return 0;
    }

    // Function to find who got closest to the correct price
    function findClosest() {
      if (!EXTRA_DISCOUNT_FOR_THE_NEAREST) return null;

      let closest = null;
      let minimumDistance = Infinity;

      const correctPrice = parseFloat(CORRECT_PRICE);

      for (const [user, attempts] of Object.entries(attemptsUser)) {
        for (const attempt of attempts) {
          const distance = Math.abs(attempt.value - correctPrice);
          if (distance < minimumDistance) {
            minimumDistance = distance;
            closest = {
              user,
              value: attempt.value,
              timestamp: attempt.timestamp
            };
          }
        }
      }

      return closest;
    }

    // Periodic timer for announcing exhausted users (if enabled)
    let periodicAnnouncementTimer = null;
    let periodicAnnouncementController = null;
    if (PERIODIC_EXHAUSTED_ANNOUNCEMENTS) {
      // Resolve interval (allowms override variable EXHAUSTED_USERS_ANNOUNCEMENT_INTERVAL in ms)
      const periodicMs = process.env.EXHAUSTED_USERS_ANNOUNCEMENT_INTERVAL
        ? Math.max(1000, parseInt(process.env.EXHAUSTED_USERS_ANNOUNCEMENT_INTERVAL, 10))
        : Math.max(1000, PERIODIC_ANNOUNCEMENT_INTERVAL * 1000);

      // lazy import helper
      try {
        // dynamic import without top-level await
        import('./lib/periodicAnnouncements.js').then(({ startPeriodicAnnouncements }) => {
          try {
            periodicAnnouncementController = startPeriodicAnnouncements({
              intervalMs: periodicMs,
              getExhaustedUsers: async () => {
                const exhaustedUsers = [];
                for (const [author, attempts] of Object.entries(attemptsForUser)) {
                  if (attempts > MAX_ATTEMPTS) exhaustedUsers.push(author);
                }
                return exhaustedUsers;
              },
              formatMessage: (key, vars) => formatMessage(MESSAGES.contest[key] || '', vars || {}),
              sendMessage: async (msg, ctx) => sendMessageWithRetry(msg, ctx),
              logger: log,
              maxUsersDisplay: MAX_USERS_DISPLAY,
              enableLogs: ENABLE_LOGS,
              attemptsExhaustedLogFile: ATTEMPTS_EXHAUSTED_LOG_FILE
            });
            log.info(`Periodic exhausted announcements enabled (every ${Math.round(periodicMs/1000)}s)`);
          } catch (err) {
            log.error(`Failed to start periodic announcements helper: ${err.message || err}`);
          }
        }).catch((err) => {
          log.error(`Failed to import periodicAnnouncements helper: ${err.message || err}`);
        });
      } catch (e) {
        log.error(`Failed to start periodic announcements helper: ${e.message || e}`);
      }
    }

    // Compute absolute live end timestamp and final accept window
    const liveEndTime = Date.now() + LIVE_DURATION_MINUTES * 60 * 1000;
    const FINAL_ACCEPT_MS = 100; // allow attempts until the last 100ms

    // Flag set when timer fires requesting graceful shutdown; poller will perform final acceptance
    let liveEndingRequested = false;

  // Centralized end-of-game procedure (used by poller when final window reached)
    async function endGameProcedure() {
      if (winnerAnnounced) {
        log.info('End game procedure aborted: winner already announced');
        return;
      }
      gameEnding = true; // Prevent race conditions with ongoing polling
      log.timer(`Time expired: ${LIVE_DURATION_MINUTES} minutes of live completed.`);

      // QUICK CHECK: If there are no participants at all, send the NO_PARTICIPANTS message
      try {
        const attemptsMap = (typeof attemptsForUser !== 'undefined') ? attemptsForUser : ((typeof attemptsUser !== 'undefined') ? attemptsUser : {});
        const hasParticipants = Object.keys(attemptsMap || {}).length > 0;
        if (!hasParticipants) {
          try {
            const template = (MESSAGES && MESSAGES.contest && MESSAGES.contest.timeExpiredNoParticipants)
              ? MESSAGES.contest.timeExpiredNoParticipants
              : DEFAULT_MESSAGES.contest.timeExpiredNoParticipants;
            const messageText = formatMessage(template, { CORRECT_PRICE: Number(CORRECT_PRICE).toFixed(2) });
            await sendMessageWithRetry(messageText, 'NO_PARTICIPANTS');
            log.success('NO_PARTICIPANTS message sent (no participants)');
          } catch (err) {
            log.error('Failed to send NO_PARTICIPANTS message: ' + (err?.message || err));
          }

          // Stop periodic announcements if running
          if (periodicAnnouncementController && typeof periodicAnnouncementController.stop === 'function') {
            periodicAnnouncementController.stop();
            log.info('Periodic announcement controller stopped (no participants)');
          } else if (periodicAnnouncementTimer) {
            clearInterval(periodicAnnouncementTimer);
            log.info('Periodic announcement timer cleared (no participants)');
          }

          // Allow messages to be delivered
          await new Promise(resolve => setTimeout(resolve, 3000));
          log.shutdown('No participants — Contest completed! Bot shutting down...');
          process.exit(0);
        }
      } catch (err) {
        log.error('Error while checking participants at endGameProcedure: ' + (err?.message || err));
      }

      // First, send the exhausted attempts messages for those who haven't received them yet
      for (const [author, attempts] of Object.entries(attemptsForUser)) {
        if (attempts > MAX_ATTEMPTS && !exhaustedAttemptsAnnounced[author]) {
          try {
            const exhaustedMessage = formatMessage(MESSAGES.contest.attemptsExhausted, {
              author,
              MAX_ATTEMPTS,
              lastAttempt: lastAttemptWasExhausted[author] || 'unknown'
            });
            await sendMessageWithRetry(exhaustedMessage, 'ATTEMPTS_EXHAUSTED_END_GAME');
            if (ENABLE_LOGS) {
              fs.appendFileSync(ATTEMPTS_EXHAUSTED_LOG_FILE, `[${new Date().toISOString()}] Exhausted attempts announced at end of game to ${author}\n`);
            }
            exhaustedAttemptsAnnounced[author] = true;
            log.success(`Exhausted attempts message sent to ${author} at end of game`);
          } catch (err) {
            log.error(`Error sending exhausted attempts message to ${author}: ${err.message || err}`);
          }
        }
      }

      // Add a larger delay to avoid YouTube API rate limiting after exhausted messages
      await new Promise(resolve => setTimeout(resolve, MESSAGE_DELAY * FINAL_MESSAGE_DELAY_MULTIPLIER));

      // Then send the game closing message
      if (!winnerAnnounced) {
        if (EXTRA_DISCOUNT_FOR_THE_NEAREST) {
          const closest = findClosest();
          if (closest) {
            const { user, value, timestamp } = closest;
            const msgTime = new Date(timestamp);
            const minute = Math.floor((msgTime - liveStartTime) / 60000) + 1;
            const extraDiscount = calculateExtraDiscount(minute);

            if (ENABLE_LOGS) {
              fs.appendFileSync(LOG_ATTEMPTS_SUCCESS_FILE, `[${new Date().toISOString()}] CLOSEST WINNER: ${user} with €${value} (distance: €${Math.abs(value - parseFloat(CORRECT_PRICE)).toFixed(2)}) - Extra discount: ${extraDiscount}% - Minute: ${minute}\n`);
            }

            try {
              const closestWinnerMessage = formatMessage(MESSAGES.contest.timeExpiredClosestWinner, {
                user,
                CORRECT_PRICE,
                value,
                extraDiscount,
                minute
              });
              await sendMessageWithRetry(closestWinnerMessage, 'CLOSEST_WINNER');
              log.success(`Closest winner prize message sent to ${user}!`);
            } catch (err) {
              log.error(`Error sending closest winner prize message: ${err.message || JSON.stringify(err)}`);
            }
          } else {
            try {
              const noParticipantsMessage = formatMessage(MESSAGES.contest.timeExpiredNoParticipants, {
                CORRECT_PRICE
              });
              await sendMessageWithRetry(noParticipantsMessage, 'NO_PARTICIPANTS');
              log.success("End of game message sent!");
            } catch (err) {
              log.error(`Error sending end of game message: ${err.message || err}`);
            }
          }
        } else {
          try {
            const noWinnerMessage = formatMessage(MESSAGES.contest.timeExpiredNoWinner, {});
            await sendMessageWithRetry(noWinnerMessage, 'NO_WINNER');
            log.success("End of game message sent!");
          } catch (err) {
            log.error(`Error sending end of game message: ${err.message || err}`);
          }
        }
      }

      // Clean up the periodic announcement timer
      if (periodicAnnouncementController && typeof periodicAnnouncementController.stop === 'function') {
        periodicAnnouncementController.stop();
        log.info("Periodic announcement timer cleared");
      }

      // Grace period to ensure all pending messages are delivered
      log.info("Waiting 3 seconds to ensure all messages are delivered...");
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Exit the bot after contest completion
      log.shutdown("Contest completed! Bot shutting down...");
      process.exit(0);
    }

    // Timer for live duration: request the end, but allow poller to collect last messages
    // Helper to process a batch of messages (extracted from the main poll loop so we can reuse it)
    async function processMessages(messages) {
      // messages should already be sorted by publishedAt
      for (const msg of messages) {
        if (gameEnding) {
          log.debug('Message processing stopped: game is ending');
          break;
        }

        const msgId = msg.id;
        if (processedMessageIds.has(msgId)) continue;
        processedMessageIds.add(msgId);

        let text = msg.snippet.textMessageDetails?.messageText;
        const author = msg.authorDetails.displayName;
        if (!text) continue;

        // Log new participant if writing for the first time
        logNewParticipant(author);

        // Centralized attempt handling
        const attemptResult = await handleUserAttempt(text, author);
        if (!attemptResult.accepted) continue;
        const number = attemptResult.value;

        // Save the attempt with timestamp if enabled (only for valid attempts)
        if (EXTRA_DISCOUNT_FOR_THE_NEAREST) {
          if (!attemptsUser[author]) {
            attemptsUser[author] = [];
          }
          attemptsUser[author].push({
            value: number,
            timestamp: new Date(msg.snippet.publishedAt).toISOString()
          });
        }

        // Send the victory message in chat to the user who guessed the exact price!!
        if (!winnerAnnounced && number === parseFloat(CORRECT_PRICE)) {
          // Mark winner immediately and cancel scheduled end-of-game timer
          winnerAnnounced = true;
          try { clearTimeout(liveTimer); } catch (e) {}
          gameEnding = true; // Prevent race conditions

          // Calculate the minute at which the guess was made
          let extraDiscount = 0;
          let minute = 0;
          if (liveStartTime) {
            const msgTime = new Date(msg.snippet.publishedAt);
            minute = Math.floor((msgTime - liveStartTime) / 60000) + 1;
            extraDiscount = calculateExtraDiscount(minute);
          }
          try {
            if (ENABLE_LOGS) {
              fs.appendFileSync(LOG_ATTEMPTS_SUCCESS_FILE, `[${new Date().toISOString()}] EXACT WINNER: ${author} with €${CORRECT_PRICE} - Extra discount: ${extraDiscount}% - Minute: ${minute}\n`);
            }
            const exactWinnerMessage = formatMessage(MESSAGES.contest.exactWinner, {
              author,
              CORRECT_PRICE,
              extraDiscount,
              minute
            });
            const noMoreAttemptsMessage = formatMessage(MESSAGES.contest.noMoreAttempts, {});

            await sendMessageWithRetry(exactWinnerMessage, 'EXACT_WINNER');
            await sendMessageWithRetry(noMoreAttemptsMessage, 'NO_MORE_ATTEMPTS');
            log.success('Winner message sent!');
          } catch (err) {
            log.error(`Error sending winner message: ${err.message || JSON.stringify(err)}`);
          }

          if (periodicAnnouncementController && typeof periodicAnnouncementController.stop === 'function') {
            periodicAnnouncementController.stop();
            log.info('Periodic announcement controller stopped (exact winner)');
          } else if (periodicAnnouncementTimer) {
            clearInterval(periodicAnnouncementTimer);
            log.info('Periodic announcement timer cleared (exact winner)');
          }

          log.info('Waiting 3 seconds to ensure all messages are delivered...');
          await new Promise(resolve => setTimeout(resolve, 3000));

          log.shutdown('Exact price guessed! Bot shutting down...');
          process.exit(0);
        }
      }
    }

    const liveTimer = setTimeout(async () => {
      if (winnerAnnounced) {
        log.info('Live timer fired but winner already announced; skipping end request');
        return;
      }
      liveEndingRequested = true;
      log.timer('Live timer fired — performing a final fetch to capture any remaining messages');
      try {
        const res = await youtube.liveChatMessages.list({
          liveChatId,
          part: 'snippet,authorDetails',
          pageToken: nextPageToken,
        });
        const finalItems = res.data.items || [];
        finalItems.sort((a, b) => new Date(a.snippet.publishedAt) - new Date(b.snippet.publishedAt));
        await processMessages(finalItems);
      } catch (err) {
        log.error(`Final fetch failed: ${err.message || JSON.stringify(err)}`);
      }

      // After final fetch, proceed with end game procedure
      await endGameProcedure();
    }, LIVE_DURATION_MINUTES * 60 * 1000);

    // Initial function for polling the chat
    async function pollChat() {
      try {
        // Stop polling if game is ending to prevent race conditions
        if (gameEnding) {
          log.debug("Polling stopped: game is ending");
          return;
        }

        let pageToken = nextPageToken;
        let keepGoing = true;
        // Dynamic polling intervals (in ms)
        let pollingInterval = MIN_POLLING; // default

        while (keepGoing) {
          const res = await youtube.liveChatMessages.list({
            liveChatId,
            part: 'snippet,authorDetails',
            pageToken: pageToken,
          });

            // Set the live start time from the first call
          if (!liveStartTime && res.data.items.length > 0) {
            liveStartTime = new Date(res.data.items[0].snippet.publishedAt);
          }

            // Always use the greater value between pollingIntervalMillis and the dynamically calculated one
          if (res.data.pollingIntervalMillis)
            pollingInterval = Math.max(res.data.pollingIntervalMillis, pollingInterval);

          pageToken = res.data.nextPageToken;
          if (!nextPageToken) nextPageToken = pageToken;
          const messages = res.data.items;

            // --- DYNAMIC LOGIC ---
            // Adjust polling dynamically based on traffic
            if (messages.length > HIGH_TRAFFIC_THRESHOLD) {
              pollingInterval = MIN_POLLING; // high traffic: fast poll
            } else if (messages.length > MEDIUM_TRAFFIC_THRESHOLD) {
              pollingInterval = MID_POLLING; // medium traffic
            } else {
              pollingInterval = MAX_POLLING; // low traffic: slow poll
            }

            // If the live end was requested, reduce polling interval aggressively to catch last messages
            if (liveEndingRequested) {
              const remaining = liveEndTime - Date.now();
              log.debug(`Live ending requested, remaining ${remaining}ms`);
              if (remaining > 0 && remaining <= FINAL_ACCEPT_MS) {
                // time is up (or within final acceptance window) — accept final messages and proceed to end
                log.debug('Within final accept window — proceeding to endGameProcedure after processing current messages');
                await endGameProcedure();
                return;
              }
              // otherwise reduce polling to a small fixed value to poll quickly
              pollingInterval = Math.max(200, Math.min(pollingInterval, 500));
            }
            // --- END OF DYNAMIC LOGIC ---

          // Sort messages by publishedAt (in ascending order)
          messages.sort((a, b) => new Date(a.snippet.publishedAt) - new Date(b.snippet.publishedAt));

          for (const msg of messages) {
            // Skip processing if game is ending
            if (gameEnding) {
              log.debug("Message processing stopped: game is ending");
              break;
            }

            const msgId = msg.id;
            if (processedMessageIds.has(msgId)) continue;
            processedMessageIds.add(msgId);

            let text = msg.snippet.textMessageDetails?.messageText;
            const author = msg.authorDetails.displayName;
            if (!text) continue;

            // Log new participant if writing for the first time
            logNewParticipant(author);

            // Centralized attempt handling
            const attemptResult = await handleUserAttempt(text, author);
            if (!attemptResult.accepted) continue;
            const number = attemptResult.value;

            // Save the attempt with timestamp if enabled (only for valid attempts)
            if (EXTRA_DISCOUNT_FOR_THE_NEAREST) {
              if (!attemptsUser[author]) {
                attemptsUser[author] = [];
              }
              attemptsUser[author].push({
                value: number,
                timestamp: new Date(msg.snippet.publishedAt).toISOString()
              });
            }

            // Send the victory message in chat to the user who guessed the exact price!!
            if (!winnerAnnounced && number === parseFloat(CORRECT_PRICE)) {
              // Mark winner immediately and cancel scheduled end-of-game timer
              // Cancel timer before setting gameEnding to reduce race window
              winnerAnnounced = true;
              clearTimeout(liveTimer); // Stop the live timer
              gameEnding = true; // Prevent race conditions
                // Calculate the minute at which the guess was made
              let extraDiscount = 0;
              let minute = 0;
              if (liveStartTime) {
                const msgTime = new Date(msg.snippet.publishedAt);
                minute = Math.floor((msgTime - liveStartTime) / 60000) + 1;
                extraDiscount = calculateExtraDiscount(minute);
              }
              try {
                // Log the winner if logging is enabled
                if (ENABLE_LOGS) {
                  fs.appendFileSync(LOG_ATTEMPTS_SUCCESS_FILE, `[${new Date().toISOString()}] EXACT WINNER: ${author} with €${CORRECT_PRICE} - Extra discount: ${extraDiscount}% - Minute: ${minute}\n`);
                }
                const exactWinnerMessage = formatMessage(MESSAGES.contest.exactWinner, {
                  author,
                  CORRECT_PRICE,
                  extraDiscount,
                  minute
                });
                const noMoreAttemptsMessage = formatMessage(MESSAGES.contest.noMoreAttempts, {});

                await sendMessageWithRetry(exactWinnerMessage, 'EXACT_WINNER');

                await sendMessageWithRetry(noMoreAttemptsMessage, 'NO_MORE_ATTEMPTS');
                log.success("Winner message sent!");
              } catch (err) {
                log.error(`Error sending winner message: ${err.message || JSON.stringify(err)}`);
              }

              // Clean up the periodic announcement timer / controller
              if (periodicAnnouncementController && typeof periodicAnnouncementController.stop === 'function') {
                periodicAnnouncementController.stop();
                log.info("Periodic announcement controller stopped (exact winner)");
              } else if (periodicAnnouncementTimer) {
                clearInterval(periodicAnnouncementTimer);
                log.info("Periodic announcement timer cleared (exact winner)");
              }

              // Grace period to ensure all pending messages are delivered
              log.info("Waiting 3 seconds to ensure all messages are delivered...");
              await new Promise(resolve => setTimeout(resolve, 3000));

              // Exit the bot after exact match victory
              log.shutdown("Exact price guessed! Bot shutting down...");
              process.exit(0);
            }
          }
          if (pageToken) {
            await new Promise(resolve => setTimeout(resolve, pollingInterval));
          } else {
            keepGoing = false;
          }
        }
        // Only restart polling if game is not ending
        if (!gameEnding) {
          // If the liveEnd was requested, ensure we schedule another quick poll to capture any last messages
          if (liveEndingRequested) {
            setTimeout(pollChat, Math.max(100, Math.min(pollingInterval, 500)));
          } else {
            setTimeout(pollChat, pollingInterval);
          }
        }
      } catch (err) {
        log.error(`Error during polling: ${err.message || JSON.stringify(err)}`);
        // Only restart polling if game is not ending
        if (!gameEnding) {
          setTimeout(pollChat, POLL_ERROR_RETRY);
        }
      }
    }
    pollChat();
  });
}

// Reads credentials from the client_secret.json file
fs.readFile(CLIENT_SECRET_PATH, async (err, content) => {
  if (err) {
    const errorLog = {
      timestamp: new Date().toISOString(),
      error: `Error reading ${CLIENT_SECRET_PATH}`,
      details: err.message || err
    };
    let logs = [];
    if (fs.existsSync(ERROR_STARTING_LOG_FILE)) {
      try {
        logs = JSON.parse(fs.readFileSync(ERROR_STARTING_LOG_FILE));
      } catch (e) {
        logs = [];
      }
    }
    logs.push(errorLog);
    fs.writeFileSync(ERROR_STARTING_LOG_FILE, JSON.stringify(logs, null, 2));
    return log.error(`Error reading ${CLIENT_SECRET_PATH}: ${err}`);
  }

  try {
    const authClient = await authorize(JSON.parse(content));
    listenChat(authClient);
  } catch (authError) {
    log.error(`Authorization failed: ${authError.message || authError}`);
  }
});
