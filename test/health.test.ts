import assert from "node:assert/strict";
import { test } from "node:test";

import { checkHealth, isReachable, type Queryable } from "../src/adapters/health.ts";

const okDb: Queryable = { query: async () => [[{ "1": 1 }]] };
const failDb: Queryable = {
  query: async () => {
    throw new Error("connection refused");
  },
};
const slowDb: Queryable = {
  query: () => new Promise((r) => setTimeout(r, 50)),
};

test("healthy db reports healthy with a latency", async () => {
  const r = await checkHealth(okDb);
  assert.equal(r.healthy, true);
  assert.ok(r.latencyMs >= 0);
  assert.equal(r.error, undefined);
});

test("failing db reports unhealthy and carries the error", async () => {
  const r = await checkHealth(failDb);
  assert.equal(r.healthy, false);
  assert.match(r.error!.message, /connection refused/);
});

test("custom probe sql is accepted", async () => {
  let seen = "";
  const db: Queryable = {
    query: async (sql: string) => {
      seen = sql;
    },
  };
  await checkHealth(db, { probeSql: "SELECT version()" });
  assert.equal(seen, "SELECT version()");
});

test("timeout makes a slow probe unhealthy", async () => {
  const r = await checkHealth(slowDb, { timeoutMs: 10 });
  assert.equal(r.healthy, false);
  assert.match(r.error!.message, /timed out/);
});

test("isReachable collapses to a boolean", async () => {
  assert.equal(await isReachable(okDb), true);
  assert.equal(await isReachable(failDb), false);
});
