// Exponential backoff with full jitter.
//
// Cold serverless starts and brief DB failovers cause transient connect errors.
// A short, jittered retry turns most of those into a non-event. Pure scheduling
// logic with an injectable sleep so it is fully unit-testable (no real waiting).

export interface RetryOptions {
  /** Total attempts including the first. Default 3. */
  attempts?: number;
  /** Base delay in ms for the first backoff. Default 100. */
  baseDelayMs?: number;
  /** Upper bound on any single delay. Default 2000. */
  maxDelayMs?: number;
  /** Decide whether an error is worth retrying. Default: always. */
  retryable?: (error: Error) => boolean;
  /** Injectable sleep (tests pass a no-op); defaults to setTimeout. */
  sleep?: (ms: number) => Promise<void>;
  /** Injectable RNG in [0,1); defaults to Math.random. */
  random?: () => number;
}

const defaultSleep = (ms: number) =>
  new Promise<void>((r) => setTimeout(r, ms));

/**
 * Compute the delay before attempt `n` (1-based: the delay *after* attempt n
 * fails). Exponential growth `base * 2^(n-1)`, capped, then full jitter applied.
 */
export function backoffDelay(
  attempt: number,
  baseDelayMs: number,
  maxDelayMs: number,
  random: () => number = Math.random,
): number {
  const exp = baseDelayMs * 2 ** (attempt - 1);
  const capped = Math.min(exp, maxDelayMs);
  return Math.floor(random() * capped); // full jitter: [0, capped)
}

/**
 * Run `fn`, retrying transient failures with jittered exponential backoff.
 * Re-throws the last error once attempts are exhausted or an error is deemed
 * non-retryable.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const attempts = Math.max(1, Math.floor(options.attempts ?? 3));
  const baseDelayMs = options.baseDelayMs ?? 100;
  const maxDelayMs = options.maxDelayMs ?? 2000;
  const retryable = options.retryable ?? (() => true);
  const sleep = options.sleep ?? defaultSleep;
  const random = options.random ?? Math.random;

  let lastError: Error = new Error("lambda-pool: withRetry ran zero attempts");

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn();
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
      const isLast = attempt === attempts;
      if (isLast || !retryable(lastError)) throw lastError;
      await sleep(backoffDelay(attempt, baseDelayMs, maxDelayMs, random));
    }
  }

  throw lastError;
}

/**
 * A reasonable default `retryable` predicate for DB connect errors: transient
 * network / availability conditions, not auth or "database does not exist".
 */
export function isTransientDbError(error: Error): boolean {
  const msg = error.message.toLowerCase();
  const code = (error as { code?: string }).code?.toUpperCase() ?? "";
  const transientCodes = new Set([
    "ECONNREFUSED",
    "ECONNRESET",
    "ETIMEDOUT",
    "EPIPE",
    "EAI_AGAIN",
    "PROTOCOL_CONNECTION_LOST",
    "ER_CON_COUNT_ERROR", // too many connections — may clear on retry
    "57P03", // postgres: cannot_connect_now (starting up)
  ]);
  if (transientCodes.has(code)) return true;
  return (
    msg.includes("timeout") ||
    msg.includes("too many clients") ||
    msg.includes("connection terminated") ||
    msg.includes("server is starting up")
  );
}
