import assert from "node:assert/strict";
import { test } from "node:test";

import {
  detectProvider,
  getProvider,
  isPooledEndpoint,
  listProviders,
} from "../src/core/providers.ts";

test("detects each known provider by host", () => {
  assert.equal(detectProvider("ep-cool-1.eu-central-1.aws.neon.tech").id, "neon");
  assert.equal(detectProvider("db.abcd.supabase.co").id, "supabase");
  assert.equal(detectProvider("pg-123.aivencloud.com").id, "aiven");
  assert.equal(detectProvider("aws.connect.psdb.cloud").id, "planetscale");
  assert.equal(detectProvider("mydb.abc.us-east-1.rds.amazonaws.com").id, "rds");
  assert.equal(detectProvider("containers-us-west-1.railway.app").id, "railway");
  assert.equal(detectProvider("dpg-xyz.oregon-postgres.render.com").id, "render");
});

test("detection is case-insensitive", () => {
  assert.equal(detectProvider("PG-123.AIVENCLOUD.COM").id, "aiven");
});

test("falls back to unknown for unrecognized hosts", () => {
  const p = detectProvider("db.mycompany.internal");
  assert.equal(p.id, "unknown");
  assert.equal(p.safeDirectPoolLimit, 1);
});

test("isPooledEndpoint is true only for pooled hosts", () => {
  assert.equal(isPooledEndpoint("ep-cool-1-pooler.eu.aws.neon.tech"), true);
  assert.equal(isPooledEndpoint("ep-cool-1.eu.aws.neon.tech"), false);
  // aiven has no pooled endpoint
  assert.equal(isPooledEndpoint("pg-123.aivencloud.com"), false);
});

test("getProvider returns the requested preset", () => {
  assert.equal(getProvider("neon").label, "Neon");
  assert.equal(getProvider("unknown").id, "unknown");
});

test("listProviders returns all real presets with sane fields", () => {
  const all = listProviders();
  assert.ok(all.length >= 7);
  for (const p of all) {
    assert.ok(p.typicalMaxConnections > 0, `${p.id} max_connections`);
    assert.ok(p.safeDirectPoolLimit >= 1, `${p.id} pool limit`);
    assert.ok(p.note.length > 0, `${p.id} note`);
    assert.notEqual(p.id, "unknown");
  }
});
