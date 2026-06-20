import assert from "node:assert/strict";
import { test } from "node:test";

import { loadPoolConfig } from "../src/core/config.ts";

test("loads a minimal mysql config with defaults", () => {
  const c = loadPoolConfig({ DATABASE_URL: "mysql://u:p@h.aivencloud.com/db" });
  assert.equal(c.engine, "mysql");
  assert.equal(c.host, "h.aivencloud.com");
  assert.equal(c.poolLimit, 1);
  assert.equal(c.hasTls, false);
  assert.equal(c.caCert, undefined);
});

test("resolves engine for postgres and honors pool limit", () => {
  const c = loadPoolConfig({
    POSTGRES_URL: "postgres://u:p@h/db",
    DATABASE_POOL_LIMIT: "4",
  });
  assert.equal(c.engine, "postgres");
  assert.equal(c.poolLimit, 4);
});

test("decodes TLS when CA is supplied", () => {
  const c = loadPoolConfig({
    DATABASE_URL: "mysql://u:p@h/db",
    DATABASE_SSL_CA_BASE64: Buffer.from("PEM").toString("base64"),
  });
  assert.equal(c.hasTls, true);
  assert.equal(c.caCert, "PEM");
});

test("throws when no URL env is present", () => {
  assert.throws(() => loadPoolConfig({}), /no connection URL/);
});
