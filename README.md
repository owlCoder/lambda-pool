# lambda-pool

[![npm version](https://img.shields.io/npm/v/lambda-pool.svg)](https://www.npmjs.com/package/lambda-pool)
[![license](https://img.shields.io/npm/l/lambda-pool.svg)](./LICENSE)
[![types](https://img.shields.io/npm/types/lambda-pool.svg)](https://www.npmjs.com/package/lambda-pool)
[![zero deps](https://img.shields.io/badge/runtime%20deps-0-22c55e.svg)](#zero-runtime-dependencies)

Serverless-safe **connection-pool options** for **MySQL** (`mysql2`) and **Postgres** (`pg`)
on Vercel / AWS Lambda / Cloudflare-to-DB, where the database has a **small
`max_connections`** budget (Aiven free tier, Neon, Supabase, RDS micro, PlanetScale).

It returns a plain options object you pass to your own driver. **Zero runtime
dependencies.** It does not open connections, wrap your driver, or pin a version.

```bash
npm install lambda-pool
```

## The bug this prevents

On Vercel/Lambda every **warm** function instance keeps **its own** pool. If each
pool opens `N` connections and the platform keeps `M` instances warm, your
database sees up to **`N × M`** connections.

Managed databases on small plans cap `max_connections` very low (often **10–25**).
So a perfectly reasonable-looking `connectionLimit: 10` blows the budget under
mild traffic and you get:

- MySQL: `ER_CON_COUNT_ERROR: Too many connections`
- Postgres: `sorry, too many clients already`

…intermittently, only in production, only under load. The classic "works on my
machine, dies on Black Friday" footgun.

## The fix (and why it's counter-intuitive)

Make each pool **tiny** — default **1 connection per instance**. The platform's
horizontal scaling *is* your concurrency; the database stops melting. Idle
instances release their slot so they don't sit on the budget.

That's the whole idea. This package just encodes the right defaults so you don't
have to rediscover them in an incident.

## Usage

### MySQL (`mysql2`)

```ts
import mysql from "mysql2/promise";
import { buildMysqlPoolOptions } from "lambda-pool/mysql";

const pool = mysql.createPool(buildMysqlPoolOptions(process.env));
```

### Postgres (`pg`)

```ts
import { Pool } from "pg";
import { buildPgPoolOptions } from "lambda-pool/pg";

const pool = new Pool(buildPgPoolOptions(process.env));
```

Both also re-exported from the root: `import { buildPgPoolOptions } from "lambda-pool"`.

## Diagnostics — lint your connection for serverless

Beyond building options, `lambda-pool` can **analyze** a connection config and
tell you whether it will survive serverless fan-out. Pure function, no I/O:

```ts
import { inspectEnv, formatReport } from "lambda-pool";

const report = inspectEnv(process.env);
console.log(formatReport(report));
// lambda-pool diagnostics for mysql://u:***@pg.aivencloud.com/db [aiven]
//   ⚠ SMALL_MAX_CONNECTIONS: Aiven typically caps max_connections around 20; keep the per-instance pool at 1.
```

It recognizes the provider from the host (Aiven, Neon, Supabase, PlanetScale,
RDS/Aurora, Railway, Render, Vercel Postgres) and warns about: pool sizes too
large for the provider's budget, SSL requested in the URL with no CA supplied,
and using a direct host when a pooled endpoint is available.

## CLI

```bash
# Lint the connection in your env (exit 1 on any warning — good as a CI gate)
DATABASE_URL=postgres://… npx lambda-pool inspect

# Recommend a per-instance pool size: max_connections, instances, [reserved], [other]
npx lambda-pool budget 100 20
#   recommended pool limit: 4
#   97 usable connections (100 max − 3 reserved − 0 other) ÷ 20 instances → pool of 4 per instance (peak 80).

# List recognized providers
npx lambda-pool providers
```

## Budget calculator (programmatic)

```ts
import { recommendPoolLimit } from "lambda-pool";

const { recommendedPoolLimit, exceedsBudget, rationale } = recommendPoolLimit({
  maxConnections: 20,   // your DB's max_connections
  expectedInstances: 30, // peak warm serverless instances
});
// recommendedPoolLimit: 1, exceedsBudget: true → use a pooler
```

## Connection-string utilities

```ts
import { parseConnectionString, redactUrl } from "lambda-pool";

redactUrl("postgres://u:secret@host/db"); // → "postgres://u:***@host/db"
parseConnectionString("mysql://root@127.0.0.1/test").port; // → 3306
```

## Environment variables

| Variable | Purpose | Default |
|---|---|---|
| `DATABASE_URL` | Connection URI. Aliases: `MYSQL_URL` / `POSTGRES_URL` / `PG_URL`. | **required** |
| `DATABASE_POOL_LIMIT` | Per-instance pool size. Raise **only** behind a pooler (PgBouncer, Neon pooled endpoint) or on a bigger plan. | `1` |
| `DATABASE_SSL_CA_BASE64` | Base64 of your provider's CA cert → enables strict TLS. | off |

A non-positive or non-numeric `DATABASE_POOL_LIMIT` is ignored and falls back to
the default, so a bad env var can never silently widen the pool.

## What the defaults are

**MySQL** (`mysql2` `PoolOptions`): `connectionLimit: 1`, `maxIdle: 1`,
`idleTimeout: 30000`, `enableKeepAlive: true`, `waitForConnections: true`,
`queueLimit: 0`.

**Postgres** (`pg` `PoolConfig`): `max: 1`, `idleTimeoutMillis: 30000`,
`connectionTimeoutMillis: 10000`, `maxUses: 7500`, `allowExitOnIdle: true`.

Override the default size in code without an env var:

```ts
buildPgPoolOptions(process.env, { defaultPoolLimit: 2 }); // behind a pooler
```

### A note on TLS

Managed providers hand you a CA bundle, but the URI's `?ssl-mode=REQUIRED` /
`?sslmode=require` param is **not** interpreted by `mysql2` / `pg` the way people
expect. Pass the CA explicitly via `DATABASE_SSL_CA_BASE64` and the server is
verified (`rejectUnauthorized: true`).

## Zero runtime dependencies

`lambda-pool` imports nothing at runtime. `mysql2` / `pg` are **your** dependency
and only `devDependencies` here (for tests/types). You stay in control of the
driver version.

## Development

```bash
npm install
npm run typecheck
npm test            # hermetic unit tests, no DB needed
npm run build
```

Integration tests run the option objects against real `mysql2` / `pg` pools,
using throwaway containers whose `max_connections` is pinned to 10 to mirror a
free tier:

```bash
docker compose -f docker-compose.test.yml up -d
RUN_DB_TESTS=1 npm run test:integration
docker compose -f docker-compose.test.yml down -v
```

## License

MIT
