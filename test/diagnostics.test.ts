import assert from "node:assert/strict";
import { test } from "node:test";

import { diagnose, formatReport } from "../src/diagnostics.ts";

function codes(url: string, poolLimit: number, extra = {}) {
  return diagnose({ url, poolLimit, ...extra }).diagnostics.map((d) => d.code);
}

test("clean config on a tiny pool reports OK", () => {
  const r = diagnose({ url: "postgres://u:p@pg.aivencloud.com/db", poolLimit: 1 });
  assert.equal(r.ok, true);
  assert.equal(r.provider, "aiven");
  assert.deepEqual(r.diagnostics.map((d) => d.code), ["OK"]);
});

test("invalid url is a hard error and short-circuits", () => {
  const r = diagnose({ url: "redis://x", poolLimit: 1 });
  assert.equal(r.ok, false);
  assert.deepEqual(r.diagnostics.map((d) => d.code), ["INVALID_URL"]);
});

test("large pool on a small provider warns", () => {
  const c = codes("mysql://u:p@pg.aivencloud.com/db", 10);
  assert.ok(c.includes("SMALL_MAX_CONNECTIONS"));
});

test("ssl requested without CA warns", () => {
  const c = codes("postgres://u:p@pg.aivencloud.com/db?sslmode=require", 1, {
    hasCaCert: false,
  });
  assert.ok(c.includes("SSL_WITHOUT_CA"));
});

test("ssl requested WITH CA does not warn about SSL", () => {
  const c = codes("postgres://u:p@pg.aivencloud.com/db?sslmode=require", 1, {
    hasCaCert: true,
  });
  assert.ok(!c.includes("SSL_WITHOUT_CA"));
});

test("provider with a pooler suggests it on the direct host", () => {
  const c = codes("postgres://u:p@ep-x.eu.aws.neon.tech/db", 3);
  assert.ok(c.includes("POOLER_AVAILABLE"));
});

test("pooled endpoint does not trigger pool-size warnings", () => {
  const c = codes("postgres://u:p@ep-x-pooler.eu.aws.neon.tech/db", 5);
  assert.ok(!c.includes("POOL_TOO_LARGE"));
});

test("the report's safeUrl is redacted", () => {
  const r = diagnose({ url: "postgres://u:secret@pg.aivencloud.com/db", poolLimit: 1 });
  assert.ok(!r.safeUrl.includes("secret"));
  assert.match(r.safeUrl, /\*\*\*/);
});

test("formatReport renders header and lines", () => {
  const r = diagnose({ url: "mysql://u:p@h.aivencloud.com/db", poolLimit: 1 });
  const text = formatReport(r);
  assert.match(text, /lambda-pool diagnostics/);
  assert.match(text, /\[aiven\]/);
});
