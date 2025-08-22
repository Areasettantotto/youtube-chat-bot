import { simulateRetryBackoff } from '../scripts/simulate_retry_backoff_module.js';
import { jest } from '@jest/globals';

describe('Exponential backoff behavior (module)', () => {
  jest.setTimeout(30000);

  test('delays are exponential: base * 2^(attempt-1)', async () => {
    const res = await simulateRetryBackoff({
      API_RETRY_ATTEMPTS: 4,
      API_RETRY_DELAY: 100,
      SIM_FAIL_COUNT: 3
    });

    // res.logs contains entries with either {attempt,result} or {wait}
    const waits = res.logs.filter(l => l.wait).map(l => l.wait);
    expect(waits.length).toBe(3);
    expect(waits[0]).toBe(100);
    expect(waits[1]).toBe(200);
    expect(waits[2]).toBe(400);

    expect(res.ok).toBeTruthy();
    expect(res.attempt).toBe(4);
  });
});
