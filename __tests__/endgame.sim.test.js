import fs from 'fs';
import path from 'path';
import { runSimulationFromConfig } from '../scripts/simulate_endgame.js';

function readLog(relPath) {
  const p = path.resolve(process.cwd(), relPath);
  if (!fs.existsSync(p)) return '';
  return fs.readFileSync(p, 'utf8');
}

describe('endgame simulator integration', () => {
  const logsDir = path.resolve(process.cwd(), 'logs');
  beforeEach(() => {
    if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir);
    // clear logs
    const br = path.resolve(logsDir, 'bot_responses.log');
    const va = path.resolve(logsDir, 'valid_attempts.log');
    if (fs.existsSync(br)) fs.unlinkSync(br);
    if (fs.existsSync(va)) fs.unlinkSync(va);
  });

  test('exact winner scheduled close to end is logged and NO_MORE_ATTEMPTS emitted', async () => {
    const raw = fs.readFileSync(path.resolve('tests', 'mock_endgame_ci.json'), 'utf8');
    const config = JSON.parse(raw);
    await runSimulationFromConfig(config, { silent: true });

    const botResponses = readLog('logs/bot_responses.log');
    const validAttempts = readLog('logs/valid_attempts.log');

    expect(botResponses).toMatch(/EXACT_WINNER/);
    expect(botResponses).toMatch(/NO_MORE_ATTEMPTS/);
    expect(validAttempts).toMatch(/Valid attempt/);
    expect(validAttempts).toMatch(/EXACT WINNER/);
  }, 10000);
});
