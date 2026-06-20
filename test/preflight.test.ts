import assert from "node:assert/strict";
import { test } from "node:test";

import { preflight } from "../src/application/preflight.ts";

test("static preflight passes for a clean config", async () => {
  const r = await preflight({ DATABASE_URL: "postgres://u:p@db.aivencloud.com/app" });
  assert.equal(r.ok, true);
  assert.equal(r.reachable, undefined);
  assert.match(r.safeUrl, /\*\*\*/);
});

test("preflight surfaces diagnostics (e.g. pool too large)", async () => {
  const r = await preflight({
    DATABASE_URL: "mysql://u:p@db.aivencloud.com/app",
    DATABASE_POOL_LIMIT: "20",
  });
  assert.ok(r.diagnostics.some((d) => d.code === "SMALL_MAX_CONNECTIONS"));
});

test("a passing probe keeps ok true and sets reachable", async () => {
  const r = await preflight(
    { DATABASE_URL: "postgres://u:p@db.aivencloud.com/app" },
    { probe: async () => true },
  );
  assert.equal(r.reachable, true);
  assert.equal(r.ok, true);
});

test("a failing probe flips ok to false with UNREACHABLE", async () => {
  const r = await preflight(
    { DATABASE_URL: "postgres://u:p@db.aivencloud.com/app" },
    { probe: async () => false },
  );
  assert.equal(r.reachable, false);
  assert.equal(r.ok, false);
  assert.ok(r.diagnostics.some((d) => d.code === "UNREACHABLE"));
});

test("a throwing probe is treated as unreachable, not an exception", async () => {
  const r = await preflight(
    { DATABASE_URL: "postgres://u:p@db.aivencloud.com/app" },
    {
      probe: async () => {
        throw new Error("connect ECONNREFUSED");
      },
    },
  );
  assert.equal(r.reachable, false);
  assert.equal(r.ok, false);
});

test("throws when env has no URL", async () => {
  await assert.rejects(preflight({}), /no connection URL/);
});
