import assert from "node:assert/strict";
import { test } from "node:test";

import { buildDsn } from "../src/core/dsn.ts";
import { parseConnectionString } from "../src/core/url.ts";

test("builds a postgres dsn with default port", () => {
  const dsn = buildDsn({
    engine: "postgres",
    host: "db",
    user: "alice",
    password: "s3cr3t",
    database: "app",
  });
  const p = parseConnectionString(dsn);
  assert.equal(p.engine, "postgres");
  assert.equal(p.port, 5432);
  assert.equal(p.user, "alice");
  assert.equal(p.password, "s3cr3t");
  assert.equal(p.database, "app");
});

test("round-trips through parse with params and custom port", () => {
  const dsn = buildDsn({
    engine: "mysql",
    host: "h",
    port: 3307,
    user: "u",
    password: "p",
    database: "d",
    params: { sslmode: "require" },
  });
  const p = parseConnectionString(dsn);
  assert.equal(p.port, 3307);
  assert.equal(p.params.sslmode, "require");
});

test("encodes special characters in credentials", () => {
  const dsn = buildDsn({
    engine: "mysql",
    host: "h",
    user: "u@corp",
    password: "p/w@x",
    database: "d",
  });
  const p = parseConnectionString(dsn);
  assert.equal(p.user, "u@corp");
  assert.equal(p.password, "p/w@x");
});

test("omits password when not provided", () => {
  const dsn = buildDsn({ engine: "mysql", host: "h", user: "u", database: "d" });
  assert.ok(!dsn.includes("@h") === false); // sanity: host present
  assert.equal(parseConnectionString(dsn).password, undefined);
});

test("throws on missing required fields", () => {
  assert.throws(() => buildDsn({ engine: "mysql", host: "", user: "u", database: "d" }), /host/);
  assert.throws(() => buildDsn({ engine: "mysql", host: "h", user: "", database: "d" }), /user/);
  assert.throws(() => buildDsn({ engine: "mysql", host: "h", user: "u", database: "" }), /database/);
});
