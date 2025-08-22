import { startPeriodicAnnouncements } from '../lib/periodicAnnouncements.js';
import { jest } from '@jest/globals';

jest.useFakeTimers();

describe('periodicAnnouncements stop', () => {
  test('stopping controller prevents further announcements', async () => {
    const sends = [];
    const controller = startPeriodicAnnouncements({
      intervalMs: 1000,
      getExhaustedUsers: async () => ['user1', 'user2'],
      formatMessage: (key, vars) => `MSG ${key}`,
      sendMessage: async (msg, ctx) => { sends.push({ msg, ctx, t: Date.now() }); },
      logger: { info: () => {}, debug: () => {}, error: () => {}, warn: () => {}, success: () => {} },
      maxUsersDisplay: 10,
      enableLogs: false,
      attemptsExhaustedLogFile: '/tmp/fake'
    });

    // Fast-forward two intervals, should trigger two sends
    jest.advanceTimersByTime(2100);
    // Allow any pending promises to resolve
    await Promise.resolve();
    expect(sends.length).toBeGreaterThanOrEqual(1);

    // Stop the controller
    controller.stop();

    const before = sends.length;

    // Advance timers further; no new sends should occur
    jest.advanceTimersByTime(5000);
    await Promise.resolve();

    expect(sends.length).toBe(before);
  });
});
