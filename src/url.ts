// Connection-string parsing and redaction.
//
// Useful on its own: parse a `mysql://` / `postgres://` URI into typed parts,
// and — importantly — produce a redacted form safe to put in logs, error
// messages, and crash reports. Leaking a DB password into a log aggregator is a
// classic incident; `redactUrl` makes "log the connection target" safe.

import { attempt, type Result } from "./result.ts";

export type Engine = "mysql" | "postgres";

export interface ParsedConnection {
  engine: Engine;
  protocol: string;
  host: string;
  port: number;
  user: string;
  /** Present only when the URI carried a password. */
  password?: string;
  database: string;
  /** Query params (e.g. `sslmode`, `ssl-mode`, `connection_limit`). */
  params: Record<string, string>;
}

const POSTGRES_PROTOCOLS = new Set(["postgres:", "postgresql:"]);
const MYSQL_PROTOCOLS = new Set(["mysql:", "mariadb:"]);

/** Default port for an engine, used when the URI omits one. */
export function defaultPort(engine: Engine): number {
  return engine === "postgres" ? 5432 : 3306;
}

function engineFromProtocol(protocol: string): Engine {
  if (POSTGRES_PROTOCOLS.has(protocol)) return "postgres";
  if (MYSQL_PROTOCOLS.has(protocol)) return "mysql";
  throw new Error(
    `lambda-pool: unsupported connection protocol "${protocol}" — expected mysql:// or postgres://`,
  );
}

/**
 * Parse a database connection URI into typed components.
 *
 * Throws a clear error for a malformed or unsupported URI rather than letting a
 * cryptic driver error surface later at connect time.
 */
export function parseConnectionString(uri: string): ParsedConnection {
  let url: URL;
  try {
    url = new URL(uri);
  } catch {
    throw new Error("lambda-pool: connection string is not a valid URI.");
  }

  const engine = engineFromProtocol(url.protocol);
  const params: Record<string, string> = {};
  for (const [k, v] of url.searchParams) params[k] = v;

  const database = decodeURIComponent(url.pathname.replace(/^\//, ""));

  return {
    engine,
    protocol: url.protocol,
    host: url.hostname,
    port: url.port ? Number(url.port) : defaultPort(engine),
    user: decodeURIComponent(url.username),
    ...(url.password
      ? { password: decodeURIComponent(url.password) }
      : {}),
    database,
    params,
  };
}

/**
 * Non-throwing variant of {@link parseConnectionString}. Returns a Result so
 * callers can branch instead of using try/catch.
 */
export function safeParseConnectionString(
  uri: string,
): Result<ParsedConnection, Error> {
  return attempt(() => parseConnectionString(uri));
}

/**
 * Return the URI with the password replaced by `***`, safe for logs.
 *
 * Preserves everything else (host, port, db, params) so the redacted string is
 * still useful for debugging "which database am I pointed at?".
 */
export function redactUrl(uri: string): string {
  let url: URL;
  try {
    url = new URL(uri);
  } catch {
    return "<invalid-connection-string>";
  }
  if (url.password) url.password = "***";
  return url.toString();
}

/** True when the URI's query params request SSL/TLS in any common spelling. */
export function urlRequestsSsl(uri: string): boolean {
  const { params } = parseConnectionString(uri);
  const sslmode = (params["sslmode"] ?? params["ssl-mode"] ?? "").toLowerCase();
  if (["require", "required", "verify-ca", "verify-full"].includes(sslmode)) {
    return true;
  }
  const ssl = (params["ssl"] ?? "").toLowerCase();
  return ssl === "true" || ssl === "1";
}
