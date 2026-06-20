// Preflight: a single startup gate combining config + diagnostics, with an
// optional live reachability probe.
//
// Lives in the application layer: it composes core (config) and application
// (diagnostics). The live probe is *injected* as a function rather than
// imported from adapters, so this module keeps the dependency rule intact
// (application must not import adapters) while still supporting a real check.

import { loadPoolConfig } from "../core/config.ts";
import { redactUrl } from "../core/url.ts";
import { diagnose, type Diagnostic, type DiagnoseReport } from "./diagnostics.ts";
import { type Env } from "../core/env.ts";

export interface PreflightOptions {
  /**
   * Optional live reachability probe. Return true if the DB answered. Inject
   * the adapter's `isReachable(pool)` here when you want a real connection test;
   * omit it for a static (no-I/O) preflight.
   */
  probe?: () => Promise<boolean>;
  /** Peak warm instances, forwarded to the budget checks. */
  expectedInstances?: number;
}

export interface PreflightResult {
  /** Overall pass: no `error` diagnostics and (if probed) the DB was reachable. */
  ok: boolean;
  safeUrl: string;
  report: DiagnoseReport;
  /** Present only when a probe was supplied. */
  reachable?: boolean;
  diagnostics: Diagnostic[];
}

/**
 * Run a preflight check over the connection in `env`. Never throws for a
 * reachability failure — the probe result is folded into `ok`. Throws only when
 * `env` has no connection URL at all (a programming/config error).
 */
export async function preflight(
  env: Env,
  options: PreflightOptions = {},
): Promise<PreflightResult> {
  const config = loadPoolConfig(env); // throws if no URL — intentional

  const report = diagnose({
    url: config.url,
    poolLimit: config.poolLimit,
    hasCaCert: config.hasTls,
    ...(options.expectedInstances
      ? { expectedInstances: options.expectedInstances }
      : {}),
  });

  const diagnostics = [...report.diagnostics];
  let reachable: boolean | undefined;

  if (options.probe) {
    reachable = await options.probe().catch(() => false);
    if (!reachable) {
      diagnostics.push({
        severity: "error",
        code: "UNREACHABLE",
        message: "Database did not respond to the reachability probe.",
      });
    }
  }

  const ok =
    !diagnostics.some((d) => d.severity === "error") &&
    (reachable ?? true);

  return {
    ok,
    safeUrl: redactUrl(config.url),
    report,
    ...(reachable === undefined ? {} : { reachable }),
    diagnostics,
  };
}
