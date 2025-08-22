// Lightweight retry helper with exponential backoff
export async function withRetry(actionFn, {
  maxRetries = 3,
  baseDelay = 1000,
  onRetry = null
} = {}) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await actionFn(attempt);
    } catch (err) {
      if (attempt === maxRetries) throw err;
      const wait = baseDelay * (2 ** (attempt - 1));
      try { if (typeof onRetry === 'function') onRetry(attempt, wait, err); } catch (_) {}
      await new Promise(r => setTimeout(r, wait));
    }
  }
}
