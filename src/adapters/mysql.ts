// Serverless-safe pool options for mysql2.
//
// Returns a PLAIN options object — you pass it to your own
// `mysql.createPool(...)`, so this module has zero runtime dependencies and is
// not pinned to any mysql2 version.

import {
  type Env,
  decodeCaBase64,
  firstEnv,
  resolvePoolLimit,
} from "../core/env.ts";

export interface MysqlPoolEnv extends Env {
  /** Connection URI (mysql://...). Alias: MYSQL_URL. */
  DATABASE_URL?: string;
  MYSQL_URL?: string;
  /** Base64-encoded CA cert — when present, enables strict TLS. */
  DATABASE_SSL_CA_BASE64?: string;
  /** Per-instance pool size override; defaults to 1. */
  DATABASE_POOL_LIMIT?: string;
}

/** Shape compatible with mysql2 `PoolOptions` (structural — no import needed). */
export interface MysqlPoolOptions {
  uri: string;
  connectionLimit: number;
  maxIdle: number;
  idleTimeout: number;
  enableKeepAlive: boolean;
  waitForConnections: boolean;
  queueLimit: number;
  ssl?: { ca: string; rejectUnauthorized: boolean };
}

export interface BuildMysqlOptions {
  /** Override the default pool size of 1. */
  defaultPoolLimit?: number;
}

/**
 * Build serverless-safe mysql2 pool options.
 *
 * - `connectionLimit` defaults to 1 (one connection per warm lambda). Raise it
 *   only behind a connection pooler or on a plan with headroom, via
 *   `DATABASE_POOL_LIMIT`.
 * - `maxIdle: 1` + `idleTimeout` lets idle lambdas release their connection so
 *   they don't sit on a slot of a tiny `max_connections` budget.
 * - TLS is enabled with strict verification when `DATABASE_SSL_CA_BASE64` is set.
 */
export function buildMysqlPoolOptions(
  env: MysqlPoolEnv,
  opts: BuildMysqlOptions = {},
): MysqlPoolOptions {
  const uri = firstEnv(env, "DATABASE_URL", "MYSQL_URL");
  if (!uri) {
    throw new Error(
      "lambda-pool: DATABASE_URL (or MYSQL_URL) is not set — cannot build a MySQL pool.",
    );
  }

  const ssl = decodeCaBase64(env.DATABASE_SSL_CA_BASE64);

  return {
    uri,
    connectionLimit: resolvePoolLimit(
      env.DATABASE_POOL_LIMIT,
      opts.defaultPoolLimit ?? 1,
    ),
    maxIdle: 1,
    idleTimeout: 30_000,
    enableKeepAlive: true,
    waitForConnections: true,
    queueLimit: 0,
    ...(ssl ? { ssl } : {}),
  };
}
