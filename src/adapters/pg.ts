// Serverless-safe pool options for node-postgres (`pg`).
//
// Returns a PLAIN options object — you pass it to your own `new pg.Pool(...)`,
// so this module has zero runtime dependencies and is not pinned to any pg
// version.

import {
  type Env,
  decodeCaBase64,
  firstEnv,
  resolvePoolLimit,
} from "../core/env.ts";

export interface PgPoolEnv extends Env {
  /** Connection URI (postgres://...). Aliases: POSTGRES_URL, PG_URL. */
  DATABASE_URL?: string;
  POSTGRES_URL?: string;
  PG_URL?: string;
  /** Base64-encoded CA cert — when present, enables strict TLS. */
  DATABASE_SSL_CA_BASE64?: string;
  /** Per-instance pool size override; defaults to 1. */
  DATABASE_POOL_LIMIT?: string;
}

/** Shape compatible with pg `PoolConfig` (structural — no import needed). */
export interface PgPoolOptions {
  connectionString: string;
  /** pg calls this `max` (mysql2 calls it `connectionLimit`). */
  max: number;
  /** Close a connection after it sits idle this long (ms). 0 disables. */
  idleTimeoutMillis: number;
  /** Fail fast instead of hanging when the DB has no free slots (ms). */
  connectionTimeoutMillis: number;
  /** Recycle a connection after this many uses (0 = never). */
  maxUses: number;
  /** Don't keep the event loop alive for idle clients. */
  allowExitOnIdle: boolean;
  ssl?: { ca: string; rejectUnauthorized: boolean };
}

export interface BuildPgOptions {
  /** Override the default pool size of 1. */
  defaultPoolLimit?: number;
}

/**
 * Build serverless-safe `pg` pool options.
 *
 * - `max` defaults to 1 (one connection per warm lambda). Raise it only behind
 *   a pooler (PgBouncer / Neon pooled endpoint) via `DATABASE_POOL_LIMIT`.
 * - `idleTimeoutMillis` + `allowExitOnIdle` let an idle lambda release its slot
 *   of a tiny `max_connections` budget and not pin the process open.
 * - `connectionTimeoutMillis` makes "too many clients" surface as a fast error
 *   rather than a hung request.
 * - TLS is enabled with strict verification when `DATABASE_SSL_CA_BASE64` is set.
 */
export function buildPgPoolOptions(
  env: PgPoolEnv,
  opts: BuildPgOptions = {},
): PgPoolOptions {
  const connectionString = firstEnv(
    env,
    "DATABASE_URL",
    "POSTGRES_URL",
    "PG_URL",
  );
  if (!connectionString) {
    throw new Error(
      "lambda-pool: DATABASE_URL (or POSTGRES_URL / PG_URL) is not set — cannot build a Postgres pool.",
    );
  }

  const ssl = decodeCaBase64(env.DATABASE_SSL_CA_BASE64);

  return {
    connectionString,
    max: resolvePoolLimit(env.DATABASE_POOL_LIMIT, opts.defaultPoolLimit ?? 1),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    maxUses: 7_500,
    allowExitOnIdle: true,
    ...(ssl ? { ssl } : {}),
  };
}
