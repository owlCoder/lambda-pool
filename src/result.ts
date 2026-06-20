// A tiny Result/Either type for non-throwing APIs.
//
// Some callers (CLIs, request handlers, validators) prefer to branch on a value
// rather than wrap everything in try/catch. This is the dependency-free
// primitive the `safe*` helpers return. Single responsibility: model success or
// failure, nothing else.

export type Result<T, E = Error> =
  | { ok: true; value: T }
  | { ok: false; error: E };

export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

export function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}

/** Run a throwing function and capture the outcome as a Result. */
export function attempt<T>(fn: () => T): Result<T, Error> {
  try {
    return ok(fn());
  } catch (e) {
    return err(e instanceof Error ? e : new Error(String(e)));
  }
}

/** Unwrap a Result, throwing the error if it failed. */
export function unwrap<T, E>(r: Result<T, E>): T {
  if (r.ok) return r.value;
  throw r.error instanceof Error ? r.error : new Error(String(r.error));
}

/** Unwrap a Result or return a fallback value. */
export function unwrapOr<T, E>(r: Result<T, E>, fallback: T): T {
  return r.ok ? r.value : fallback;
}
