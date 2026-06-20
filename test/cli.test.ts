import assert from "node:assert/strict";
import { test } from "node:test";

import { runCli } from "../src/presentation/cli.ts";

async function run(argv: string[], env: NodeJS.ProcessEnv = {}) {
  const out: string[] = [];
  const err: string[] = [];
  const code = await runCli({
    argv,
    env,
    out: (s) => out.push(s),
    err: (s) => err.push(s),
  });
  return { code, out: out.join("\n"), err: err.join("\n") };
}

test("help is printed with no args and exit 0", async () => {
  const r = await run([]);
  assert.equal(r.code, 0);
  assert.match(r.out, /Usage:/);
});

test("inspect on a clean config exits 0", async () => {
  const r = await run(["inspect"], {
    DATABASE_URL: "postgres://u:p@pg.aivencloud.com/db",
  });
  assert.equal(r.code, 0);
  assert.match(r.out, /diagnostics/);
});

test("inspect with a warning exits 1", async () => {
  const r = await run(["inspect"], {
    DATABASE_URL: "mysql://u:p@h.aivencloud.com/db",
    DATABASE_POOL_LIMIT: "20",
  });
  assert.equal(r.code, 1);
  assert.match(r.out, /SMALL_MAX_CONNECTIONS/);
});

test("inspect with no URL exits 2 with an error", async () => {
  const r = await run(["inspect"], {});
  assert.equal(r.code, 2);
  assert.match(r.err, /no connection URL/);
});

test("budget prints a recommendation (default reserve applied)", async () => {
  // 100 - 3 reserved = 97 usable / 10 instances -> 9
  const r = await run(["budget", "100", "10"]);
  assert.equal(r.code, 0);
  assert.match(r.out, /recommended pool limit: 9/);
});

test("budget with explicit zero reserve", async () => {
  const r = await run(["budget", "100", "10", "0"]);
  assert.equal(r.code, 0);
  assert.match(r.out, /recommended pool limit: 10/);
});

test("budget that exceeds the cap exits 1", async () => {
  const r = await run(["budget", "20", "50"]);
  assert.equal(r.code, 1);
  assert.match(r.out, /pooler/i);
});

test("budget with bad args exits 2", async () => {
  const r = await run(["budget", "abc"]);
  assert.equal(r.code, 2);
  assert.match(r.err, /usage/);
});

test("recommend prints a provider and pool size", async () => {
  const r = await run(["recommend", "postgres://u:p@db.aivencloud.com/app", "10"]);
  assert.equal(r.code, 0);
  assert.match(r.out, /provider: aiven/);
  assert.match(r.out, /recommended pool limit:/);
});

test("recommend on an over-budget setup exits 1 and advises a pooler", async () => {
  const r = await run(["recommend", "postgres://u:p@ep-x.eu.aws.neon.tech/app", "500"]);
  assert.equal(r.code, 1);
  assert.match(r.out, /pooler is advised/);
});

test("recommend without a url exits 2", async () => {
  const r = await run(["recommend"]);
  assert.equal(r.code, 2);
  assert.match(r.err, /usage/);
});

test("providers lists known providers", async () => {
  const r = await run(["providers"]);
  assert.equal(r.code, 0);
  assert.match(r.out, /aiven/);
  assert.match(r.out, /neon/);
});

test("doctor passes on a clean config (exit 0)", async () => {
  const r = await run(["doctor"], {
    DATABASE_URL: "postgres://u:p@db.aivencloud.com/app",
  });
  assert.equal(r.code, 0);
  assert.match(r.out, /preflight passed/);
});

test("doctor flags issues (exit 1)", async () => {
  const r = await run(["doctor"], {
    DATABASE_URL: "mysql://u:p@db.aivencloud.com/app",
    DATABASE_POOL_LIMIT: "20",
  });
  assert.equal(r.code, 1);
  assert.match(r.out, /preflight found issues/);
});

test("doctor with no URL exits 2", async () => {
  const r = await run(["doctor"], {});
  assert.equal(r.code, 2);
  assert.match(r.err, /no connection URL/);
});

test("unknown command exits 2", async () => {
  const r = await run(["frobnicate"]);
  assert.equal(r.code, 2);
  assert.match(r.err, /unknown command/);
});
