import { connectDb } from "./mongodb";

const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 10;

let indexEnsured = false;

async function ensureIndexes(collection) {
  if (indexEnsured) return;
  await collection.createIndex({ userId: 1 }, { unique: true, sparse: true });
  await collection.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  indexEnsured = true;
}

// Fallback in-memory rate limiter for resilience (e.g. offline dev or DB issues)
const fallbackRateLimitMap = new Map();
let lastCleanupTime = Date.now();
const MAP_CLEANUP_INTERVAL_MS = 60 * 1000;

function checkRateLimitFallback(userId) {
  const now = Date.now();

  // Periodically clean up the entire map to prevent memory leak from inactive users
  if (now - lastCleanupTime > MAP_CLEANUP_INTERVAL_MS) {
    for (const [key, timestamps] of fallbackRateLimitMap.entries()) {
      const active = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
      if (active.length === 0) {
        fallbackRateLimitMap.delete(key);
      } else if (active.length !== timestamps.length) {
        fallbackRateLimitMap.set(key, active);
      }
    }
    lastCleanupTime = now;
  }

  if (!fallbackRateLimitMap.has(userId)) {
    fallbackRateLimitMap.set(userId, [now]);
    return { allowed: true, remaining: MAX_REQUESTS_PER_WINDOW - 1 };
  }

  const timestamps = fallbackRateLimitMap.get(userId);
  const validTimestamps = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);

  if (validTimestamps.length === 0) {
    fallbackRateLimitMap.set(userId, [now]);
    return { allowed: true, remaining: MAX_REQUESTS_PER_WINDOW - 1 };
  }

  if (validTimestamps.length >= MAX_REQUESTS_PER_WINDOW) {
    fallbackRateLimitMap.set(userId, validTimestamps);
    return { allowed: false, remaining: 0 };
  }

  validTimestamps.push(now);
  fallbackRateLimitMap.set(userId, validTimestamps);
  return { allowed: true, remaining: MAX_REQUESTS_PER_WINDOW - validTimestamps.length };
}

export async function checkRateLimit(userId) {
  try {
    const db = await connectDb();
    if (!db || typeof db.collection !== "function") {
      console.warn("[rate-limit] MongoDB unavailable (null db), using in-memory fallback");
      return checkRateLimitFallback(userId);
    }
    const collection = db.collection("rate_limits");

    await ensureIndexes(collection);

    const now = new Date();
    const windowStart = new Date(now.getTime() - RATE_LIMIT_WINDOW_MS);

    const updateResult = await collection.updateOne(
      { userId },
      {
        $push: {
          requests: {
            $each: [now],
            $slice: -(MAX_REQUESTS_PER_WINDOW + 1),
          },
        },
        $set: {
          expiresAt: new Date(now.getTime() + RATE_LIMIT_WINDOW_MS * 2),
        },
      },
    );

    if (updateResult.matchedCount === 0) {
      await collection.updateOne(
        { userId },
        {
          $set: {
            requests: [now],
            expiresAt: new Date(now.getTime() + RATE_LIMIT_WINDOW_MS * 2),
            userId,
          },
        },
        { upsert: true },
      );
    }

    const updated = await collection.findOne({ userId });
    const recentRequests = (updated?.requests ?? []).filter(
      (t) => new Date(t) >= windowStart
    );

    if (recentRequests.length > MAX_REQUESTS_PER_WINDOW) {
      return { allowed: false, remaining: 0 };
    }

    return {
      allowed: true,
      remaining: MAX_REQUESTS_PER_WINDOW - recentRequests.length,
    };
  } catch (err) {
    const hasRedis =
      process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN;

    if (!hasRedis) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error(
        "[rate-limit] MongoDB failed — failing closed:",
        errMsg
      );
      return { allowed: false, remaining: 0 };
    }

    try {
      const redis = getRedis();
      const key = `ratelimit:api:${userId}`;
      const now = Date.now();
      const windowStart = now - RATE_LIMIT_WINDOW_MS;

      const multi = redis.multi();
      multi.zremrangebyscore(key, 0, windowStart);
      multi.zadd(key, { score: now, member: `${now}-${Math.random()}` });
      multi.zcard(key);
      multi.expire(key, Math.ceil(RATE_LIMIT_WINDOW_MS / 1000));
      const [, , count] = await multi.exec();

      const current = Number(count);
      if (current > MAX_REQUESTS_PER_WINDOW) {
        return { allowed: false, remaining: 0 };
      }

      return { allowed: true, remaining: MAX_REQUESTS_PER_WINDOW - current };
    } catch (redisErr) {
      console.error(
        "[rate-limit] Both MongoDB and Upstash Redis failed — failing closed:",
        redisErr
      );
      return { allowed: false, remaining: 0 };
    }
  }
}
