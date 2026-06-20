// Build a connection string from parts — the inverse of parseConnectionString.
//
// Useful when credentials arrive as discrete env vars (DB_HOST, DB_USER, …)
// rather than a single URL, which is common on RDS / self-hosted setups. Pure
// and dependency-free; encodes each component so special characters in a
// password don't corrupt the URI.

import { defaultPort, type Engine } from "./url.ts";

export interface DsnParts {
  engine: Engine;
  host: string;
  /** Defaults to the engine's standard port when omitted. */
  port?: number;
  user: string;
  password?: string;
  database: string;
  /** Extra query params, e.g. `{ sslmode: "require" }`. */
  params?: Record<string, string>;
}

const PROTOCOL: Record<Engine, string> = {
  mysql: "mysql:",
  postgres: "postgres:",
};

/**
 * Assemble a valid connection URI from typed parts.
 *
 * Throws when a required field (host, user, database) is missing, so a
 * misconfigured environment fails loudly at build time rather than at connect.
 */
export function buildDsn(parts: DsnParts): string {
  if (!parts.host) throw new Error("lambda-pool: buildDsn requires a host.");
  if (!parts.user) throw new Error("lambda-pool: buildDsn requires a user.");
  if (!parts.database) {
    throw new Error("lambda-pool: buildDsn requires a database.");
  }

  const url = new URL(`${PROTOCOL[parts.engine]}//placeholder`);
  url.hostname = parts.host;
  url.port = String(parts.port ?? defaultPort(parts.engine));
  url.username = encodeURIComponent(parts.user);
  if (parts.password) url.password = encodeURIComponent(parts.password);
  url.pathname = `/${encodeURIComponent(parts.database)}`;
  for (const [k, v] of Object.entries(parts.params ?? {})) {
    url.searchParams.set(k, v);
  }

  return url.toString();
}
