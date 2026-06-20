// Integration tests: prove the option objects actually drive real pools.
//
// Skipped automatically unless RUN_DB_TESTS=1 (so `npm test` stays hermetic).
// Bring DBs up with: docker compose -f docker-compose.test.yml up -d
// Then run:          RUN_DB_TESTS=1 npm run test:integration

import assert from "node:assert/strict";
import { test } from "node:test";

import { checkHealth } from "../../src/adapters/health.ts";
import { buildMysqlPoolOptions } from "../../src/adapters/mysql.ts";
import { buildPgPoolOptions } from "../../src/adapters/pg.ts";

const enabled = process.env.RUN_DB_TESTS === "1";

test(
  "mysql2: a connectionLimit:1 pool serves concurrent queries (queued, not refused)",
  { skip: enabled ? false : "set RUN_DB_TESTS=1" },
  async () => {
    const mysql = await import("mysql2/promise");
    const opts = buildMysqlPoolOptions({
      DATABASE_URL:
        process.env.MYSQL_TEST_URL ?? "mysql://root:test@127.0.0.1:3399/test",
    });
    assert.equal(opts.connectionLimit, 1);

    const pool = mysql.createPool(opts);
    try {
      // 10 concurrent queries through a single connection: must all succeed.
      const results = await Promise.all(
        Array.from({ length: 10 }, (_, i) =>
          pool.query("SELECT ? AS n", [i]).then(([rows]) => (rows as any)[0].n),
        ),
      );
      assert.deepEqual(
        results.sort((a, b) => a - b),
        [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
      );
    } finally {
      await pool.end();
    }
  },
);

test(
  "pg: a max:1 pool serves concurrent queries (queued, not refused)",
  { skip: enabled ? false : "set RUN_DB_TESTS=1" },
  async () => {
    const { Pool } = await import("pg");
    const opts = buildPgPoolOptions({
      DATABASE_URL:
        process.env.PG_TEST_URL ??
        "postgres://postgres:test@127.0.0.1:5499/test",
    });
    assert.equal(opts.max, 1);

    const pool = new Pool(opts);
    try {
      const results = await Promise.all(
        Array.from({ length: 10 }, (_, i) =>
          pool.query("SELECT $1::int AS n", [i]).then((r) => r.rows[0].n),
        ),
      );
      assert.deepEqual(
        results.sort((a, b) => a - b),
        [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
      );
    } finally {
      await pool.end();
    }
  },
);

test(
  "checkHealth works against a real mysql2 pool via the Queryable port",
  { skip: enabled ? false : "set RUN_DB_TESTS=1" },
  async () => {
    const mysql = await import("mysql2/promise");
    const pool = mysql.createPool(
      buildMysqlPoolOptions({
        DATABASE_URL:
          process.env.MYSQL_TEST_URL ?? "mysql://root:test@127.0.0.1:3399/test",
      }),
    );
    try {
      const h = await checkHealth(pool, { timeoutMs: 5000 });
      assert.equal(h.healthy, true);
      assert.ok(h.latencyMs >= 0);
    } finally {
      await pool.end();
    }
  },
);

test(
  "checkHealth works against a real pg pool via the Queryable port",
  { skip: enabled ? false : "set RUN_DB_TESTS=1" },
  async () => {
    const { Pool } = await import("pg");
    const pool = new Pool(
      buildPgPoolOptions({
        DATABASE_URL:
          process.env.PG_TEST_URL ??
          "postgres://postgres:test@127.0.0.1:5499/test",
      }),
    );
    try {
      const h = await checkHealth(pool, { timeoutMs: 5000 });
      assert.equal(h.healthy, true);
    } finally {
      await pool.end();
    }
  },
);
