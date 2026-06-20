import assert from "node:assert/strict";
import { test } from "node:test";

import { runCli } from "../src/presentation/cli.ts";

function run(argv: string[], env: NodeJS.ProcessEnv = {}) {
  const out: string[] = [];
  const err: string[] = [];
  const code = runCli({
    argv,
    env,
    out: (s) => out.push(s),
    err: (s) => err.push(s),
  });
  return { code, out: out.join("\n"), err: err.join("\n") };
}

test("help is printed with no args and exit 0", () => {
  const r = run([]);
  assert.equal(r.code, 0);
  assert.match(r.out, /Usage:/);
});

test("inspect on a clean config exits 0", () => {
  const r = run(["inspect"], {
    DATABASE_URL: "postgres://u:p@pg.aivencloud.com/db",
  });
  assert.equal(r.code, 0);
  assert.match(r.out, /diagnostics/);
});

test("inspect with a warning exits 1", () => {
  const r = run(["inspect"], {
    DATABASE_URL: "mysql://u:p@h.aivencloud.com/db",
    DATABASE_POOL_LIMIT: "20",
  });
  assert.equal(r.code, 1);
  assert.match(r.out, /SMALL_MAX_CONNECTIONS/);
});

test("inspect with no URL exits 2 with an error", () => {
  const r = run(["inspect"], {});
  assert.equal(r.code, 2);
  assert.match(r.err, /no connection URL/);
});

test("budget prints a recommendation (default reserve applied)", () => {
  // 100 - 3 reserved = 97 usable / 10 instances -> 9
  const r = run(["budget", "100", "10"]);
  assert.equal(r.code, 0);
  assert.match(r.out, /recommended pool limit: 9/);
});

test("budget with explicit zero reserve", () => {
  const r = run(["budget", "100", "10", "0"]);
  assert.equal(r.code, 0);
  assert.match(r.out, /recommended pool limit: 10/);
});

test("budget that exceeds the cap exits 1", () => {
  const r = run(["budget", "20", "50"]);
  assert.equal(r.code, 1);
  assert.match(r.out, /pooler/i);
});

test("budget with bad args exits 2", () => {
  const r = run(["budget", "abc"]);
  assert.equal(r.code, 2);
  assert.match(r.err, /usage/);
});

test("providers lists known providers", () => {
  const r = run(["providers"]);
  assert.equal(r.code, 0);
  assert.match(r.out, /aiven/);
  assert.match(r.out, /neon/);
});

test("unknown command exits 2", () => {
  const r = run(["frobnicate"]);
  assert.equal(r.code, 2);
  assert.match(r.err, /unknown command/);
});
