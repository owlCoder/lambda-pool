// Diagnostics: inspect a connection config and surface actionable warnings.
//
// Composes the pure modules (url, providers, budget) into a single advisory
// report. Returns data — it never logs or throws — so callers decide how to
// present it (CLI, startup log, test assertion). This is the "lint your DB
// connection for serverless" feature.

import { recommendPoolLimit } from "./budget.ts";
import { detectProvider, isPooledEndpoint, type ProviderId } from "./providers.ts";
import { parseConnectionString, redactUrl, urlRequestsSsl } from "./url.ts";

export type Severity = "error" | "warning" | "info";

export interface Diagnostic {
  severity: Severity;
  code: string;
  message: string;
}

export interface DiagnoseInput {
  /** The connection URI to analyze. */
  url: string;
  /** The pool size you intend to use (per warm instance). */
  poolLimit: number;
  /** Whether a CA cert was supplied out-of-band (DATABASE_SSL_CA_BASE64). */
  hasCaCert?: boolean;
  /** Peak warm instances, for budget checks. Defaults to a typical serverless fan-out. */
  expectedInstances?: number;
}

export interface DiagnoseReport {
  /** Password-redacted URL, safe to log alongside the report. */
  safeUrl: string;
  provider: ProviderId;
  diagnostics: Diagnostic[];
  /** True when no `error`-severity diagnostics are present. */
  ok: boolean;
}

const DEFAULT_EXPECTED_INSTANCES = 20;

/**
 * Analyze a connection config for serverless safety. Pure: returns a report,
 * performs no I/O.
 */
export function diagnose(input: DiagnoseInput): DiagnoseReport {
  const diagnostics: Diagnostic[] = [];
  const safeUrl = redactUrl(input.url);

  let parsed;
  try {
    parsed = parseConnectionString(input.url);
  } catch (e) {
    diagnostics.push({
      severity: "error",
      code: "INVALID_URL",
      message: (e as Error).message,
    });
    return { safeUrl, provider: "unknown", diagnostics, ok: false };
  }

  const preset = detectProvider(parsed.host);
  const pooled = isPooledEndpoint(parsed.host);
  const instances = input.expectedInstances ?? DEFAULT_EXPECTED_INSTANCES;

  // 1) Pool size sanity against the provider's typical budget.
  const budget = recommendPoolLimit({
    maxConnections: preset.typicalMaxConnections,
    expectedInstances: instances,
  });
  if (!pooled && input.poolLimit > budget.recommendedPoolLimit) {
    diagnostics.push({
      severity: "warning",
      code: "POOL_TOO_LARGE",
      message:
        `poolLimit ${input.poolLimit} may exceed ${preset.label}'s budget: ` +
        `${budget.rationale} Lower poolLimit or use a pooler.`,
    });
  }

  // 2) Provider has a pooler but you're on the direct host.
  if (preset.hasPooledEndpoint && !pooled && input.poolLimit > 1) {
    diagnostics.push({
      severity: "info",
      code: "POOLER_AVAILABLE",
      message: `${preset.label} offers a pooled endpoint. ${preset.note}`,
    });
  }

  // 3) SSL requested in the URL but no CA supplied → likely silent fallback.
  if (urlRequestsSsl(input.url) && !input.hasCaCert) {
    diagnostics.push({
      severity: "warning",
      code: "SSL_WITHOUT_CA",
      message:
        "URL requests SSL but no CA cert was provided (DATABASE_SSL_CA_BASE64). " +
        "mysql2/pg may not verify the server as you expect; pass the CA explicitly.",
    });
  }

  // 4) A pool larger than 1 with no pooler on a tiny-budget provider.
  if (
    !preset.hasPooledEndpoint &&
    input.poolLimit > preset.safeDirectPoolLimit &&
    preset.typicalMaxConnections <= 30
  ) {
    diagnostics.push({
      severity: "warning",
      code: "SMALL_MAX_CONNECTIONS",
      message:
        `${preset.label} typically caps max_connections around ${preset.typicalMaxConnections}; ` +
        `keep the per-instance pool at ${preset.safeDirectPoolLimit}.`,
    });
  }

  // 5) Friendly confirmation when everything looks right.
  if (diagnostics.length === 0) {
    diagnostics.push({
      severity: "info",
      code: "OK",
      message: `Configuration looks serverless-safe for ${preset.label}.`,
    });
  }

  const ok = !diagnostics.some((d) => d.severity === "error");
  return { safeUrl, provider: preset.id, diagnostics, ok };
}

/** Format a report as plain text lines (for CLI / startup logs). */
export function formatReport(report: DiagnoseReport): string {
  const head = `lambda-pool diagnostics for ${report.safeUrl} [${report.provider}]`;
  const lines = report.diagnostics.map(
    (d) => `  ${symbolFor(d.severity)} ${d.code}: ${d.message}`,
  );
  return [head, ...lines].join("\n");
}

function symbolFor(s: Severity): string {
  return s === "error" ? "✖" : s === "warning" ? "⚠" : "ℹ";
}
