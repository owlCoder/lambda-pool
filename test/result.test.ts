import assert from "node:assert/strict";
import { test } from "node:test";

import { attempt, err, ok, unwrap, unwrapOr } from "../src/result.ts";
import { safeParseConnectionString } from "../src/url.ts";

test("ok and err construct discriminated results", () => {
  assert.deepEqual(ok(5), { ok: true, value: 5 });
  const e = err(new Error("x"));
  assert.equal(e.ok, false);
});

test("attempt captures success", () => {
  const r = attempt(() => 42);
  assert.deepEqual(r, { ok: true, value: 42 });
});

test("attempt captures thrown errors", () => {
  const r = attempt(() => {
    throw new Error("boom");
  });
  assert.equal(r.ok, false);
  if (!r.ok) assert.match(r.error.message, /boom/);
});

test("attempt wraps non-Error throws", () => {
  const r = attempt(() => {
    throw "plain string";
  });
  assert.equal(r.ok, false);
  if (!r.ok) assert.match(r.error.message, /plain string/);
});

test("unwrap returns value or throws", () => {
  assert.equal(unwrap(ok(7)), 7);
  assert.throws(() => unwrap(err(new Error("nope"))), /nope/);
});

test("unwrapOr returns fallback on error", () => {
  assert.equal(unwrapOr(ok(1), 9), 1);
  assert.equal(unwrapOr(err(new Error("x")), 9), 9);
});

test("safeParseConnectionString returns ok for valid uri", () => {
  const r = safeParseConnectionString("mysql://u@h/d");
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.value.engine, "mysql");
});

test("safeParseConnectionString returns err for junk", () => {
  const r = safeParseConnectionString("nope");
  assert.equal(r.ok, false);
});
