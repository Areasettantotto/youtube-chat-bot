import { withRetry } from '../../lib/retry.js';
import { jest } from '@jest/globals';

describe('withRetry', () => {
  jest.setTimeout(20000);

  test('exponential waits observed via onRetry hook', async () => {
    const baseDelay = 50;
    const maxRetries = 4;
    const failCount = 3; // fail first 3 attempts then success
    const attempts = [];

    const res = await withRetry(async (attempt) => {
      attempts.push({ attempt, ts: Date.now() });
      if (attempt <= failCount) throw new Error('simulated');
      return { ok: true, attempt };
    }, {
      maxRetries,
      baseDelay,
      onRetry: (attempt, wait) => {
        attempts.push({ wait, ts: Date.now() });
      }
    });

    expect(res.ok).toBeTruthy();
    expect(res.attempt).toBe(4);

    // Extract waits
    const waits = attempts.filter(a => a.wait).map(a => a.wait);
    expect(waits.length).toBe(3);
    expect(waits[0]).toBe(baseDelay);
    expect(waits[1]).toBe(baseDelay * 2);
    expect(waits[2]).toBe(baseDelay * 4);
  });
});
