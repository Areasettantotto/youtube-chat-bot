import fs from 'fs';
import path from 'path';
import { runSimulationFromConfig } from '../scripts/simulate_endgame.js';
import { jest } from '@jest/globals';

jest.setTimeout(30000);

describe('simulate realistic live (many users)', () => {
  const botLog = path.resolve(process.cwd(), 'logs', 'bot_responses.log');
  const validLog = path.resolve(process.cwd(), 'logs', 'valid_attempts.log');

  beforeEach(() => {
    if (!fs.existsSync('logs')) fs.mkdirSync('logs');
    if (fs.existsSync(botLog)) fs.unlinkSync(botLog);
    if (fs.existsSync(validLog)) fs.unlinkSync(validLog);
  });

  test('run simulation and verify winner and attempts in logs', async () => {
    const raw = fs.readFileSync(path.resolve('tests', 'mock_many_users.json'), 'utf8');
    const config = JSON.parse(raw);

    await runSimulationFromConfig(config, { silent: true });

    const botContent = fs.existsSync(botLog) ? fs.readFileSync(botLog, 'utf8') : '';
    const validContent = fs.existsSync(validLog) ? fs.readFileSync(validLog, 'utf8') : '';

    expect(botContent).toMatch(/CONTEST_START/);
    expect(botContent).toMatch(/EXACT_WINNER/);
    expect(botContent).toMatch(/NO_MORE_ATTEMPTS/);
    expect(validContent).toMatch(/Valid attempt/);
  });
});
