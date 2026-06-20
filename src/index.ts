// lambda-pool — serverless-safe connection-pool options for MySQL and Postgres.
//
// Clean-architecture layering (dependencies point inward only):
//
//   presentation/  cli, bin                 (process I/O)
//        │  depends on
//   adapters/      mysql, pg, health        (driver-facing option objects + ports)
//        │  depends on
//   application/   diagnostics, inspect     (use-cases composing the core)
//        │  depends on
//   core/          result, env, url,        (pure, zero-dep, no I/O)
//                  providers, budget, retry
//
// Nothing in core imports outward; adapters/presentation never leak into core.
// Subpaths are published per module so consumers can import the narrowest slice.

// ---- core ----
export {
  type Result,
  ok,
  err,
  attempt,
  unwrap,
  unwrapOr,
} from "./core/result.ts";

export {
  type Env,
  type DecodedTls,
  resolvePoolLimit,
  decodeCaBase64,
  firstEnv,
} from "./core/env.ts";

export {
  type Engine,
  type ParsedConnection,
  parseConnectionString,
  safeParseConnectionString,
  redactUrl,
  urlRequestsSsl,
  defaultPort,
} from "./core/url.ts";

export {
  type ProviderId,
  type ProviderPreset,
  detectProvider,
  getProvider,
  listProviders,
  isPooledEndpoint,
} from "./core/providers.ts";

export {
  type BudgetInput,
  type BudgetResult,
  recommendPoolLimit,
} from "./core/budget.ts";

export {
  type RetryOptions,
  backoffDelay,
  withRetry,
  isTransientDbError,
} from "./core/retry.ts";

// ---- application ----
export {
  type Severity,
  type Diagnostic,
  type DiagnoseInput,
  type DiagnoseReport,
  diagnose,
  formatReport,
} from "./application/diagnostics.ts";

export { type InspectEnv, inspectEnv } from "./application/inspect.ts";

// ---- adapters ----
export {
  buildMysqlPoolOptions,
  type MysqlPoolEnv,
  type MysqlPoolOptions,
  type BuildMysqlOptions,
} from "./adapters/mysql.ts";

export {
  buildPgPoolOptions,
  type PgPoolEnv,
  type PgPoolOptions,
  type BuildPgOptions,
} from "./adapters/pg.ts";

export {
  type Queryable,
  type HealthResult,
  type HealthOptions,
  checkHealth,
  isReachable,
} from "./adapters/health.ts";
