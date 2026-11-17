import { ApiError } from './errors.mjs';

const WINDOW_MS = 15 * 60 * 1000;
const LIMITS = {
  register: { perAddress: 20, global: 100 },
  login: { perAddress: 50, global: 300 },
};

export function createAuthRateLimiter(clock) {
  const buckets = new Map();

  return function checkAuthRateLimit(req, operation) {
    const now = clock();
    if (buckets.size > 1024) {
      for (const [k, v] of buckets) {
        if (now < v.startedAt || now - v.startedAt >= WINDOW_MS) {
          buckets.delete(k);
        }
      }
    }
    const address = req.socket?.remoteAddress ?? 'unknown';
    const limits = LIMITS[operation];
    const entries = [
      [`${operation}:address:${address}`, limits.perAddress],
      [`${operation}:global`, limits.global],
    ].map(([key, limit]) => {
      const previous = buckets.get(key);
      const bucket = !previous || now < previous.startedAt || now - previous.startedAt >= WINDOW_MS
        ? { startedAt: now, count: 0 }
        : previous;
      if (bucket.count >= limit) {
        throw new ApiError('RATE_LIMITED', '请求过于频繁，请稍后再试。', 429, true);
      }
      return [key, bucket];
    });
    for (const [key, bucket] of entries) {
      bucket.count += 1;
      buckets.set(key, bucket);
    }
  };
}
