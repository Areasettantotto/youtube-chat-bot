import fs from 'fs';
import { google } from 'googleapis';
import dotenv from 'dotenv';

dotenv.config();

// Costanti di configurazione
const PREZZO_GIUSTO = process.env.PREZZO_GIUSTO;
const MAX_TENTATIVI = parseInt(process.env.MAX_TENTATIVI, 10); // Default a 10 tentativi se non specificato
const DURATA_LIVE_MINUTI = parseInt(process.env.DURATA_LIVE, 10) || 30; // Durata live in minuti, default 30
// Soglie extrasconto configurabili
const EXTRASCONTO_THRESHOLDS = [
  { min: 0, max: 10, sconto: 80 },
  { min: 11, max: 20, sconto: 70 },
  { min: 21, max: DURATA_LIVE_MINUTI, sconto: 60 }
];
const LOGS_DIR = 'logs';
const SCARTI_LOG_FILE = process.env.SCARTI_LOG_FILE || `${LOGS_DIR}/tentativi_scartati.log`;
const LOG_TENTATIVI_OK_FILE = process.env.LOG_TENTATIVI_OK_FILE || `${LOGS_DIR}/tentativi_ok.log`;
const ERRORI_AVVIO_LOG_FILE = `${LOGS_DIR}/errori_avvio.json`;
const TENTATIVI_ESAURITI_LOG_FILE = `${LOGS_DIR}/tentativi_esauriti.log`;
const EXTRASCONTO_AL_PIU_VICINO = process.env.EXTRASCONTO_AL_PIU_VICINO === 'true';
const tentativiPerUtente = {};
const tentativiUtente = {}; // Salva tutti i tentativi con timestamp
const tentativiEsauritiAnnunciati = {}; // Traccia chi ha già ricevuto il messaggio di tentativi esauriti
const ultimoTentativoEsaurito = {}; // Salva l'ultimo tentativo esaurito per utente
let winnerAnnounced = false;

// Configurazione OAuth2
const SCOPES = ['https://www.googleapis.com/auth/youtube.force-ssl'];
const TOKEN_PATH = 'token.json';


// Abilita/disabilita i log
const ENABLE_LOGS = process.env.ENABLE_LOGS === 'true';

// Funzione di autorizzazione per l'API YouTube
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
    // Apri il browser automaticamente su tutte le piattaforme
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
// Recupera l'ID della live chat attiva dal canale YouTube
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
    // Cerca la live attiva (status.lifeCycleStatus === 'live')
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

  // Inizializza il polling della chat
  getLiveChatId(youtube, (liveChatId) => {
    console.log('🚀 In ascolto della chat...');
    // Messaggio di avvio concorso
    const msgAvvio = `🟢 Inizio del concorso, da questo momento avete ${DURATA_LIVE_MINUTI} minuti di tempo e ${MAX_TENTATIVI} tentativi per ottenere extrasconti straordinari!!`;
    console.log(msgAvvio);
    // Invia il messaggio anche nella chat
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

    // Inizializza variabili per il polling
    let nextPageToken = null;
    const processedMessageIds = new Set();
    let liveStartTime = null;

    // Funzione per loggare i tentativi
    function logAttempt(author, text, status) {
      if (!ENABLE_LOGS) return;
      const log = `[${new Date().toISOString()}] ${status} ${author}: "${text}"\n`;
      if (status === '✅ Tentativo valido') {
        fs.appendFileSync(LOG_TENTATIVI_OK_FILE, log);
      } else {
        fs.appendFileSync(SCARTI_LOG_FILE, log);
      }
      console.log(log.trim());
    }

    // Set per tracciare i partecipanti unici
    const partecipantiUnici = new Set();
    function logNuovoPartecipante(author) {
      if (!partecipantiUnici.has(author)) {
        partecipantiUnici.add(author);
        const totale = partecipantiUnici.size;
        const log = `[${new Date().toISOString()}] nuovo partecipante (${author}) (Totali: ${totale})\n`;
        fs.appendFileSync(LOG_TENTATIVI_OK_FILE, log);
        console.log(log.trim());
      }
    }

    // Funzione per calcolare l'extrasconto in base al minuto
    // Funzione automatica per calcolare l'extrasconto in base al minuto
    function calcolaExtrasconto(minuto) {
      for (const soglia of EXTRASCONTO_THRESHOLDS) {
        if (minuto >= soglia.min && minuto <= soglia.max) {
          return soglia.sconto;
        }
      }
      return 0;
    }

    // Funzione per trovare chi si è avvicinato di più al prezzo giusto
    function trovaPiuVicino() {
      if (!EXTRASCONTO_AL_PIU_VICINO) return null;

      let piuVicino = null;
      let distanzaMinima = Infinity;

      const prezzoGiusto = parseFloat(PREZZO_GIUSTO);

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

    // Timer per la durata della live
    const liveTimer = setTimeout(async () => {
      console.log(`⏰ Tempo scaduto: ${DURATA_LIVE_MINUTI} minuti di live completati.`);

      // Prima invia i messaggi di tentativi esauriti per chi non li ha ancora ricevuti
      for (const [author, tentativi] of Object.entries(tentativiPerUtente)) {
        if (tentativi > MAX_TENTATIVI && !tentativiEsauritiAnnunciati[author]) {
          try {
            await youtube.liveChatMessages.insert({
              part: 'snippet',
              requestBody: {
                snippet: {
                  liveChatId,
                  type: 'textMessageEvent',
                  textMessageDetails: {
                    messageText: `⛔ ${author}, hai superato il numero massimo di ${MAX_TENTATIVI} tentativi disponibili. Il tuo ultimo tentativo ${ultimoTentativoEsaurito[author] || 'sconosciuto'} non verrà considerato valido.`
                  }
                }
              }
            });
            if (ENABLE_LOGS) {
              fs.appendFileSync(TENTATIVI_ESAURITI_LOG_FILE, `[${new Date().toISOString()}] Tentativi esauriti annunciati a fine gioco a ${author}\n`);
            }
            tentativiEsauritiAnnunciati[author] = true;
            console.log(`✅ Messaggio di tentativi esauriti inviato a ${author} a fine gioco`);
          } catch (err) {
            console.error(`❌ Errore nell'invio del messaggio di tentativi esauriti a ${author}:`, err);
          }
        }
      }

      // Aggiungi un piccolo delay per assicurare l'ordine corretto dei messaggi
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Poi invia il messaggio di chiusura del gioco
      if (!winnerAnnounced) {
        if (EXTRASCONTO_AL_PIU_VICINO) {
          // Con extrasconto al più vicino: mostra il prezzo e cerca il vincitore più vicino
          const piuVicino = trovaPiuVicino();
          if (piuVicino) {
            const { utente, valore, timestamp } = piuVicino;
            const msgTime = new Date(timestamp);
            const minuto = Math.floor((msgTime - liveStartTime) / 60000) + 1;
            const extrasconto = calcolaExtrasconto(minuto);

            if (ENABLE_LOGS) {
              fs.appendFileSync(LOG_TENTATIVI_OK_FILE, `[${new Date().toISOString()}] PREMIO AL PIÙ VICINO: ${utente} con €${valore} (distanza: €${Math.abs(valore - parseFloat(PREZZO_GIUSTO)).toFixed(2)}) - Extrasconto: ${extrasconto}% - Minuto: ${minuto}\n`);
            }

            try {
              await youtube.liveChatMessages.insert({
                part: 'snippet',
                requestBody: {
                  snippet: {
                    liveChatId,
                    type: 'textMessageEvent',
                    textMessageDetails: {
                      messageText: `⏰ Tempo scaduto! ${utente} si è avvicinato di più al prezzo giusto €${PREZZO_GIUSTO} con €${valore}. Ottieni un extrasconto del ${extrasconto}%! (Tentativo al minuto: ${minuto})`
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
                      messageText: `⏰ Tempo scaduto! Il prezzo giusto era €${PREZZO_GIUSTO}. Nessuno ha partecipato al concorso!`
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
          // Senza extrasconto al più vicino: NON mostrare il prezzo
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
    }, DURATA_LIVE_MINUTI * 60 * 1000);

    // Funzione iniziale per il polling della chat
    async function pollChat() {
      try {
        let pageToken = nextPageToken;
        let keepGoing = true;
        // Intervalli di polling dinamici (in ms)
        const MIN_POLLING = 3000;   // 3 secondi
        const MID_POLLING = 10000;  // 10 secondi
        const MAX_POLLING = 60000;  // 60 secondi
        let pollingInterval = MIN_POLLING; // default

        while (keepGoing) {
          const res = await youtube.liveChatMessages.list({
            liveChatId,
            part: 'snippet,authorDetails',
            pageToken: pageToken,
          });

          // Imposta l'orario di inizio live dalla prima chiamata
          if (!liveStartTime && res.data.items.length > 0) {
            liveStartTime = new Date(res.data.items[0].snippet.publishedAt);
          }

          // Usa sempre il valore massimo tra pollingIntervalMillis e quello calcolato dinamicamente
          if (res.data.pollingIntervalMillis)
            pollingInterval = Math.max(res.data.pollingIntervalMillis, pollingInterval);

          pageToken = res.data.nextPageToken;
          if (!nextPageToken) nextPageToken = pageToken;
          const messages = res.data.items;

          // --- LOGICA DINAMICA ---
          // Regola il polling dinamicamente in base al traffico
          if (messages.length > 10) {
            pollingInterval = MIN_POLLING; // traffico alto: poll rapido
          } else if (messages.length > 2) {
            pollingInterval = MID_POLLING; // traffico medio
          } else {
            pollingInterval = MAX_POLLING; // traffico basso: poll lento
          }
          // --- FINE LOGICA DINAMICA ---

          // Ordina i messaggi per publishedAt (ordine cronologico crescente)
          messages.sort((a, b) => new Date(a.snippet.publishedAt) - new Date(b.snippet.publishedAt));

          for (const msg of messages) {
            const msgId = msg.id;
            if (processedMessageIds.has(msgId)) continue;
            processedMessageIds.add(msgId);

            let text = msg.snippet.textMessageDetails?.messageText;
            const author = msg.authorDetails.displayName;
            if (!text) continue;

            // Logga nuovo partecipante se è la prima volta che scrive
            logNuovoPartecipante(author);

            // Solo numeri senza spazi, lettere o altri simboli (solo cifre e opzionale punto decimale)
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

            if (tentativiPerUtente[author] > MAX_TENTATIVI) {
              ultimoTentativoEsaurito[author] = numero; // Salva l'ultimo tentativo esaurito
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
                    messageText: `⛔ ${author}, hai superato il numero massimo di ${MAX_TENTATIVI} tentativi disponibili. Il tuo ultimo tentativo ${ultimoTentativoEsaurito[author] || 'sconosciuto'} non verrà considerato valido.`
                  }
                      }
                    }
                  });
                  if (ENABLE_LOGS) {
                    fs.appendFileSync(TENTATIVI_ESAURITI_LOG_FILE, `[${new Date().toISOString()}] Tentativi esauriti annunciati a ${author}: ${JSON.stringify(resp.data)}\n`);
                  }
                  tentativiEsauritiAnnunciati[author] = true;
                } catch (err) {
                  console.error('Errore nell\'invio del messaggio di tentativi esauriti:', err);
                }
              }
              continue;
            }
            logAttempt(author, text, '✅ Tentativo valido');

            // Salva il tentativo con timestamp se abilitato (solo per tentativi validi)
            if (EXTRASCONTO_AL_PIU_VICINO) {
              if (!tentativiUtente[author]) {
                tentativiUtente[author] = [];
              }
              tentativiUtente[author].push({
                valore: numero,
                timestamp: new Date(msg.snippet.publishedAt).toISOString()
              });
            }

            // Invia il messaggio di vittoria in chat all'utente che ha indovinato il prezzo esatto!!
            if (!winnerAnnounced && numero === parseFloat(PREZZO_GIUSTO)) {
              winnerAnnounced = true;
              clearTimeout(liveTimer); // Ferma il timer della live
              // Calcola il minuto in cui è stato indovinato
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
                        messageText: `🎉 Complimenti ${author}! Hai indovinato il prezzo scontato esatto: €${PREZZO_GIUSTO}. Puoi acquistare il pack con un extrasconto del ${extrasconto}%. (Indovinato al minuto: ${minuto})`
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
        setTimeout(pollChat, 10000);
      }
    }
    pollChat();
  });
}

// Legge le credenziali dal file client_secret.json
fs.readFile('client_secret.json', (err, content) => {
  if (err) {
    const errorLog = {
      timestamp: new Date().toISOString(),
      error: 'Errore nel leggere client_secret.json',
      details: err.message || err
    };
    let logs = [];
    if (fs.existsSync(ERRORI_AVVIO_LOG_FILE)) {
      try {
        logs = JSON.parse(fs.readFileSync(ERRORI_AVVIO_LOG_FILE));
      } catch (e) {
        logs = [];
      }
    }
    logs.push(errorLog);
    fs.writeFileSync(ERRORI_AVVIO_LOG_FILE, JSON.stringify(logs, null, 2));
    return console.log('Errore nel leggere client_secret.json:', err);
  }
  authorize(JSON.parse(content), listenChat);
});
