// lambda-pool — serverless-safe connection-pool options for MySQL and Postgres.
//
// Layering (clean architecture):
//   - url.ts         pure parsing/redaction      (no deps)
//   - providers.ts   pure preset registry        (no deps)
//   - budget.ts      pure connection-budget math (no deps)
//   - diagnostics.ts composes the above          (no I/O)
//   - mysql.ts/pg.ts adapters → driver option objects
//
// Narrow subpaths are also published so you can import just one driver's types:
//   import { buildMysqlPoolOptions } from "lambda-pool/mysql";
//   import { buildPgPoolOptions }    from "lambda-pool/pg";

export {
  buildMysqlPoolOptions,
  type MysqlPoolEnv,
  type MysqlPoolOptions,
  type BuildMysqlOptions,
} from "./mysql.ts";

export {
  buildPgPoolOptions,
  type PgPoolEnv,
  type PgPoolOptions,
  type BuildPgOptions,
} from "./pg.ts";

export {
  type Result,
  ok,
  err,
  attempt,
  unwrap,
  unwrapOr,
} from "./result.ts";

export {
  type Engine,
  type ParsedConnection,
  parseConnectionString,
  safeParseConnectionString,
  redactUrl,
  urlRequestsSsl,
  defaultPort,
} from "./url.ts";

export {
  type ProviderId,
  type ProviderPreset,
  detectProvider,
  getProvider,
  listProviders,
  isPooledEndpoint,
} from "./providers.ts";

export {
  type BudgetInput,
  type BudgetResult,
  recommendPoolLimit,
} from "./budget.ts";

export {
  type Severity,
  type Diagnostic,
  type DiagnoseInput,
  type DiagnoseReport,
  diagnose,
  formatReport,
} from "./diagnostics.ts";

export { type InspectEnv, inspectEnv } from "./inspect.ts";

export {
  type Queryable,
  type HealthResult,
  type HealthOptions,
  checkHealth,
  isReachable,
} from "./health.ts";

export {
  type RetryOptions,
  backoffDelay,
  withRetry,
  isTransientDbError,
} from "./retry.ts";

export {
  type Env,
  type DecodedTls,
  resolvePoolLimit,
  decodeCaBase64,
  firstEnv,
} from "./shared.ts";
