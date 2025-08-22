import fs from 'fs';
import path from 'path';
import { runSimulationFromConfig } from '../scripts/simulate_endgame.js';

function readLog(relPath) {
  const p = path.resolve(process.cwd(), relPath);
  if (!fs.existsSync(p)) return '';
  return fs.readFileSync(p, 'utf8');
}

describe('endgame - multiple users exhausted near end', () => {
  const logsDir = path.resolve(process.cwd(), 'logs');
  beforeEach(() => {
    if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });
    const br = path.resolve(logsDir, 'bot_responses.log');
    const va = path.resolve(logsDir, 'valid_attempts.log');
    if (fs.existsSync(br)) fs.unlinkSync(br);
    if (fs.existsSync(va)) fs.unlinkSync(va);
  });

  test('ten users get exhausted announcement in the last 10s', async () => {
    const users = Array.from({ length: 10 }, (_, i) => `user${i + 1}`);
    const liveDurationSec = 20; // total live
    const maxAttempts = 1; // second attempt triggers exhausted

    // schedule: first attempt early (1s), second (exhausting) in last 10s
    const attempts = [];
    for (const u of users) {
      attempts.push({ offsetSec: 1, user: u, message: '50' });
      // place exhausted attempt at liveDurationSec - 5 (within last 10s)
      attempts.push({ offsetSec: liveDurationSec - 5, user: u, message: '50.1' });
    }

    const config = {
      liveDurationSec,
      maxAttempts,
      correctPrice: 60.56,
      extraDiscountForNearest: true,
      extraDiscountPercent: 10,
      attempts
    };

    await runSimulationFromConfig(config, { silent: true });

    const botResponses = readLog('logs/bot_responses.log');
    // Ensure each user has an exhausted announcement
    for (const u of users) {
      expect(botResponses).toMatch(new RegExp(`${u}`));
    }

    // Count ATTEMPTS_EXHAUSTED occurrences
    const exhaustedMatches = (botResponses.match(/ATTEMPTS_EXHAUSTED/g) || []);
    expect(exhaustedMatches.length).toBeGreaterThanOrEqual(users.length);

    // Ensure exhausted announcements appear before NO_MORE_ATTEMPTS
    const exhaustedIdx = botResponses.indexOf('ATTEMPTS_EXHAUSTED');
    const noMoreIdx = botResponses.indexOf('NO_MORE_ATTEMPTS');
    expect(exhaustedIdx).toBeGreaterThanOrEqual(0);
    expect(noMoreIdx).toBeGreaterThanOrEqual(0);
    expect(exhaustedIdx).toBeLessThan(noMoreIdx);
  }, 30000);
});
