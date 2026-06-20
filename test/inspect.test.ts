import assert from "node:assert/strict";
import { test } from "node:test";

import { inspectEnv } from "../src/application/inspect.ts";

test("inspects from DATABASE_URL with defaults", () => {
  const r = inspectEnv({ DATABASE_URL: "postgres://u:p@pg.aivencloud.com/db" });
  assert.equal(r.provider, "aiven");
  assert.equal(r.ok, true);
});

test("uses MYSQL_URL alias", () => {
  const r = inspectEnv({ MYSQL_URL: "mysql://u:p@h.aivencloud.com/db" });
  assert.equal(r.provider, "aiven");
});

test("respects DATABASE_POOL_LIMIT for warnings", () => {
  const r = inspectEnv({
    DATABASE_URL: "mysql://u:p@h.aivencloud.com/db",
    DATABASE_POOL_LIMIT: "20",
  });
  assert.ok(r.diagnostics.some((d) => d.code === "SMALL_MAX_CONNECTIONS"));
});

test("flags SSL-without-CA when no CA env present", () => {
  const r = inspectEnv({
    DATABASE_URL: "postgres://u:p@h.aivencloud.com/db?sslmode=require",
  });
  assert.ok(r.diagnostics.some((d) => d.code === "SSL_WITHOUT_CA"));
});

test("no SSL warning when CA env present", () => {
  const r = inspectEnv({
    DATABASE_URL: "postgres://u:p@h.aivencloud.com/db?sslmode=require",
    DATABASE_SSL_CA_BASE64: Buffer.from("CA").toString("base64"),
  });
  assert.ok(!r.diagnostics.some((d) => d.code === "SSL_WITHOUT_CA"));
});

test("throws when no URL env is set", () => {
  assert.throws(() => inspectEnv({}), /no connection URL/);
});
