// lambda-pool — serverless-safe connection-pool options for MySQL and Postgres.
//
// Root entry re-exports both adapters and the shared helpers. You can also
// import the narrow subpaths to avoid pulling in the other driver's types:
//
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
  type Env,
  type DecodedTls,
  resolvePoolLimit,
  decodeCaBase64,
  firstEnv,
} from "./shared.ts";
