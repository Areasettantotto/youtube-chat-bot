import fs from 'fs';
import { google } from 'googleapis';
import dotenv from 'dotenv';

dotenv.config();

// Load user messages from external JSON file
const MESSAGES_FILE = process.env.MESSAGES_FILE || 'messages/messages.json';
const MESSAGES_INDEX_FILE = 'messages/index.json';
let MESSAGES = {};
let LANGUAGES_CONFIG = {};

// Load languages configuration
try {
  LANGUAGES_CONFIG = JSON.parse(fs.readFileSync(MESSAGES_INDEX_FILE, 'utf8'));
  console.log(`📋 Loaded languages config: ${Object.keys(LANGUAGES_CONFIG.available_languages).length} languages available`);
} catch (err) {
  console.warn(`⚠️ Warning: Could not load languages config from ${MESSAGES_INDEX_FILE}:`, err.message);
}

// Load messages
try {
  MESSAGES = JSON.parse(fs.readFileSync(MESSAGES_FILE, 'utf8'));
  const selectedLang = Object.values(LANGUAGES_CONFIG.available_languages || {})
    .find(lang => MESSAGES_FILE.includes(lang.file))?.name || 'Unknown';
  console.log(`🌍 Loaded messages: ${selectedLang} (${MESSAGES_FILE})`);
} catch (err) {
  console.error(`❌ Error loading messages file ${MESSAGES_FILE}:`, err.message);
  console.error('Using default English messages as fallback');

  // Fallback to default English messages
  const fallbackFile = 'messages/messages.json';
  try {
    MESSAGES = JSON.parse(fs.readFileSync(fallbackFile, 'utf8'));
    console.log(`✅ Loaded fallback messages from ${fallbackFile}`);
  } catch (fallbackErr) {
    console.error(`❌ Could not load fallback messages:`, fallbackErr.message);
    // Hard-coded fallback as last resort
    MESSAGES = {
      contest: {
        start: "🟢 Contest started, from now you have {LIVE_DURATION_MINUTES} minutes and {MAX_ATTEMPTS} attempts to get extraordinary extra discounts!!",
        attemptsExhausted: "⛔ {author}, you have exceeded the maximum number of {MAX_ATTEMPTS} available attempts. Your last attempt {lastAttempt} will not be considered valid.",
        timeExpiredClosestWinner: "⏰ Time expired! {user} got closest to the correct price €{CORRECT_PRICE} with €{value}. Get an extra discount of {extraDiscount}%! (Attempt at minute: {minute})",
        timeExpiredNoParticipants: "⏰ Time expired! The correct price was €{CORRECT_PRICE}. Nobody participated in the contest!",
        timeExpiredNoWinner: "⏰ Time expired! No winner this time!",
        exactWinner: "🎉 Congratulations {author}! You guessed the exact discounted price: €{CORRECT_PRICE}. You can buy the pack with an extra discount of {extraDiscount}%. (Guessed at minute: {minute})",
        noMoreAttempts: "⛔ No more attempts are allowed for anyone."
      }
    };
    console.log(`⚡ Using hard-coded English messages as last resort`);
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

// Configurable extra discount thresholds
const EXTRADISCOUNT_THRESHOLDS = [
  { min: 0, max: 10, discount: 80 },
  { min: 11, max: 20, discount: 70 },
  { min: 21, max: LIVE_DURATION_MINUTES, discount: 60 }
];

// Ensure the environment variables are set
const LOGS_DIR = process.env.LOGS_DIR || 'logs';

// Log filenames with defaults
const DISCARDS_LOG_FILENAME = process.env.DISCARDS_LOG_FILENAME || 'discarded_attempts.log';
const LOG_ATTEMPTS_SUCCESS_FILENAME = process.env.LOG_ATTEMPTS_SUCCESS_FILENAME || 'valid_attempts.log';
const ERROR_STARTING_LOG_FILENAME = process.env.ERROR_STARTING_LOG_FILENAME || 'startup_errors.json';
const ATTEMPTS_EXHAUSTED_LOG_FILENAME = process.env.ATTEMPTS_EXHAUSTED_LOG_FILENAME || 'exhausted_attempts.log';

// Construct full log file paths directly
const DISCARDS_LOG_FILE = `${LOGS_DIR}/${DISCARDS_LOG_FILENAME}`;
const LOG_ATTEMPTS_SUCCESS_FILE = `${LOGS_DIR}/${LOG_ATTEMPTS_SUCCESS_FILENAME}`;
const ERROR_STARTING_LOG_FILE = `${LOGS_DIR}/${ERROR_STARTING_LOG_FILENAME}`;
const ATTEMPTS_EXHAUSTED_LOG_FILE = `${LOGS_DIR}/${ATTEMPTS_EXHAUSTED_LOG_FILENAME}`;

// Extra discount for the nearest guess
const EXTRA_DISCOUNT_FOR_THE_NEAREST = process.env.EXTRA_DISCOUNT_FOR_THE_NEAREST === 'true';

// Initialize attempt tracking
const attemptsForUser = {};
const attemptsUser = {}; // Stores all attempts with timestamp
const exhaustedAttemptsAnnounced = {}; // Tracks users who have already received the attempts exhausted message
const lastAttemptWasExhausted = {}; // Stores the last exhausted attempt per user
let winnerAnnounced = false;

// OAuth2 configuration
const SCOPES = ['https://www.googleapis.com/auth/youtube.force-ssl'];
const TOKEN_PATH = process.env.TOKEN_PATH || 'token.json';
const CLIENT_SECRET_PATH = process.env.CLIENT_SECRET_PATH || 'client_secret.json';

// Polling configuration
const MIN_POLLING = parseInt(process.env.MIN_POLLING, 10) || 3000;
const MID_POLLING = parseInt(process.env.MID_POLLING, 10) || 10000;
const MAX_POLLING = parseInt(process.env.MAX_POLLING, 10) || 30000;
const MESSAGE_DELAY = parseInt(process.env.MESSAGE_DELAY, 10) || 1000;
const POLL_ERROR_RETRY = parseInt(process.env.POLL_ERROR_RETRY, 10) || 10000;

// Enable/disable logging
const ENABLE_LOGS = process.env.ENABLE_LOGS === 'true';

// Ensure logs directory exists
if (ENABLE_LOGS && !fs.existsSync(LOGS_DIR)) {
  fs.mkdirSync(LOGS_DIR, { recursive: true });
  console.log(`📁 Directory ${LOGS_DIR} created automatically`);
}

// YouTube API authorization function
async function authorize(credentials, callback) {
  const { client_secret, client_id, redirect_uris } = credentials.installed;
  const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

  if (fs.existsSync(TOKEN_PATH)) {
    const token = JSON.parse(fs.readFileSync(TOKEN_PATH));
    oAuth2Client.setCredentials(token);
    callback(oAuth2Client);
  } else {
    const authUrl = oAuth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
    });
    console.log('🔑 Opening browser to authorize the bot...');
    // Open the browser automatically on all platforms
    try {
      const open = (await import('open')).default;
      await open(authUrl);
    } catch (e) {
      console.log('❌ Unable to open browser automatically. Manually open this URL:', authUrl);
    }
    process.stdout.write('👉 Paste the authorization code here: ');
    process.stdin.setEncoding('utf8');
    process.stdin.once('data', async (code) => {
      code = code.trim();
      try {
        const { tokens } = await oAuth2Client.getToken(code);
        oAuth2Client.setCredentials(tokens);
        fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens));
        console.log(`✅ Token saved in ${TOKEN_PATH}`);
        callback(oAuth2Client);
      } catch (err) {
        console.error('❌ Error saving token:', err.message || err);
      }
      process.stdin.pause();
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
      console.error('❌ Error retrieving live stream:', err.message || err);
      return;
    }
    const broadcasts = res.data.items;
    if (!broadcasts || broadcasts.length === 0) {
      console.error('❌ No live stream found in your channel.');
      return;
    }
    // Find the active live (status.lifeCycleStatus === 'live')
    const live = broadcasts.find(b => b.status && b.status.lifeCycleStatus === 'live');
    if (!live) {
      console.error('❌ No active live stream found.');
      return;
    }
    const liveChatId = live.snippet.liveChatId;
    if (!liveChatId) {
      console.error('❌ No liveChatId found in active live stream.');
      return;
    }
    callback(liveChatId);
  });
}

function listenChat(auth) {
  const youtube = google.youtube({ version: 'v3', auth });

  // Initialize chat polling
  getLiveChatId(youtube, (liveChatId) => {
    console.log('🚀 Listening to chat...');
    // Game start message
    const startMessage = formatMessage(MESSAGES.contest.start, {
      LIVE_DURATION_MINUTES,
      MAX_ATTEMPTS
    });
    console.log(startMessage);
    // Send the message also to the chat
    youtube.liveChatMessages.insert({
      part: 'snippet',
      requestBody: {
        snippet: {
          liveChatId,
          type: 'textMessageEvent',
          textMessageDetails: {
            messageText: startMessage
          }
        }
      }
    }).catch((err) => {
      console.error('❌ Error sending contest start message to chat:', err);
    });

    // Initialize polling variables
    let nextPageToken = null;
    const processedMessageIds = new Set();
    let liveStartTime = null;

    // Function to log attempts
    function logAttempt(author, text, status) {
      if (!ENABLE_LOGS) return;
      const log = `[${new Date().toISOString()}] ${status} ${author}: "${text}"\n`;
      if (status === '✅ Valid attempt') {
        fs.appendFileSync(LOG_ATTEMPTS_SUCCESS_FILE, log);
      } else {
        fs.appendFileSync(DISCARDS_LOG_FILE, log);
      }
      console.log(log.trim());
    }

    // Set to track unique participants
    const uniqueParticipants = new Set();
    function logNewParticipant(author) {
      if (!uniqueParticipants.has(author)) {
        uniqueParticipants.add(author);
        const total = uniqueParticipants.size;
        const log = `[${new Date().toISOString()}] new participant (${author}) (Total: ${total})\n`;
        fs.appendFileSync(LOG_ATTEMPTS_SUCCESS_FILE, log);
        console.log(log.trim());
      }
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

    // Timer for live duration
    const liveTimer = setTimeout(async () => {
      console.log(`⏰ Time expired: ${LIVE_DURATION_MINUTES} minutes of live completed.`);

      // First, send the exhausted attempts messages for those who haven't received them yet
      for (const [author, attempts] of Object.entries(attemptsForUser)) {
        if (attempts > MAX_ATTEMPTS && !exhaustedAttemptsAnnounced[author]) {
          try {
            await youtube.liveChatMessages.insert({
              part: 'snippet',
              requestBody: {
                snippet: {
                  liveChatId,
                  type: 'textMessageEvent',
                  textMessageDetails: {
                    messageText: formatMessage(MESSAGES.contest.attemptsExhausted, {
                      author,
                      MAX_ATTEMPTS,
                      lastAttempt: lastAttemptWasExhausted[author] || 'unknown'
                    })
                  }
                }
              }
            });
            if (ENABLE_LOGS) {
              fs.appendFileSync(ATTEMPTS_EXHAUSTED_LOG_FILE, `[${new Date().toISOString()}] Exhausted attempts announced at end of game to ${author}\n`);
            }
            exhaustedAttemptsAnnounced[author] = true;
            console.log(`✅ Exhausted attempts message sent to ${author} at end of game`);
          } catch (err) {
            console.error(`❌ Error sending exhausted attempts message to ${author}:`, err);
          }
        }
      }

      // Add a small delay to ensure the correct order of messages
      await new Promise(resolve => setTimeout(resolve, MESSAGE_DELAY));

      // Then send the game closing message
      if (!winnerAnnounced) {
        if (EXTRA_DISCOUNT_FOR_THE_NEAREST) {
            // With extra discount for the nearest: show the price and find the closest winner
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
              await youtube.liveChatMessages.insert({
                part: 'snippet',
                requestBody: {
                  snippet: {
                    liveChatId,
                    type: 'textMessageEvent',
                    textMessageDetails: {
                      messageText: formatMessage(MESSAGES.contest.timeExpiredClosestWinner, {
                        user,
                        CORRECT_PRICE,
                        value,
                        extraDiscount,
                        minute
                      })
                    }
                  }
                }
              });
              console.log(`✅ Closest winner prize message sent to ${user}!`);
            } catch (err) {
              console.error('❌ Error sending closest winner prize message:', err);
            }
          } else {
            try {
              await youtube.liveChatMessages.insert({
                part: 'snippet',
                requestBody: {
                  snippet: {
                    liveChatId,
                    type: 'textMessageEvent',
                    textMessageDetails: {
                      messageText: formatMessage(MESSAGES.contest.timeExpiredNoParticipants, {
                        CORRECT_PRICE
                      })
                    }
                  }
                }
              });
              console.log("✅ End of game message sent!");
            } catch (err) {
              console.error('❌ Error sending end of game message:', err);
            }
          }
        } else {
            // Without extra discount for the nearest: DO NOT show the price
          try {
            await youtube.liveChatMessages.insert({
              part: 'snippet',
              requestBody: {
                snippet: {
                  liveChatId,
                  type: 'textMessageEvent',
                  textMessageDetails: {
                    messageText: formatMessage(MESSAGES.contest.timeExpiredNoWinner, {})
                  }
                }
              }
            });
            console.log("✅ End of game message sent!");
          } catch (err) {
            console.error('❌ Error sending end of game message:', err);
          }
        }
      }
    }, LIVE_DURATION_MINUTES * 60 * 1000);

    // Initial function for polling the chat
    async function pollChat() {
      try {
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
          if (messages.length > 10) {
            pollingInterval = MIN_POLLING; // high traffic: fast poll
          } else if (messages.length > 2) {
            pollingInterval = MID_POLLING; // medium traffic
          } else {
            pollingInterval = MAX_POLLING; // low traffic: slow poll
          }
            // --- END OF DYNAMIC LOGIC ---

            // Sort messages by publishedAt (in ascending order)
          messages.sort((a, b) => new Date(a.snippet.publishedAt) - new Date(b.snippet.publishedAt));

          for (const msg of messages) {
            const msgId = msg.id;
            if (processedMessageIds.has(msgId)) continue;
            processedMessageIds.add(msgId);

            let text = msg.snippet.textMessageDetails?.messageText;
            const author = msg.authorDetails.displayName;
            if (!text) continue;

            // Log new participant if writing for the first time
            logNewParticipant(author);

            // Only numbers without spaces, letters, or other symbols (only digits and an optional decimal point)
            if (!/^\d+(\.\d+)?$/.test(text)) {
              logAttempt(author, text, '❌ Invalid format (only numbers, dot as decimal separator, no other characters or spaces)');
              continue;
            }

            const parsed = parseFloat(text);
            if (typeof parsed !== 'number' || isNaN(parsed)) {
              logAttempt(author, text, '❌ Not a valid number');
              continue;
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
                  const resp = await youtube.liveChatMessages.insert({
                    part: 'snippet',
                    requestBody: {
                      snippet: {
                        liveChatId: liveChatId,
                        type: 'textMessageEvent',
                        textMessageDetails: {
                    messageText: formatMessage(MESSAGES.contest.attemptsExhausted, {
                      author,
                      MAX_ATTEMPTS,
                      lastAttempt: lastAttemptWasExhausted[author] || 'unknown'
                    })
                  }
                      }
                    }
                  });
                  if (ENABLE_LOGS) {
                    fs.appendFileSync(ATTEMPTS_EXHAUSTED_LOG_FILE, `[${new Date().toISOString()}] Exhausted attempts announced to ${author}: ${JSON.stringify(resp.data)}\n`);
                  }
                  exhaustedAttemptsAnnounced[author] = true;
                } catch (err) {
                  console.error('Error sending exhausted attempts message:', err);
                }
              }
              continue;
            }
            logAttempt(author, text, '✅ Valid attempt');

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
              winnerAnnounced = true;
                clearTimeout(liveTimer); // Stop the live timer
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
                await youtube.liveChatMessages.insert({
                  part: 'snippet',
                  requestBody: {
                    snippet: {
                      liveChatId,
                      type: 'textMessageEvent',
                      textMessageDetails: {
                        messageText: formatMessage(MESSAGES.contest.exactWinner, {
                          author,
                          CORRECT_PRICE,
                          extraDiscount,
                          minute
                        })
                      }
                    }
                  }
                });
                await youtube.liveChatMessages.insert({
                  part: 'snippet',
                  requestBody: {
                    snippet: {
                      liveChatId,
                      type: 'textMessageEvent',
                      textMessageDetails: {
                        messageText: formatMessage(MESSAGES.contest.noMoreAttempts, {})
                      }
                    }
                  }
                });
                console.log("✅ Winner message sent!");
              } catch (err) {
                console.error('❌ Error sending winner message:', err);
              }
              return;
            }
          }
          if (pageToken) {
            await new Promise(resolve => setTimeout(resolve, pollingInterval));
          } else {
            keepGoing = false;
          }
        }
        setTimeout(pollChat, pollingInterval);
      } catch (err) {
        console.error('Error during polling:', err);
        setTimeout(pollChat, POLL_ERROR_RETRY);
      }
    }
    pollChat();
  });
}

// Reads credentials from the client_secret.json file
fs.readFile(CLIENT_SECRET_PATH, (err, content) => {
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
    return console.log(`Error reading ${CLIENT_SECRET_PATH}:`, err);
  }
  authorize(JSON.parse(content), listenChat);
});
