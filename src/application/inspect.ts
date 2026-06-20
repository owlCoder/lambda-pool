// Convenience: run diagnostics straight from an env bag.
//
// Bridges the env-shaped world (process.env) to the pure `diagnose()` core, so
// apps can do a one-line startup check without re-deriving the URL/pool/CA
// values themselves. Kept separate from the builders so each module has one job.

import { diagnose, type DiagnoseReport } from "./diagnostics.ts";
import { resolvePoolLimit, firstEnv, type Env } from "../core/env.ts";

export interface InspectEnv extends Env {
  DATABASE_URL?: string;
  MYSQL_URL?: string;
  POSTGRES_URL?: string;
  PG_URL?: string;
  DATABASE_POOL_LIMIT?: string;
  DATABASE_SSL_CA_BASE64?: string;
  /** Optional hint for the budget check (peak warm instances). */
  EXPECTED_INSTANCES?: string;
}

/**
 * Build a diagnostics report from environment variables.
 *
 * Throws only when no connection URL is present at all — everything else is
 * surfaced as diagnostics, never thrown.
 */
export function inspectEnv(env: InspectEnv): DiagnoseReport {
  const url = firstEnv(
    env,
    "DATABASE_URL",
    "MYSQL_URL",
    "POSTGRES_URL",
    "PG_URL",
  );
  if (!url) {
    throw new Error(
      "lambda-pool: no connection URL in env (DATABASE_URL / MYSQL_URL / POSTGRES_URL / PG_URL).",
    );
  }

  const expected = env.EXPECTED_INSTANCES
    ? Number(env.EXPECTED_INSTANCES)
    : undefined;

  return diagnose({
    url,
    poolLimit: resolvePoolLimit(env.DATABASE_POOL_LIMIT),
    hasCaCert: Boolean(env.DATABASE_SSL_CA_BASE64),
    ...(expected && Number.isFinite(expected) && expected > 0
      ? { expectedInstances: Math.floor(expected) }
      : {}),
  });
}
