import fs from 'fs';
import path from 'path';
import { runSimulationFromConfig } from '../scripts/simulate_endgame.js';

function readLog(relPath) {
  const p = path.resolve(process.cwd(), relPath);
  if (!fs.existsSync(p)) return '';
  return fs.readFileSync(p, 'utf8');
}

describe('endgame closest winner', () => {
  const logsDir = path.resolve(process.cwd(), 'logs');
  const botResponses = path.resolve(logsDir, 'bot_responses.log');
  const validAttempts = path.resolve(logsDir, 'valid_attempts.log');

  beforeEach(() => {
    if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });
    if (fs.existsSync(botResponses)) fs.unlinkSync(botResponses);
    if (fs.existsSync(validAttempts)) fs.unlinkSync(validAttempts);
  });

  test('closest winner is selected and logged when no exact winner', async () => {
    const raw = fs.readFileSync(path.resolve('tests', 'mock_endgame_closest.json'), 'utf8');
    const config = JSON.parse(raw);

    await runSimulationFromConfig(config, { silent: true });

    const br = readLog('logs/bot_responses.log');
    const va = readLog('logs/valid_attempts.log');

    expect(br).toMatch(/CLOSEST_WINNER/);
    expect(va).toMatch(/CLOSEST WINNER/);
  }, 10000);
});
