import fs from 'fs';
import path from 'path';
import { runSimulationFromConfig } from '../scripts/simulate_endgame.js';

describe('Endgame - no participants', () => {
  const LOGS_DIR = path.resolve(process.cwd(), 'logs');
  const BOT_RESPONSES = path.join(LOGS_DIR, 'bot_responses.log');
  const MOCK = path.resolve(process.cwd(), 'tests', 'mock_no_participants.json');

  beforeEach(() => {
    // Ensure logs dir exists and remove previous bot_responses.log
    if (!fs.existsSync(LOGS_DIR)) fs.mkdirSync(LOGS_DIR, { recursive: true });
    if (fs.existsSync(BOT_RESPONSES)) fs.unlinkSync(BOT_RESPONSES);
  });

  afterEach(() => {
    // keep logs for inspection on failure, but no-op here
  });

  test('simulator writes NO_PARTICIPANTS to bot_responses.log', async () => {
    const raw = fs.readFileSync(MOCK, 'utf8');
    const config = JSON.parse(raw);

    // Run simulation in silent mode to avoid console noise
    await runSimulationFromConfig(config, { silent: true });

    expect(fs.existsSync(BOT_RESPONSES)).toBe(true);
    const content = fs.readFileSync(BOT_RESPONSES, 'utf8');
    // The simulator uses the tag NO_PARTICIPANTS when writing this line
    expect(content).toMatch(/NO_PARTICIPANTS/);
  }, 20000);
});
