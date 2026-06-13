import { AppError } from "@/lib/errors";

export async function executeWithRetry(
  transactionFn,
  maxRetries = 3,
  delay = 100
) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await transactionFn();
    } catch (error) {
      const isDeadlock =
        error.code === "40P01" ||
        error.code === "ER_LOCK_DEADLOCK" ||
        error.code === 1213;

      if (isDeadlock && attempt < maxRetries) {
        console.warn(
          `[Concurrency Warning] Deadlock detected on attempt ${attempt}/${maxRetries}. Retrying...`
        );
        const backoffTime = delay * attempt * Math.random();
        await new Promise((resolve) => setTimeout(resolve, backoffTime));
        continue;
      }
      throw error;
    }
  }
}
