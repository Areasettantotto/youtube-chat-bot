#!/usr/bin/env node
import dotenv from 'dotenv';
dotenv.config();

const API_RETRY_ATTEMPTS = parseInt(process.env.API_RETRY_ATTEMPTS, 10) || 4;
const API_RETRY_DELAY = parseInt(process.env.API_RETRY_DELAY, 10) || 500; // base ms
const SIM_FAIL_COUNT = parseInt(process.env.SIM_FAIL_COUNT || '2', 10); // how many attempts should fail before success

async function sendMessageWithRetryMock(messageText, context = 'TEST') {
  console.log(`Simulation start: message="${messageText}", attempts=${API_RETRY_ATTEMPTS}, baseDelay=${API_RETRY_DELAY}ms, simulatedFailures=${SIM_FAIL_COUNT}`);

  for (let attempt = 1; attempt <= API_RETRY_ATTEMPTS; attempt++) {
    const willFail = attempt <= SIM_FAIL_COUNT;
    const ts = new Date().toISOString();
    console.log(`[${ts}] [${context}] Attempt ${attempt}/${API_RETRY_ATTEMPTS} - ${willFail ? 'simulated FAIL' : 'simulated SUCCESS'}`);

    if (!willFail) {
      const ts2 = new Date().toISOString();
      console.log(`[${ts2}] [${context}] ✅ Success at attempt ${attempt}`);
      return { ok: true, attempt };
    }

    if (attempt === API_RETRY_ATTEMPTS) {
      const ts3 = new Date().toISOString();
      console.log(`[${ts3}] [${context}] ❌ Final attempt failed (reached max attempts)`);
      throw new Error('Simulated final failure');
    }

    // Exponential backoff: API_RETRY_DELAY * 2^(attempt-1)
    const retryDelay = API_RETRY_DELAY * (2 ** (attempt - 1));
    const ts4 = new Date().toISOString();
    console.log(`[${ts4}] [${context}] Waiting ${retryDelay}ms before next attempt (exponential backoff)`);
    await new Promise(r => setTimeout(r, retryDelay));
  }
}

async function main() {
  const message = process.argv.slice(2).join(' ') || 'Hello from backoff simulator';
  try {
    await sendMessageWithRetryMock(message, 'SIM_BACKOFF');
    console.log('Simulation completed: message delivered.');
    process.exit(0);
  } catch (err) {
    console.error('Simulation completed: message FAILED ->', err.message);
    process.exit(2);
  }
}

main();
