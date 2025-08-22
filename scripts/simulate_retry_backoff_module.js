import dotenv from 'dotenv';
dotenv.config();

export async function simulateRetryBackoff({
  message = 'Hello',
  API_RETRY_ATTEMPTS = parseInt(process.env.API_RETRY_ATTEMPTS, 10) || 3,
  API_RETRY_DELAY = parseInt(process.env.API_RETRY_DELAY, 10) || 500,
  SIM_FAIL_COUNT = parseInt(process.env.SIM_FAIL_COUNT || '2', 10)
} = {}) {
  const logs = [];
  for (let attempt = 1; attempt <= API_RETRY_ATTEMPTS; attempt++) {
    const willFail = attempt <= SIM_FAIL_COUNT;
    const ts = new Date().toISOString();
    logs.push({ ts, attempt, result: willFail ? 'FAIL' : 'SUCCESS' });
    console.log(`[${ts}] [SIM_BACKOFF] Attempt ${attempt}/${API_RETRY_ATTEMPTS} - simulated ${willFail ? 'FAIL' : 'SUCCESS'}`);

    if (!willFail) {
      const ts2 = new Date().toISOString();
      console.log(`[${ts2}] [SIM_BACKOFF] ✅ Success at attempt ${attempt}`);
      return { ok: true, attempt, logs };
    }

    if (attempt === API_RETRY_ATTEMPTS) {
      const ts3 = new Date().toISOString();
      console.log(`[${ts3}] [SIM_BACKOFF] ❌ Final attempt failed (reached max attempts)`);
      throw new Error('Simulated final failure');
    }

    const retryDelay = API_RETRY_DELAY * (2 ** (attempt - 1));
    const ts4 = new Date().toISOString();
    console.log(`[${ts4}] [SIM_BACKOFF] Waiting ${retryDelay}ms before next attempt (exponential backoff)`);
    logs.push({ ts: ts4, wait: retryDelay });
    await new Promise(r => setTimeout(r, retryDelay));
  }
}

// CLI wrapper for backward compatibility
if (typeof process !== 'undefined' && process.argv && process.argv[1] && process.argv[1].endsWith('simulate_retry_backoff_module.js')) {
  simulateRetryBackoff({ message: process.argv.slice(2).join(' ') }).catch(err => {
    console.error(err);
    process.exit(2);
  });
}
