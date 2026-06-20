import assert from "node:assert/strict";
import { test } from "node:test";

import { buildMysqlPoolOptions } from "../src/adapters/mysql.ts";
import { buildPgPoolOptions } from "../src/adapters/pg.ts";
import { decodeCaBase64, resolvePoolLimit } from "../src/core/env.ts";

test("resolvePoolLimit defaults to 1", () => {
  assert.equal(resolvePoolLimit(undefined), 1);
  assert.equal(resolvePoolLimit(""), 1);
});

test("resolvePoolLimit honors a valid override", () => {
  assert.equal(resolvePoolLimit("5"), 5);
  assert.equal(resolvePoolLimit("3.9"), 3); // floored
});

test("resolvePoolLimit ignores junk / non-positive and falls back", () => {
  assert.equal(resolvePoolLimit("0"), 1);
  assert.equal(resolvePoolLimit("-4"), 1);
  assert.equal(resolvePoolLimit("abc"), 1);
  assert.equal(resolvePoolLimit("", 2), 2);
});

test("decodeCaBase64 returns undefined when absent", () => {
  assert.equal(decodeCaBase64(undefined), undefined);
  assert.equal(decodeCaBase64(""), undefined);
});

test("decodeCaBase64 decodes and verifies", () => {
  const ca = Buffer.from("PEM-CONTENT").toString("base64");
  assert.deepEqual(decodeCaBase64(ca), {
    ca: "PEM-CONTENT",
    rejectUnauthorized: true,
  });
});

test("mysql: builds tiny pool by default", () => {
  const o = buildMysqlPoolOptions({ DATABASE_URL: "mysql://u:p@h/db" });
  assert.equal(o.connectionLimit, 1);
  assert.equal(o.maxIdle, 1);
  assert.equal(o.queueLimit, 0);
  assert.equal(o.ssl, undefined);
});

test("mysql: accepts MYSQL_URL alias and override + TLS", () => {
  const o = buildMysqlPoolOptions({
    MYSQL_URL: "mysql://u:p@h/db",
    DATABASE_POOL_LIMIT: "4",
    DATABASE_SSL_CA_BASE64: Buffer.from("CA").toString("base64"),
  });
  assert.equal(o.uri, "mysql://u:p@h/db");
  assert.equal(o.connectionLimit, 4);
  assert.deepEqual(o.ssl, { ca: "CA", rejectUnauthorized: true });
});

test("mysql: throws when no URL", () => {
  assert.throws(() => buildMysqlPoolOptions({}), /DATABASE_URL/);
});

test("pg: builds tiny pool by default", () => {
  const o = buildPgPoolOptions({ DATABASE_URL: "postgres://u:p@h/db" });
  assert.equal(o.max, 1);
  assert.equal(o.allowExitOnIdle, true);
  assert.equal(o.ssl, undefined);
});

test("pg: accepts POSTGRES_URL alias and override + TLS", () => {
  const o = buildPgPoolOptions({
    POSTGRES_URL: "postgres://u:p@h/db",
    DATABASE_POOL_LIMIT: "8",
    DATABASE_SSL_CA_BASE64: Buffer.from("CA").toString("base64"),
  });
  assert.equal(o.connectionString, "postgres://u:p@h/db");
  assert.equal(o.max, 8);
  assert.deepEqual(o.ssl, { ca: "CA", rejectUnauthorized: true });
});

test("pg: throws when no URL", () => {
  assert.throws(() => buildPgPoolOptions({}), /DATABASE_URL/);
});
