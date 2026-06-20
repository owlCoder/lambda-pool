import assert from "node:assert/strict";
import { test } from "node:test";

import { redact } from "../src/core/redact.ts";

test("masks common secret keys, case-insensitively", () => {
  const out = redact({
    user: "alice",
    password: "p",
    Token: "t",
    API_KEY: "k",
    host: "db",
  });
  assert.deepEqual(out, {
    user: "alice",
    password: "***",
    Token: "***",
    API_KEY: "***",
    host: "db",
  });
});

test("recurses into nested objects and arrays", () => {
  const out = redact({
    db: { url: "x", secret: "s" },
    list: [{ token: "a" }, { ok: 1 }],
  });
  assert.equal((out.db as Record<string, unknown>).secret, "***");
  assert.equal((out.list as Array<Record<string, unknown>>)[0].token, "***");
  assert.equal((out.list as Array<Record<string, unknown>>)[1].ok, 1);
});

test("leaves non-secret primitives untouched", () => {
  assert.deepEqual(redact({ a: 1, b: "two", c: true, d: null }), {
    a: 1,
    b: "two",
    c: true,
    d: null,
  });
});

test("supports custom keys and mask", () => {
  const out = redact({ ssn: "123", name: "x" }, { keys: ["ssn"], mask: "<hidden>" });
  assert.equal(out.ssn, "<hidden>");
  assert.equal(out.name, "x");
});

test("handles circular references safely", () => {
  const a: Record<string, unknown> = { name: "a" };
  a.self = a;
  const out = redact(a);
  assert.equal(out.name, "a");
  assert.equal(out.self, "[Circular]");
});

test("cuts off over-deep graphs", () => {
  let deep: Record<string, unknown> = { v: 1 };
  for (let i = 0; i < 12; i++) deep = { child: deep };
  const out = redact(deep, { maxDepth: 3 });
  // somewhere down the chain it becomes the depth-limit sentinel
  const s = JSON.stringify(out);
  assert.match(s, /Depth limit/);
});

test("does not mutate the input", () => {
  const input = { password: "p" };
  redact(input);
  assert.equal(input.password, "p");
});
