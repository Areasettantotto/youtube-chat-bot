import fs from 'fs';
import path from 'path';
import { startPeriodicAnnouncements } from '../lib/periodicAnnouncements.js';

describe('periodicAnnouncements helper', () => {
  test('does not send messages after stop is called', async () => {
    let sendCount = 0;
    const sendMessage = async () => { sendCount++; };
    const getExhaustedUsers = async () => ['A','B'];
    const logger = { debug: () => {}, success: () => {}, error: () => {} };
    const controller = startPeriodicAnnouncements({ intervalMs: 100, getExhaustedUsers, formatMessage: () => 'msg', sendMessage, logger, maxUsersDisplay: 10 });

    // let it run for ~250ms (should fire 2 times)
    await new Promise(r => setTimeout(r, 250));
    expect(sendCount).toBeGreaterThanOrEqual(1);

    controller.stop();
    const before = sendCount;
    // wait another 300ms to ensure no further calls
    await new Promise(r => setTimeout(r, 300));
    expect(sendCount).toBe(before);
  }, 5000);
});
