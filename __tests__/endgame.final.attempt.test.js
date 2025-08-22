import fs from 'fs';
import path from 'path';
import { runSimulationFromConfig } from '../scripts/simulate_endgame.js';

function readLog(relPath) {
  const p = path.resolve(process.cwd(), relPath);
  if (!fs.existsSync(p)) return '';
  return fs.readFileSync(p, 'utf8');
}

describe('endgame automatic final attempt', () => {
  const logsDir = path.resolve(process.cwd(), 'logs');
  const botResponses = path.resolve(logsDir, 'bot_responses.log');
  const validAttempts = path.resolve(logsDir, 'valid_attempts.log');

  beforeEach(() => {
    if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });
    if (fs.existsSync(botResponses)) fs.unlinkSync(botResponses);
    if (fs.existsSync(validAttempts)) fs.unlinkSync(validAttempts);
  });

  test('final exact guess is accepted and messages are emitted', async () => {
    const raw = fs.readFileSync(path.resolve('tests', 'mock_endgame_ci.json'), 'utf8');
    const config = JSON.parse(raw);

    // Run silently to avoid noisy console output in CI
    await runSimulationFromConfig(config, { silent: true });

    const br = readLog('logs/bot_responses.log');
    const va = readLog('logs/valid_attempts.log');

    expect(br).toMatch(/EXACT_WINNER/);
    expect(br).toMatch(/NO_MORE_ATTEMPTS/);
    expect(va).toMatch(/Valid attempt/);
    expect(va).toMatch(/EXACT WINNER/);
  }, 15000);
});
