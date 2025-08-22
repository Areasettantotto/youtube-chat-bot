import fs from 'fs';
import path from 'path';
import { runSimulationFromConfig } from '../scripts/simulate_endgame.js';

function readLog(relPath) {
  const p = path.resolve(process.cwd(), relPath);
  if (!fs.existsSync(p)) return '';
  return fs.readFileSync(p, 'utf8');
}

describe('endgame - exhausted attempts near end are announced', () => {
  const logsDir = path.resolve(process.cwd(), 'logs');
  beforeEach(() => {
    if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir);
    // clear logs
    const br = path.resolve(logsDir, 'bot_responses.log');
    const va = path.resolve(logsDir, 'valid_attempts.log');
    if (fs.existsSync(br)) fs.unlinkSync(br);
    if (fs.existsSync(va)) fs.unlinkSync(va);
  });

  test('exhausted attempts are announced even when last attempt is near end', async () => {
    const config = {
      liveDurationSec: 2,
      maxAttempts: 1,
      correctPrice: 60.56,
      extraDiscountForNearest: true,
      extraDiscountPercent: 10,
      // one valid attempt at 0s by alice, second attempt at 1.9s by alice -> exhausted
      attempts: [
        { offsetSec: 0, user: 'alice', message: '59.5' },
        { offsetSec: 1.9, user: 'alice', message: '59.6' }
      ]
    };

    await runSimulationFromConfig(config, { silent: true });

    const botResponses = readLog('logs/bot_responses.log');
    const validAttempts = readLog('logs/valid_attempts.log');

    // Check exhausted announcement exists
    expect(botResponses).toMatch(/ATTEMPTS_EXHAUSTED/);

    // Ensure exhausted announcement occurs before NO_MORE_ATTEMPTS in the log
    const exhaustedIdx = botResponses.indexOf('ATTEMPTS_EXHAUSTED');
    const noMoreIdx = botResponses.indexOf('NO_MORE_ATTEMPTS');
    expect(exhaustedIdx).toBeGreaterThan(-1);
    expect(noMoreIdx).toBeGreaterThan(-1);
    expect(exhaustedIdx).toBeLessThan(noMoreIdx);
  }, 15000);
});
