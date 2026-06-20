import assert from "node:assert/strict";
import { test } from "node:test";

import {
  backoffDelay,
  isTransientDbError,
  withRetry,
} from "../src/retry.ts";

const noSleep = async () => {};

test("backoffDelay grows exponentially and is capped", () => {
  // random()=1 would give the cap; we force random()=0.999... to approach it
  const r = () => 0.9999999;
  assert.ok(backoffDelay(1, 100, 2000, r) < 100);
  assert.ok(backoffDelay(2, 100, 2000, r) < 200);
  assert.ok(backoffDelay(3, 100, 2000, r) < 400);
  // attempt 10 would be huge but is capped at maxDelayMs
  assert.ok(backoffDelay(10, 100, 2000, r) < 2000);
});

test("backoffDelay applies full jitter (random()=0 -> 0)", () => {
  assert.equal(backoffDelay(5, 100, 2000, () => 0), 0);
});

test("withRetry returns on first success without sleeping", async () => {
  let calls = 0;
  const v = await withRetry(
    async () => {
      calls++;
      return "ok";
    },
    { sleep: noSleep },
  );
  assert.equal(v, "ok");
  assert.equal(calls, 1);
});

test("withRetry retries then succeeds", async () => {
  let calls = 0;
  const v = await withRetry(
    async () => {
      calls++;
      if (calls < 3) throw new Error("ETIMEDOUT");
      return calls;
    },
    { attempts: 5, sleep: noSleep, random: () => 0 },
  );
  assert.equal(v, 3);
  assert.equal(calls, 3);
});

test("withRetry gives up after attempts and throws last error", async () => {
  let calls = 0;
  await assert.rejects(
    withRetry(
      async () => {
        calls++;
        throw new Error(`fail ${calls}`);
      },
      { attempts: 3, sleep: noSleep },
    ),
    /fail 3/,
  );
  assert.equal(calls, 3);
});

test("withRetry stops immediately on a non-retryable error", async () => {
  let calls = 0;
  await assert.rejects(
    withRetry(
      async () => {
        calls++;
        throw new Error("auth failed");
      },
      { attempts: 5, sleep: noSleep, retryable: () => false },
    ),
    /auth failed/,
  );
  assert.equal(calls, 1);
});

test("isTransientDbError classifies by code and message", () => {
  const withCode = (code: string) =>
    Object.assign(new Error("x"), { code });
  assert.equal(isTransientDbError(withCode("ECONNREFUSED")), true);
  assert.equal(isTransientDbError(withCode("ER_CON_COUNT_ERROR")), true);
  assert.equal(isTransientDbError(new Error("too many clients already")), true);
  assert.equal(isTransientDbError(new Error("server is starting up")), true);
  assert.equal(isTransientDbError(new Error("password authentication failed")), false);
  assert.equal(isTransientDbError(withCode("ER_ACCESS_DENIED_ERROR")), false);
});
