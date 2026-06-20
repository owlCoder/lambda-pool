// Structural redaction for logs and crash reports.
//
// `redactUrl` (core/url) masks a connection string; this masks *objects* —
// config dumps, error `extra` bags, request context — by key name. Pure and
// dependency-free. The default key set targets the usual credential leaks.

/** Default key substrings (case-insensitive) whose values get masked. */
export const DEFAULT_SECRET_KEYS = [
  "password",
  "passwd",
  "secret",
  "token",
  "apikey",
  "api_key",
  "authorization",
  "auth",
  "credential",
  "connectionstring",
  "connection_string",
  "dsn",
  "ssl_ca",
  "ca",
] as const;

export interface RedactOptions {
  /** Extra key substrings to treat as secret (merged with the defaults). */
  keys?: string[];
  /** Replacement string. Default "***". */
  mask?: string;
  /** Max recursion depth (guards against cycles/huge graphs). Default 8. */
  maxDepth?: number;
}

function isSecretKey(key: string, needles: string[]): boolean {
  const k = key.toLowerCase();
  return needles.some((n) => k.includes(n));
}

/**
 * Return a deep copy of `value` with secret-looking keys masked.
 *
 * - Object keys are matched case-insensitively against the secret-key list.
 * - Arrays are walked element-wise.
 * - Cycles and over-deep graphs are cut off at `maxDepth` (replaced with the
 *   string "[Depth limit]") so this is always safe to call on arbitrary input.
 */
export function redact<T>(value: T, options: RedactOptions = {}): T {
  const needles = [
    ...DEFAULT_SECRET_KEYS,
    ...(options.keys ?? []).map((k) => k.toLowerCase()),
  ];
  const mask = options.mask ?? "***";
  const maxDepth = options.maxDepth ?? 8;
  const seen = new WeakSet<object>();

  function walk(v: unknown, depth: number): unknown {
    if (depth > maxDepth) return "[Depth limit]";
    if (v === null || typeof v !== "object") return v;
    if (seen.has(v)) return "[Circular]";
    seen.add(v);

    if (Array.isArray(v)) return v.map((item) => walk(item, depth + 1));

    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(v)) {
      out[key] = isSecretKey(key, needles)
        ? mask
        : walk(val, depth + 1);
    }
    return out;
  }

  return walk(value, 0) as T;
}
