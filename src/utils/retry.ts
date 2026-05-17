export interface RetryOptions {
  retries: number;
  baseDelayMs: number;
  maxDelayMs: number;
}

const defaultRetryOptions: RetryOptions = {
  retries: 3,
  baseDelayMs: 500,
  maxDelayMs: 5000
};

export async function withRetry<T>(
  operation: () => Promise<T>,
  options: Partial<RetryOptions> = {}
): Promise<T> {
  const merged = { ...defaultRetryOptions, ...options };
  let lastError: unknown;

  for (let attempt = 0; attempt <= merged.retries; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt === merged.retries) {
        break;
      }

      const delay = Math.min(merged.baseDelayMs * 2 ** attempt, merged.maxDelayMs);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}
