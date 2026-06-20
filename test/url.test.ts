import assert from "node:assert/strict";
import { test } from "node:test";

import {
  defaultPort,
  parseConnectionString,
  redactUrl,
  urlRequestsSsl,
} from "../src/url.ts";

test("parses a full postgres URI", () => {
  const p = parseConnectionString(
    "postgres://alice:s3cr3t@db.example.com:6543/app?sslmode=require",
  );
  assert.equal(p.engine, "postgres");
  assert.equal(p.host, "db.example.com");
  assert.equal(p.port, 6543);
  assert.equal(p.user, "alice");
  assert.equal(p.password, "s3cr3t");
  assert.equal(p.database, "app");
  assert.equal(p.params.sslmode, "require");
});

test("parses a mysql URI and applies default port", () => {
  const p = parseConnectionString("mysql://root@127.0.0.1/test");
  assert.equal(p.engine, "mysql");
  assert.equal(p.port, 3306);
  assert.equal(p.password, undefined);
  assert.equal(p.database, "test");
});

test("accepts postgresql:// and mariadb:// aliases", () => {
  assert.equal(parseConnectionString("postgresql://u@h/d").engine, "postgres");
  assert.equal(parseConnectionString("mariadb://u@h/d").engine, "mysql");
});

test("decodes percent-encoded credentials and db name", () => {
  const p = parseConnectionString("mysql://u%40corp:p%2Fw@h/my%20db");
  assert.equal(p.user, "u@corp");
  assert.equal(p.password, "p/w");
  assert.equal(p.database, "my db");
});

test("rejects unsupported protocol", () => {
  assert.throws(() => parseConnectionString("redis://h:6379"), /unsupported/);
});

test("rejects malformed URI", () => {
  assert.throws(() => parseConnectionString("not a uri"), /not a valid URI/);
});

test("defaultPort", () => {
  assert.equal(defaultPort("mysql"), 3306);
  assert.equal(defaultPort("postgres"), 5432);
});

test("redactUrl masks the password, keeps everything else", () => {
  assert.equal(
    redactUrl("postgres://alice:s3cr3t@db:5432/app?sslmode=require"),
    "postgres://alice:***@db:5432/app?sslmode=require",
  );
});

test("redactUrl is a no-op when there is no password", () => {
  assert.equal(redactUrl("mysql://root@h/t"), "mysql://root@h/t");
});

test("redactUrl never throws on garbage", () => {
  assert.equal(redactUrl("xxxx"), "<invalid-connection-string>");
});

test("urlRequestsSsl detects the common spellings", () => {
  assert.equal(urlRequestsSsl("postgres://u@h/d?sslmode=require"), true);
  assert.equal(urlRequestsSsl("postgres://u@h/d?sslmode=verify-full"), true);
  assert.equal(urlRequestsSsl("mysql://u@h/d?ssl-mode=REQUIRED"), true);
  assert.equal(urlRequestsSsl("mysql://u@h/d?ssl=true"), true);
  assert.equal(urlRequestsSsl("mysql://u@h/d"), false);
  assert.equal(urlRequestsSsl("postgres://u@h/d?sslmode=disable"), false);
});
