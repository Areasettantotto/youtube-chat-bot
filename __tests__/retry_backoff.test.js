import { spawn } from 'child_process';
import { simulateRetryBackoff } from '../scripts/simulate_retry_backoff_module.js';
import { jest } from '@jest/globals';

describe('simulate_retry_backoff', () => {
  jest.setTimeout(30000);

  test('exponential backoff delays are observed', async () => {
    // Force deterministic behavior: 3 attempts, base delay 300ms, 2 simulated failures
    const res = await simulateRetryBackoff({
      API_RETRY_ATTEMPTS: 3,
      API_RETRY_DELAY: 300,
      SIM_FAIL_COUNT: 2
    });

    // Expect sequence: Attempt1 FAIL, Waiting 300, Attempt2 FAIL, Waiting 600, Attempt3 SUCCESS
    const sequence = res.logs.map(p => p.result ? `A${p.attempt}-${p.result}` : `W${p.wait}`);

    expect(sequence).toContain('A1-FAIL');
    expect(sequence.some(s => s === 'W300')).toBeTruthy();
    expect(sequence).toContain('A2-FAIL');
    expect(sequence.some(s => s === 'W600')).toBeTruthy();
    expect(sequence).toContain('A3-SUCCESS');

    expect(res.ok).toBeTruthy();
    expect(res.attempt).toBe(3);
  });
});
