import assert from "node:assert/strict";
import { test } from "node:test";

import { recommendPoolLimit } from "../src/budget.ts";

test("splits the usable budget across instances", () => {
  const r = recommendPoolLimit({
    maxConnections: 100,
    expectedInstances: 10,
    reserved: 0,
    otherClients: 0,
  });
  assert.equal(r.usableConnections, 100);
  assert.equal(r.recommendedPoolLimit, 10);
  assert.equal(r.projectedPeakUsage, 100);
  assert.equal(r.exceedsBudget, false);
});

test("subtracts reserved and other clients", () => {
  const r = recommendPoolLimit({
    maxConnections: 100,
    expectedInstances: 10,
    reserved: 10,
    otherClients: 10,
  });
  assert.equal(r.usableConnections, 80);
  assert.equal(r.recommendedPoolLimit, 8);
});

test("default reserve is applied when omitted", () => {
  const r = recommendPoolLimit({ maxConnections: 23, expectedInstances: 1 });
  // 23 - 3 reserved = 20 usable / 1 instance
  assert.equal(r.usableConnections, 20);
  assert.equal(r.recommendedPoolLimit, 20);
});

test("never recommends below 1", () => {
  const r = recommendPoolLimit({
    maxConnections: 20,
    expectedInstances: 50,
    reserved: 3,
  });
  assert.equal(r.recommendedPoolLimit, 1);
});

test("flags exceedsBudget when even 1 per instance overflows", () => {
  const r = recommendPoolLimit({
    maxConnections: 20,
    expectedInstances: 50,
    reserved: 3,
  });
  assert.equal(r.exceedsBudget, true);
  assert.match(r.rationale, /connection pooler/i);
});

test("floors fractional results", () => {
  const r = recommendPoolLimit({
    maxConnections: 25,
    expectedInstances: 7,
    reserved: 0,
  });
  // 25 / 7 = 3.57 -> 3
  assert.equal(r.recommendedPoolLimit, 3);
});

test("rejects non-positive inputs", () => {
  assert.throws(() => recommendPoolLimit({ maxConnections: 0, expectedInstances: 1 }), /maxConnections/);
  assert.throws(() => recommendPoolLimit({ maxConnections: 10, expectedInstances: 0 }), /expectedInstances/);
  assert.throws(() => recommendPoolLimit({ maxConnections: NaN, expectedInstances: 1 }), /maxConnections/);
});

test("rationale is populated in the happy path", () => {
  const r = recommendPoolLimit({ maxConnections: 50, expectedInstances: 5 });
  assert.match(r.rationale, /per instance/);
});
