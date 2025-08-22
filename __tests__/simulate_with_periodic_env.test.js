import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { jest } from '@jest/globals';

jest.setTimeout(20000);

describe('simulate_endgame with PERIODIC_EXHAUSTED_ANNOUNCEMENTS env', () => {
  const logFile = path.resolve(process.cwd(), 'logs', 'bot_responses.log');

  beforeEach(() => {
    // Clean log file
    try {
      if (fs.existsSync(logFile)) fs.unlinkSync(logFile);
    } catch (e) {
      // ignore
    }
  });

  test('simulator run with periodic env produces winner messages and no periodic exhausted announcements', () => {
    const env = { ...process.env, PERIODIC_EXHAUSTED_ANNOUNCEMENTS: 'true', EXHAUSTED_USERS_ANNOUNCEMENT_INTERVAL: '1', SILENT: '1' };
    const res = spawnSync('node', ['scripts/simulate_endgame.js', 'tests/mock_endgame_ci.json'], { env, encoding: 'utf8' });

    // Ensure the process exited normally
    expect(res.status).toBe(0);

    // Read logs
    const content = fs.existsSync(logFile) ? fs.readFileSync(logFile, 'utf8') : '';

    // Must contain contest start and winner messages
    expect(content).toMatch(/CONTEST_START/);
    expect(content).toMatch(/EXACT_WINNER/);
    expect(content).toMatch(/NO_MORE_ATTEMPTS/);

    // Should NOT contain exhausted attempts periodic announcements (simulator shouldn't emit them)
    expect(content).not.toMatch(/ATTEMPTS_EXHAUSTED/);
  });
});
