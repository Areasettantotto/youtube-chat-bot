import fs from 'fs';
import { google } from 'googleapis';
import dotenv from 'dotenv';

dotenv.config();

// Configuration constants
const CORRECT_PRICE = process.env.CORRECT_PRICE;
const MAX_ATTEMPTS = parseInt(process.env.MAX_ATTEMPTS, 10); // Default to 10 attempts if not specified
const LIVE_DURATION_MINUTES = parseInt(process.env.LIVE_DURATION, 10) || 30; // Live duration in minutes, default 30
// Configurable extra discount thresholds
const EXTRADISCOUNT_THRESHOLDS = [
  { min: 0, max: 10, sconto: 80 },
  { min: 11, max: 20, sconto: 70 },
  { min: 21, max: LIVE_DURATION_MINUTES, sconto: 60 }
];
const LOGS_DIR = process.env.LOGS_DIR || 'logs';
const DISCARDS_LOG_FILE = process.env.DISCARDS_LOG_FILE || `${LOGS_DIR}/discarded_attempts.log`;
const LOG_ATTEMPTS_SUCCESS_FILE = process.env.LOG_ATTEMPTS_SUCCESS_FILE || `${LOGS_DIR}/valid_attempts.log`;
const ERROR_STARTING_LOG_FILE = process.env.ERROR_STARTING_LOG_FILE || `${LOGS_DIR}/startup_errors.json`;
const ATTEMPTS_EXHAUSTED_LOG_FILE = process.env.ATTEMPTS_EXHAUSTED_LOG_FILE || `${LOGS_DIR}/exhausted_attempts.log`;
const EXTRA_DISCOUNT_FOR_THE_NEAREST = process.env.EXTRA_DISCOUNT_FOR_THE_NEAREST === 'true';
const tentativiPerUtente = {};
const tentativiUtente = {}; // Stores all attempts with timestamp
const tentativiEsauritiAnnunciati = {}; // Tracks users who have already received the attempts exhausted message
const ultimoTentativoEsaurito = {}; // Stores the last exhausted attempt per user
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
  console.log(`📁 Directory ${LOGS_DIR} creata automaticamente`);
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
    console.log('🔑 Apro il browser per autorizzare il bot...');
    // Open the browser automatically on all platforms
    try {
      const open = (await import('open')).default;
      await open(authUrl);
    } catch (e) {
      console.log('❌ Impossibile aprire il browser automaticamente. Apri manualmente questo URL:', authUrl);
    }
    process.stdout.write('👉 Incolla qui il codice di autorizzazione: ');
    process.stdin.setEncoding('utf8');
    process.stdin.once('data', async (code) => {
      code = code.trim();
      try {
        const { tokens } = await oAuth2Client.getToken(code);
        oAuth2Client.setCredentials(tokens);
        fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens));
        console.log('✅ Token salvato in token.json');
        callback(oAuth2Client);
      } catch (err) {
        console.error('❌ Errore durante il salvataggio del token:', err.message || err);
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
      console.error('❌ Errore nel recupero della live:', err.message || err);
      return;
    }
    const broadcasts = res.data.items;
    if (!broadcasts || broadcasts.length === 0) {
      console.error('❌ Nessuna live trovata nel tuo canale.');
      return;
    }
    // Find the active live (status.lifeCycleStatus === 'live')
    const live = broadcasts.find(b => b.status && b.status.lifeCycleStatus === 'live');
    if (!live) {
      console.error('❌ Nessuna live attiva trovata.');
      return;
    }
    const liveChatId = live.snippet.liveChatId;
    if (!liveChatId) {
      console.error('❌ Nessun liveChatId trovato nella live attiva.');
      return;
    }
    callback(liveChatId);
  });
}

function listenChat(auth) {
  const youtube = google.youtube({ version: 'v3', auth });

  // Initialize chat polling
  getLiveChatId(youtube, (liveChatId) => {
    console.log('🚀 In ascolto della chat...');
    // Game start message
    const msgAvvio = `🟢 Inizio del concorso, da questo momento avete ${LIVE_DURATION_MINUTES} minuti di tempo e ${MAX_ATTEMPTS} tentativi per ottenere extrasconti straordinari!!`;
    console.log(msgAvvio);
    // Send the message also to the chat
    youtube.liveChatMessages.insert({
      part: 'snippet',
      requestBody: {
        snippet: {
          liveChatId,
          type: 'textMessageEvent',
          textMessageDetails: {
            messageText: msgAvvio
          }
        }
      }
    }).catch((err) => {
      console.error('❌ Errore nell\'invio del messaggio di avvio concorso in chat:', err);
    });

    // Initialize polling variables
    let nextPageToken = null;
    const processedMessageIds = new Set();
    let liveStartTime = null;

    // Function to log attempts
    function logAttempt(author, text, status) {
      if (!ENABLE_LOGS) return;
      const log = `[${new Date().toISOString()}] ${status} ${author}: "${text}"\n`;
      if (status === '✅ Tentativo valido') {
        fs.appendFileSync(LOG_ATTEMPTS_SUCCESS_FILE, log);
      } else {
        fs.appendFileSync(DISCARDS_LOG_FILE, log);
      }
      console.log(log.trim());
    }

    // Set to track unique participants
    const partecipantiUnici = new Set();
    function logNuovoPartecipante(author) {
      if (!partecipantiUnici.has(author)) {
        partecipantiUnici.add(author);
        const totale = partecipantiUnici.size;
        const log = `[${new Date().toISOString()}] nuovo partecipante (${author}) (Totali: ${totale})\n`;
        fs.appendFileSync(LOG_ATTEMPTS_SUCCESS_FILE, log);
        console.log(log.trim());
      }
    }

    // Function to calculate the extra discount based on minute
    // Automatic function to calculate extra discount based on minute
    function calcolaExtrasconto(minuto) {
      for (const soglia of EXTRADISCOUNT_THRESHOLDS) {
        if (minuto >= soglia.min && minuto <= soglia.max) {
          return soglia.sconto;
        }
      }
      return 0;
    }

    // Function to find who got closest to the correct price
    function trovaPiuVicino() {
      if (!EXTRA_DISCOUNT_FOR_THE_NEAREST) return null;

      let piuVicino = null;
      let distanzaMinima = Infinity;

      const prezzoGiusto = parseFloat(CORRECT_PRICE);

      for (const [utente, tentativi] of Object.entries(tentativiUtente)) {
        for (const tentativo of tentativi) {
          const distanza = Math.abs(tentativo.valore - prezzoGiusto);
          if (distanza < distanzaMinima) {
            distanzaMinima = distanza;
            piuVicino = {
              utente,
              valore: tentativo.valore,
              timestamp: tentativo.timestamp
            };
          }
        }
      }

      return piuVicino;
    }

    // Timer for live duration
    const liveTimer = setTimeout(async () => {
      console.log(`⏰ Tempo scaduto: ${LIVE_DURATION_MINUTES} minuti di live completati.`);

      // First, send the exhausted attempts messages for those who haven't received them yet
      for (const [author, tentativi] of Object.entries(tentativiPerUtente)) {
        if (tentativi > MAX_ATTEMPTS && !tentativiEsauritiAnnunciati[author]) {
          try {
            await youtube.liveChatMessages.insert({
              part: 'snippet',
              requestBody: {
                snippet: {
                  liveChatId,
                  type: 'textMessageEvent',
                  textMessageDetails: {
                    messageText: `⛔ ${author}, hai superato il numero massimo di ${MAX_ATTEMPTS} tentativi disponibili. Il tuo ultimo tentativo ${ultimoTentativoEsaurito[author] || 'sconosciuto'} non verrà considerato valido.`
                  }
                }
              }
            });
            if (ENABLE_LOGS) {
              fs.appendFileSync(ATTEMPTS_EXHAUSTED_LOG_FILE, `[${new Date().toISOString()}] Tentativi esauriti annunciati a fine gioco a ${author}\n`);
            }
            tentativiEsauritiAnnunciati[author] = true;
            console.log(`✅ Messaggio di tentativi esauriti inviato a ${author} a fine gioco`);
          } catch (err) {
            console.error(`❌ Errore nell'invio del messaggio di tentativi esauriti a ${author}:`, err);
          }
        }
      }

      // Add a small delay to ensure the correct order of messages
      await new Promise(resolve => setTimeout(resolve, MESSAGE_DELAY));

      // Then send the game closing message
      if (!winnerAnnounced) {
        if (EXTRA_DISCOUNT_FOR_THE_NEAREST) {
            // With extra discount for the nearest: show the price and find the closest winner
          const piuVicino = trovaPiuVicino();
          if (piuVicino) {
            const { utente, valore, timestamp } = piuVicino;
            const msgTime = new Date(timestamp);
            const minuto = Math.floor((msgTime - liveStartTime) / 60000) + 1;
            const extrasconto = calcolaExtrasconto(minuto);

            if (ENABLE_LOGS) {
              fs.appendFileSync(LOG_ATTEMPTS_SUCCESS_FILE, `[${new Date().toISOString()}] PREMIO AL PIÙ VICINO: ${utente} con €${valore} (distanza: €${Math.abs(valore - parseFloat(CORRECT_PRICE)).toFixed(2)}) - Extrasconto: ${extrasconto}% - Minuto: ${minuto}\n`);
            }

            try {
              await youtube.liveChatMessages.insert({
                part: 'snippet',
                requestBody: {
                  snippet: {
                    liveChatId,
                    type: 'textMessageEvent',
                    textMessageDetails: {
                      messageText: `⏰ Tempo scaduto! ${utente} si è avvicinato di più al prezzo giusto €${CORRECT_PRICE} con €${valore}. Ottieni un extrasconto del ${extrasconto}%! (Tentativo al minuto: ${minuto})`
                    }
                  }
                }
              });
              console.log(`✅ Messaggio di premio al più vicino inviato a ${utente}!`);
            } catch (err) {
              console.error('❌ Errore nell\'invio del messaggio del premio al più vicino:', err);
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
                      messageText: `⏰ Tempo scaduto! Il prezzo giusto era €${CORRECT_PRICE}. Nessuno ha partecipato al concorso!`
                    }
                  }
                }
              });
              console.log("✅ Messaggio di fine gioco inviato!");
            } catch (err) {
              console.error('❌ Errore nell\'invio del messaggio di fine gioco:', err);
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
                    messageText: `⏰ Tempo scaduto! Nessun vincitore questa volta!`
                  }
                }
              }
            });
            console.log("✅ Messaggio di fine gioco inviato!");
          } catch (err) {
            console.error('❌ Errore nell\'invio del messaggio di fine gioco:', err);
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
            logNuovoPartecipante(author);

            // Only numbers without spaces, letters, or other symbols (only digits and an optional decimal point)
            if (!/^\d+(\.\d+)?$/.test(text)) {
              logAttempt(author, text, '❌ Formato non valido (solo numeri, punto come separatore decimale, nessun altro carattere o spazio)');
              continue;
            }

            const parsed = parseFloat(text);
            if (typeof parsed !== 'number' || isNaN(parsed)) {
              logAttempt(author, text, '❌ Non è un numero valido');
              continue;
            }
            const numero = parsed;
            if (!tentativiPerUtente[author]) tentativiPerUtente[author] = 0;
            if (!tentativiEsauritiAnnunciati[author]) tentativiEsauritiAnnunciati[author] = false;

            tentativiPerUtente[author]++;

            if (tentativiPerUtente[author] > MAX_ATTEMPTS) {
                ultimoTentativoEsaurito[author] = numero; // Save the last exhausted attempt
              logAttempt(author, text, '⚠️ Tentativi esauriti');
              if (!tentativiEsauritiAnnunciati[author]) {
                try {
                  const resp = await youtube.liveChatMessages.insert({
                    part: 'snippet',
                    requestBody: {
                      snippet: {
                        liveChatId: liveChatId,
                        type: 'textMessageEvent',
                        textMessageDetails: {
                    messageText: `⛔ ${author}, hai superato il numero massimo di ${MAX_ATTEMPTS} tentativi disponibili. Il tuo ultimo tentativo ${ultimoTentativoEsaurito[author] || 'sconosciuto'} non verrà considerato valido.`
                  }
                      }
                    }
                  });
                  if (ENABLE_LOGS) {
                    fs.appendFileSync(ATTEMPTS_EXHAUSTED_LOG_FILE, `[${new Date().toISOString()}] Tentativi esauriti annunciati a ${author}: ${JSON.stringify(resp.data)}\n`);
                  }
                  tentativiEsauritiAnnunciati[author] = true;
                } catch (err) {
                  console.error('Errore nell\'invio del messaggio di tentativi esauriti:', err);
                }
              }
              continue;
            }
            logAttempt(author, text, '✅ Tentativo valido');

            // Save the attempt with timestamp if enabled (only for valid attempts)
            if (EXTRA_DISCOUNT_FOR_THE_NEAREST) {
              if (!tentativiUtente[author]) {
                tentativiUtente[author] = [];
              }
              tentativiUtente[author].push({
                valore: numero,
                timestamp: new Date(msg.snippet.publishedAt).toISOString()
              });
            }

            // Send the victory message in chat to the user who guessed the exact price!!
            if (!winnerAnnounced && numero === parseFloat(CORRECT_PRICE)) {
              winnerAnnounced = true;
                clearTimeout(liveTimer); // Stop the live timer
                // Calculate the minute at which the guess was made
              let extrasconto = 0;
              let minuto = 0;
              if (liveStartTime) {
                const msgTime = new Date(msg.snippet.publishedAt);
                minuto = Math.floor((msgTime - liveStartTime) / 60000) + 1;
                extrasconto = calcolaExtrasconto(minuto);
              }
              try {
                await youtube.liveChatMessages.insert({
                  part: 'snippet',
                  requestBody: {
                    snippet: {
                      liveChatId,
                      type: 'textMessageEvent',
                      textMessageDetails: {
                        messageText: `🎉 Complimenti ${author}! Hai indovinato il prezzo scontato esatto: €${CORRECT_PRICE}. Puoi acquistare il pack con un extrasconto del ${extrasconto}%. (Indovinato al minuto: ${minuto})`
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
                        messageText: '⛔ Non è più possibile effettuare tentativi per nessuno.'
                      }
                    }
                  }
                });
                console.log("✅ Messaggio di vincita inviato!");
              } catch (err) {
                console.error('❌ Errore nell\'invio del messaggio di vincita:', err);
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
        console.error('Errore durante il polling:', err);
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
      error: 'Errore nel leggere client_secret.json',
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
    return console.log('Errore nel leggere client_secret.json:', err);
  }
  authorize(JSON.parse(content), listenChat);
});
