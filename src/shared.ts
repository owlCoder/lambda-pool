// Shared, dependency-free helpers used by both the MySQL and Postgres adapters.
//
// Why this package exists
// -----------------------
// On Vercel/Lambda every *warm* function instance keeps its own connection
// pool. If each pool opens N connections and the platform keeps M instances
// warm, the database sees up to N*M connections. Managed Postgres/MySQL on
// small plans (Aiven free, Neon, RDS micro, PlanetScale) cap `max_connections`
// very low (often 10-25), so a seemingly innocent `connectionLimit: 10` will
// throw `ER_CON_COUNT_ERROR` / `too many clients already` under modest traffic.
//
// The fix is counter-intuitive: make each pool TINY (default 1). The platform's
// horizontal scaling becomes your concurrency; the database stops melting.

/** A bag of env vars (e.g. `process.env`). */
export type Env = Record<string, string | undefined>;

/** TLS material once decoded, ready to hand to a driver. */
export interface DecodedTls {
  ca: string;
  rejectUnauthorized: boolean;
}

/**
 * Resolve the per-instance pool size.
 *
 * Defaults to 1 (see file header). Any non-positive / non-finite override is
 * ignored and falls back to the default so a bad env var can never widen the
 * pool by accident.
 */
export function resolvePoolLimit(
  raw: string | undefined,
  fallback = 1,
): number {
  if (raw == null || raw === "") return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

/**
 * Decode a base64-encoded CA certificate into TLS options.
 *
 * Managed providers hand you a CA bundle but the connection URI's
 * `?ssl-mode=REQUIRED` / `?sslmode=require` param is NOT understood by mysql2
 * or pg in the way people expect, so we pass the CA explicitly and verify the
 * server. Returns `undefined` when no CA is configured (driver defaults apply).
 */
export function decodeCaBase64(
  caBase64: string | undefined,
  rejectUnauthorized = true,
): DecodedTls | undefined {
  if (!caBase64) return undefined;
  return {
    ca: Buffer.from(caBase64, "base64").toString("utf8"),
    rejectUnauthorized,
  };
}

/** Read the first defined value among the given env keys. */
export function firstEnv(env: Env, ...keys: string[]): string | undefined {
  for (const k of keys) {
    const v = env[k];
    if (v != null && v !== "") return v;
  }
  return undefined;
}
