// Normalized pool configuration from an environment bag.
//
// One place that reads the (many) accepted env var names and produces a single
// typed, engine-resolved config. The adapters and use-cases consume this
// instead of re-deriving URL / pool-limit / CA from raw env each time (DRY,
// Single Source of Truth). Pure: takes an env object, returns data.

import { decodeCaBase64, firstEnv, resolvePoolLimit, type Env } from "./env.ts";
import { parseConnectionString, type Engine } from "./url.ts";

export interface PoolConfig {
  /** The resolved connection URI. */
  url: string;
  /** Engine inferred from the URI scheme. */
  engine: Engine;
  /** Host, for provider detection. */
  host: string;
  /** Per-instance pool size (default 1). */
  poolLimit: number;
  /** Decoded CA PEM, when DATABASE_SSL_CA_BASE64 was provided. */
  caCert?: string;
  /** Whether TLS material was supplied. */
  hasTls: boolean;
}

const URL_KEYS = ["DATABASE_URL", "MYSQL_URL", "POSTGRES_URL", "PG_URL"] as const;

/**
 * Read and normalize pool configuration from an env bag.
 *
 * Throws a single clear error when no connection URL is present; everything
 * else has a defined default.
 */
export function loadPoolConfig(env: Env): PoolConfig {
  const url = firstEnv(env, ...URL_KEYS);
  if (!url) {
    throw new Error(
      `lambda-pool: no connection URL in env (one of: ${URL_KEYS.join(", ")}).`,
    );
  }

  const { engine, host } = parseConnectionString(url);
  const tls = decodeCaBase64(env.DATABASE_SSL_CA_BASE64);

  return {
    url,
    engine,
    host,
    poolLimit: resolvePoolLimit(env.DATABASE_POOL_LIMIT),
    ...(tls ? { caCert: tls.ca } : {}),
    hasTls: Boolean(tls),
  };
}
