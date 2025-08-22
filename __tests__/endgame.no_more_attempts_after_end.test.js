import fs from 'fs';
import path from 'path';
import { runSimulationFromConfig } from '../scripts/simulate_endgame.js';

function readLog(relPath) {
  const p = path.resolve(process.cwd(), relPath);
  if (!fs.existsSync(p)) return '';
  return fs.readFileSync(p, 'utf8');
}

describe('endgame - no attempts accepted after LIVE_DURATION', () => {
  const logsDir = path.resolve(process.cwd(), 'logs');
  beforeEach(() => {
    if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir);
    // clear logs
    const br = path.resolve(logsDir, 'bot_responses.log');
    const va = path.resolve(logsDir, 'valid_attempts.log');
    if (fs.existsSync(br)) fs.unlinkSync(br);
    if (fs.existsSync(va)) fs.unlinkSync(va);
  });

  test('attempts submitted after live duration are ignored', async () => {
    const config = {
      liveDurationSec: 1,
      maxAttempts: 3,
      correctPrice: 50.0,
      extraDiscountForNearest: true,
      extraDiscountPercent: 10,
      // one attempt at start (should be recorded), one after 2s (after end) which must be ignored
      attempts: [
        { offsetSec: 0, user: 'alice', message: '50' },
        { offsetSec: 2, user: 'bob', message: '49.99' }
      ]
    };

    await runSimulationFromConfig(config, { silent: true });

    const botResponses = readLog('logs/bot_responses.log');
    const validAttempts = readLog('logs/valid_attempts.log');

    // Simulator should always append NO_MORE_ATTEMPTS
    expect(botResponses).toMatch(/NO_MORE_ATTEMPTS/);

    // The valid attempts log should contain alice's attempt
    expect(validAttempts).toMatch(/alice/);

    // And should NOT contain bob's late attempt
    expect(validAttempts).not.toMatch(/bob/);
  }, 10000);
});
