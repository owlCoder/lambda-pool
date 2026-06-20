// Driver-agnostic health checks (Dependency Inversion + Interface Segregation).
//
// The package depends on a tiny `Queryable` port — the narrowest surface that
// both `mysql2` pools and `pg` pools already satisfy — not on a concrete driver.
// Adapters live next to the builders. This keeps `lambda-pool` dependency-free
// while still offering a "is the DB reachable?" helper.

import type { Result } from "./result.ts";

/**
 * The minimal surface needed to run a trivial probe query. Both
 * `mysql2`'s pool and `pg`'s pool structurally satisfy this.
 */
export interface Queryable {
  query(sql: string): Promise<unknown>;
}

export interface HealthResult {
  healthy: boolean;
  /** Round-trip latency of the probe query, in milliseconds. */
  latencyMs: number;
  /** Present when the probe failed. */
  error?: Error;
}

export interface HealthOptions {
  /** SQL used to probe. Defaults to `SELECT 1`. */
  probeSql?: string;
  /** Fail the probe if it takes longer than this many ms. */
  timeoutMs?: number;
}

function timeout(ms: number): Promise<never> {
  return new Promise((_, reject) =>
    setTimeout(
      () => reject(new Error(`lambda-pool: health probe timed out after ${ms}ms`)),
      ms,
    ),
  );
}

/**
 * Run a probe query against any `Queryable` and report health + latency.
 *
 * Never throws — failures are returned in the result so callers can use it
 * directly in a readiness endpoint.
 */
export async function checkHealth(
  db: Queryable,
  options: HealthOptions = {},
): Promise<HealthResult> {
  const sql = options.probeSql ?? "SELECT 1";
  const started = performance.now();

  const probe = (async () => {
    await db.query(sql);
  })();

  const race: Promise<Result<void, Error>> = options.timeoutMs
    ? Promise.race([probe, timeout(options.timeoutMs)]).then(
        () => ({ ok: true as const, value: undefined }),
        (e: Error) => ({ ok: false as const, error: e }),
      )
    : probe.then(
        () => ({ ok: true as const, value: undefined }),
        (e: Error) => ({ ok: false as const, error: e }),
      );

  const outcome = await race;
  const latencyMs = Math.round(performance.now() - started);

  return outcome.ok
    ? { healthy: true, latencyMs }
    : { healthy: false, latencyMs, error: outcome.error };
}

/** Convenience: true/false readiness, swallowing the detail. */
export async function isReachable(
  db: Queryable,
  options?: HealthOptions,
): Promise<boolean> {
  const r = await checkHealth(db, options);
  return r.healthy;
}
