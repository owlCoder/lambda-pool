import assert from "node:assert/strict";
import { test } from "node:test";

import { recommendForUrl } from "../src/application/recommend.ts";

test("recommends from the provider's typical budget", () => {
  const r = recommendForUrl({
    url: "postgres://u:p@db.aivencloud.com/app",
    expectedInstances: 10,
  });
  assert.equal(r.provider, "aiven");
  // aiven typical 20 - 3 reserved = 17 / 10 -> 1
  assert.equal(r.recommendedPoolLimit, 1);
  assert.equal(r.assumedMaxConnections, 20);
});

test("advises a pooler when budget is exceeded and one exists", () => {
  const r = recommendForUrl({
    url: "postgres://u:p@ep-x.eu.aws.neon.tech/app",
    expectedInstances: 500, // way over even Neon's 100
  });
  assert.equal(r.provider, "neon");
  assert.equal(r.exceedsBudget, true);
  assert.equal(r.poolerAdvised, true);
});

test("does not advise a pooler when already on the pooled endpoint", () => {
  const r = recommendForUrl({
    url: "postgres://u:p@ep-x-pooler.eu.aws.neon.tech/app",
    expectedInstances: 500,
  });
  assert.equal(r.usingPooledEndpoint, true);
  assert.equal(r.poolerAdvised, false);
});

test("respects an explicit maxConnections override", () => {
  const r = recommendForUrl({
    url: "postgres://u:p@db.aivencloud.com/app",
    expectedInstances: 10,
    maxConnections: 200,
  });
  assert.equal(r.assumedMaxConnections, 200);
  // 200 - 3 = 197 / 10 -> 19
  assert.equal(r.recommendedPoolLimit, 19);
});
