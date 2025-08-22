#!/usr/bin/env node
// Lightweight endgame simulator for offline testing
// Usage (CLI): node scripts/simulate_endgame.js tests/mock_endgame.json
// Also exportable for in-process tests.

import fs from 'fs';
import path from 'path';

function timestamp() {
  return new Date().toISOString();
}

function ensureLogsDir() {
  const logsDir = path.resolve(process.cwd(), 'logs');
  if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });
}

function appendBotResponse(tag, text, silent) {
  const line = `${timestamp()} ${tag}: ${text}\n`;
  fs.appendFileSync(path.resolve('logs', 'bot_responses.log'), line);
  if (!silent) console.log(line.trim());
}

function appendValidAttempt(user, message, silent) {
  const line = `${timestamp()} ✅ Valid attempt ${user}: "${message}"\n`;
  fs.appendFileSync(path.resolve('logs', 'valid_attempts.log'), line);
  if (!silent) console.log(line.trim());
}

// In-memory collection of valid numeric attempts recorded during simulation
const recordedAttempts = [];
// Per-user attempt counter to simulate exhausted attempts announcements
const attemptsForUserSim = {};

function appendExactWinner(user, price, discount, minute, silent) {
  const text = `🎉 Complimenti ${user}! Hai indovinato il prezzo scontato esatto: €${price}. Puoi acquistare il pack con un extrasconto del ${discount}%. (Indovinato al minuto: ${minute})`;
  appendBotResponse('EXACT_WINNER', text, silent);
  const summary = `${timestamp()} EXACT WINNER: ${user} with €${price} - Extra discount: ${discount}% - Minute: ${minute}\n`;
  fs.appendFileSync(path.resolve('logs', 'valid_attempts.log'), summary);
}

function appendNoMoreAttempts(silent) {
  appendBotResponse('NO_MORE_ATTEMPTS', '⛔ Non è più possibile effettuare tentativi per nessuno.', silent);
}

function sleep(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

/**
 * Run a simulation from a config object.
 * config: { liveDurationSec, attempts: [{offsetSec,user,message}], correctPrice, extraDiscountPercent }
 * options: { silent }
 */
export async function runSimulationFromConfig(config, options = {}) {
  const silent = !!options.silent;
  ensureLogsDir();

  const { liveDurationSec, attempts, correctPrice, extraDiscountPercent } = config;

  appendBotResponse('CONTEST_START', `🤖 [BOT] 🟢 Inizio del concorso, da questo momento avete ${liveDurationSec} secondi di tempo e ${config.maxAttempts || 3} tentativi per ottenere extrasconti straordinari!!`, silent);

  let endTimer = null;
  let ended = false;
  const startTime = Date.now();

  endTimer = setTimeout(() => {
    if (ended) return;
    ended = true;
    // If extra-discount-for-the-nearest behavior is requested, compute closest
    try {
      const findClosestEnabled = !!config.extraDiscountForNearest || !!config.extraDiscountPercent;
      if (findClosestEnabled) {
        if (recordedAttempts.length === 0) {
          // no participants
          appendBotResponse('NO_PARTICIPANTS', `Time expired! The correct price was €${correctPrice}. Nobody participated in the contest!`, silent);
        } else {
          const target = parseFloat(String(correctPrice).replace(',', '.'));
          let closest = null;
          let minDistance = Infinity;
          for (const a of recordedAttempts) {
            const distance = Math.abs(a.value - target);
            if (distance < minDistance) {
              minDistance = distance;
              closest = a;
            }
          }
          if (closest) {
            const minute = Math.floor((closest.timestamp - startTime) / 60000) + 1;
            const extra = extraDiscountPercent || 0;
            const text = `⏰ Time expired! ${closest.user} got closest to the correct price €${correctPrice} with €${closest.value}. Get an extra discount of ${extra}%! (Attempt at minute: ${minute})`;
            appendBotResponse('CLOSEST_WINNER', text, silent);
            const summary = `${timestamp()} CLOSEST WINNER: ${closest.user} with €${closest.value} (distance: €${Math.abs(closest.value - target).toFixed(2)}) - Extra discount: ${extra}% - Minute: ${minute}\n`;
            fs.appendFileSync(path.resolve('logs', 'valid_attempts.log'), summary);
          }
        }
      }
    } catch (e) {
      if (!silent) console.error('Error computing closest winner in simulator:', e);
    }

    // Always append NO_MORE_ATTEMPTS after end processing
    appendNoMoreAttempts(silent);
  }, liveDurationSec * 1000);

  // schedule attempts
  for (const a of attempts) {
    const when = Math.max(0, a.offsetSec) * 1000;
    setTimeout(() => {
      if (ended) return; // ignore attempts after end
      appendValidAttempt(a.user, a.message, silent);
      // track per-user attempts for simulator-level exhausted announcements
      attemptsForUserSim[a.user] = (attemptsForUserSim[a.user] || 0) + 1;
      if (typeof config.maxAttempts === 'number' && attemptsForUserSim[a.user] > config.maxAttempts) {
        // announce exhausted attempts in simulator logs to mirror production behavior
        try {
          const exText = `⛔ ${a.user} has exceeded the maximum number of ${config.maxAttempts} attempts.`;
          appendBotResponse('ATTEMPTS_EXHAUSTED', exText, silent);
        } catch (e) {
          // ignore
        }
      }
      // record numeric attempts for closest-winner computation
      try {
        const norm = a.message.replace(',', '.').trim();
        const parsed = parseFloat(norm);
        if (!Number.isNaN(parsed)) {
          recordedAttempts.push({ user: a.user, message: a.message, value: parsed, timestamp: Date.now() });
        }
      } catch (e) {
        // ignore parse errors
      }
      // check exact match
      const norm = a.message.replace(',', '.').trim();
      const parsed = parseFloat(norm);
      const target = parseFloat(String(correctPrice).replace(',', '.'));
      if (!Number.isNaN(parsed) && Math.abs(parsed - target) < 0.001) {
        // winner detected — emulate race-fix ordering: cancel end timer BEFORE declaring winner
        if (endTimer) {
          clearTimeout(endTimer);
          endTimer = null;
        }
        // mark ended so no further attempts processed
        ended = true;
        // compute minute
        const minute = Math.floor((Date.now() - startTime) / 60000) + 1;
        appendExactWinner(a.user, parsed.toFixed(2), extraDiscountPercent || 60, minute, silent);
        appendNoMoreAttempts(silent);
      }
    }, when);
  }

  // wait until simulation end (+ small buffer)
  await sleep((liveDurationSec + 1) * 1000);
}

// CLI wrapper
if (process.argv[1] && process.argv[1].endsWith('simulate_endgame.js')) {
  async function main() {
    const arg = process.argv[2];
    if (!arg) {
      console.error('Usage: node scripts/simulate_endgame.js path/to/mock.json');
      process.exit(2);
    }
    const pathArg = path.resolve(process.cwd(), arg);
    if (!fs.existsSync(pathArg)) {
      console.error('File not found:', pathArg);
      process.exit(2);
    }
    const raw = fs.readFileSync(pathArg, 'utf8');
    const config = JSON.parse(raw);
    const silent = process.env.SILENT === '1' || process.argv.includes('--silent');
    await runSimulationFromConfig(config, { silent });
  }

  main().catch((err) => {
    console.error('Simulation failed:', err);
    process.exit(1);
  });
}
