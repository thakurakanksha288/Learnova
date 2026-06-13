import { MongoClient } from "mongodb";
import logger from "@/utils/logger";

const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DB = process.env.MONGODB_DB;

if (!MONGODB_DB) {
  throw new Error('Invalid/Missing environment variable: "MONGODB_DB"');
}

if (!global._mongoMetrics) {
  global._mongoMetrics = { totalRequests: 0, retries: 0 };
}
const metrics = global._mongoMetrics;

const mainPoolOptions = {
  maxPoolSize: 10,
  minPoolSize: 1,
  maxIdleTimeMS: 60000,
  serverSelectionTimeoutMS: 5000,
  connectTimeoutMS: 5000,
  socketTimeoutMS: 45000,
};

const ssePoolOptions = {
  maxPoolSize: 30,
  maxIdleTimeMS: 120000,
};

let mainClientPromise = null;
let sseClientPromise = null;

const getMainClientPromise = () => {
  if (!MONGODB_URI) {
    throw new Error('Invalid/Missing environment variable: "MONGODB_URI"');
  }
  if (!mainClientPromise) {
    if (process.env.NODE_ENV === "development") {
      if (!global._mongoClientPromise) {
        global._mongoClientPromise = new MongoClient(
          MONGODB_URI,
          mainPoolOptions
        ).connect();
      }
      mainClientPromise = global._mongoClientPromise;
    } else {
      mainClientPromise = new MongoClient(
        MONGODB_URI,
        mainPoolOptions
      ).connect();
    }
  }
  return mainClientPromise;
};

const getSseClientPromise = () => {
  if (!MONGODB_URI) {
    throw new Error('Invalid/Missing environment variable: "MONGODB_URI"');
  }
  if (!sseClientPromise) {
    if (process.env.NODE_ENV === "development") {
      if (!global._mongoSseClientPromise) {
        global._mongoSseClientPromise = new MongoClient(
          MONGODB_URI,
          ssePoolOptions
        ).connect();
      }
      sseClientPromise = global._mongoSseClientPromise;
    } else {
      sseClientPromise = new MongoClient(MONGODB_URI, ssePoolOptions).connect();
    }
  }
  return sseClientPromise;
};

export async function connectDb() {
  try {
    const connectedClient = await getMainClientPromise();
    return connectedClient.db(MONGODB_DB);
  } catch (error) {
    if (logger?.error) {
      logger.error("[DB Manager] Main pool connection failed", {
        error: error.message,
      });
    }
    throw new Error(
      `Failed to establish database connection: ${error.message}`
    );
  }
}

export async function connectDbForSSE() {
  try {
    const connectedClient = await getSseClientPromise();
    return connectedClient.db(MONGODB_DB);
  } catch (error) {
    if (logger?.error) {
      logger.error("[DB Manager] SSE pool connection failed", {
        error: error.message,
      });
    }
    throw new Error(
      `Failed to establish SSE database connection: ${error.message}`
    );
  }
}

const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 500;

export async function executeWithRetry(operation, context = "DB Operation") {
  let attempt = 0;
  let delay = INITIAL_BACKOFF_MS;

  while (attempt <= MAX_RETRIES) {
    try {
      metrics.totalRequests++;
      const startTime = performance.now();
      const result = await operation();
      const latency = performance.now() - startTime;

      if (latency > 800 && logger?.warn) {
        logger.warn(
          `[DB Manager] ⚠️ Slow query detected in ${context}. Latency: ${latency.toFixed(2)}ms`
        );
      }
      return result;
    } catch (error) {
      attempt++;
      if (attempt > MAX_RETRIES) {
        if (logger?.error) {
          logger.error(`[DB Manager] 💥 Exhausted all retries for ${context}`, {
            error: error.message,
          });
        }
        throw error;
      }
      metrics.retries++;
      if (logger?.warn) {
        logger.warn(
          `[DB Manager] 📉 Transient error in ${context}. Retrying ${attempt}/${MAX_RETRIES} in ${delay}ms...`,
          { error: error.message }
        );
      }
      await new Promise((res) => setTimeout(res, delay));
      delay *= 2;
    }
  }
  throw new Error(`[DB Manager] Operation failed after ${MAX_RETRIES} retries`);
}

export function getDbMetrics() {
  return {
    activePool: mainClientPromise ? "connected" : "disconnected",
    ...metrics,
  };
}

export const clientPromise = getMainClientPromise();
export default clientPromise;
