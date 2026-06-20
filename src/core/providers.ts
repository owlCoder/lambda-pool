// Provider presets and host-based auto-detection.
//
// Different managed providers have different connection realities. This module
// is a pure, dependency-free registry: given a host, identify the provider and
// surface its guidance (typical max_connections, whether a pooled endpoint
// exists, the safe default pool size). No network calls — detection is purely
// structural on the hostname.

import type { Engine } from "./url.ts";

export type ProviderId =
  | "aiven"
  | "neon"
  | "supabase"
  | "planetscale"
  | "rds"
  | "railway"
  | "render"
  | "vercel-postgres"
  | "unknown";

export interface ProviderPreset {
  id: ProviderId;
  label: string;
  /** Engines this preset is relevant to (informational). */
  engines: Engine[];
  /** Typical `max_connections` on entry/free plans (for the budget calc). */
  typicalMaxConnections: number;
  /** Safe per-instance pool size for a *direct* (un-pooled) connection. */
  safeDirectPoolLimit: number;
  /** Does the provider offer a transaction pooler (PgBouncer-style)? */
  hasPooledEndpoint: boolean;
  /** Whether the host string indicates the *pooled* endpoint specifically. */
  isPooledHost?: (host: string) => boolean;
  /** Short, actionable note shown in diagnostics. */
  note: string;
  /** Hostname matcher. */
  matches: (host: string) => boolean;
}

const PRESETS: ProviderPreset[] = [
  {
    id: "neon",
    label: "Neon",
    engines: ["postgres"],
    typicalMaxConnections: 100,
    safeDirectPoolLimit: 1,
    hasPooledEndpoint: true,
    isPooledHost: (h) => h.includes("-pooler."),
    note: "Use the pooled endpoint (host contains '-pooler') for serverless; it multiplexes connections so a small pool is fine.",
    matches: (h) => h.endsWith(".neon.tech"),
  },
  {
    id: "supabase",
    label: "Supabase",
    engines: ["postgres"],
    typicalMaxConnections: 60,
    safeDirectPoolLimit: 1,
    hasPooledEndpoint: true,
    isPooledHost: (h) => h.includes("pooler.supabase"),
    note: "Use the Supavisor pooler host (port 6543, 'pooler.supabase.com') in serverless rather than the direct 5432 host.",
    matches: (h) => h.includes("supabase."),
  },
  {
    id: "aiven",
    label: "Aiven",
    engines: ["mysql", "postgres"],
    typicalMaxConnections: 20,
    safeDirectPoolLimit: 1,
    hasPooledEndpoint: false,
    note: "Free/Hobbyist plans have a very small max_connections; keep the pool at 1 per warm instance and pass the CA via DATABASE_SSL_CA_BASE64.",
    matches: (h) => h.endsWith(".aivencloud.com"),
  },
  {
    id: "planetscale",
    label: "PlanetScale",
    engines: ["mysql"],
    typicalMaxConnections: 1000,
    safeDirectPoolLimit: 1,
    hasPooledEndpoint: true,
    note: "PlanetScale proxies connections already; a tiny pool per instance is correct and TLS is required.",
    matches: (h) => h.includes("psdb.cloud") || h.endsWith(".planetscale.com"),
  },
  {
    id: "vercel-postgres",
    label: "Vercel Postgres",
    engines: ["postgres"],
    typicalMaxConnections: 100,
    safeDirectPoolLimit: 1,
    hasPooledEndpoint: true,
    isPooledHost: (h) => h.includes("-pooler."),
    note: "Backed by Neon; prefer the pooled host in serverless functions.",
    matches: (h) => h.includes(".vercel-storage.com"),
  },
  {
    id: "railway",
    label: "Railway",
    engines: ["mysql", "postgres"],
    typicalMaxConnections: 100,
    safeDirectPoolLimit: 2,
    hasPooledEndpoint: false,
    note: "No managed pooler; keep the per-instance pool small.",
    matches: (h) => h.includes("railway.app") || h.includes("rlwy.net"),
  },
  {
    id: "render",
    label: "Render",
    engines: ["postgres"],
    typicalMaxConnections: 97,
    safeDirectPoolLimit: 2,
    hasPooledEndpoint: false,
    note: "Free/starter Postgres has a modest cap; keep the per-instance pool small.",
    matches: (h) => h.endsWith(".render.com"),
  },
  {
    id: "rds",
    label: "Amazon RDS / Aurora",
    engines: ["mysql", "postgres"],
    typicalMaxConnections: 30,
    safeDirectPoolLimit: 1,
    hasPooledEndpoint: true,
    note: "max_connections scales with instance size; micro/small classes are tiny. Consider RDS Proxy for serverless fan-out.",
    matches: (h) => h.includes(".rds.amazonaws.com"),
  },
];

const UNKNOWN: ProviderPreset = {
  id: "unknown",
  label: "Unknown provider",
  engines: ["mysql", "postgres"],
  typicalMaxConnections: 100,
  safeDirectPoolLimit: 1,
  hasPooledEndpoint: false,
  note: "Provider not recognized; defaulting to a conservative pool of 1 per instance.",
  matches: () => true,
};

/** All known presets (excluding the catch-all unknown). */
export function listProviders(): ReadonlyArray<ProviderPreset> {
  return PRESETS;
}

/** Identify the provider from a hostname. Always returns a preset. */
export function detectProvider(host: string): ProviderPreset {
  const h = host.toLowerCase();
  return PRESETS.find((p) => p.matches(h)) ?? UNKNOWN;
}

/** Look up a preset by id (returns the unknown preset if not found). */
export function getProvider(id: ProviderId): ProviderPreset {
  return PRESETS.find((p) => p.id === id) ?? UNKNOWN;
}

/** Is this host the provider's pooled endpoint, when one exists? */
export function isPooledEndpoint(host: string): boolean {
  const preset = detectProvider(host);
  return preset.hasPooledEndpoint && (preset.isPooledHost?.(host.toLowerCase()) ?? false);
}
