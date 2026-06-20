# Architecture

`lambda-pool` follows a small, strict **clean-architecture** layout. Source is
grouped by layer under `src/`, and dependencies may only point **inward**.

```
src/
├── core/          innermost — pure, zero-dependency, no I/O
│   ├── result.ts      Result/Either primitive
│   ├── env.ts         env-bag helpers (pool limit, CA decode)
│   ├── url.ts         connection-string parse / redact / SSL detect
│   ├── dsn.ts         build a connection string from parts (inverse of url)
│   ├── redact.ts      structural object redaction for logs
│   ├── config.ts      normalize env → typed PoolConfig
│   ├── providers.ts   managed-provider preset registry + host detection
│   ├── budget.ts      connection-budget math (recommendPoolLimit)
│   └── retry.ts       jittered backoff scheduling
│
├── application/   use-cases that compose core; still no real I/O
│   ├── diagnostics.ts lint a connection config for serverless safety
│   ├── inspect.ts     bridge env → diagnostics
│   ├── recommend.ts   provider detection + budget → recommendation
│   └── preflight.ts   config + diagnostics + injectable probe (startup gate)
│
├── adapters/      the edge that faces concrete drivers
│   ├── mysql.ts       mysql2 pool option builder
│   ├── pg.ts          pg pool option builder
│   └── health.ts      driver-agnostic probe via a Queryable port
│
├── presentation/  process I/O
│   ├── cli.ts         argv → library calls → text (testable, I/O injected)
│   └── bin.ts         executable shim wiring real process I/O
│
└── index.ts       public barrel re-exporting the stable API
```

## The dependency rule

```
presentation ─▶ adapters ─▶ application ─▶ core
```

An arrow means "may import from". The rule is **one-directional**: nothing in an
inner layer may import from an outer layer. Concretely:

- `core/*` imports only other `core/*`.
- `application/*` imports `core/*` (and other `application/*`).
- `adapters/*` imports `core/*` / `application/*`.
- `presentation/*` may import anything inward.

This is not just a convention — it is **enforced in CI** by
`no-restricted-imports` rules in [`eslint.config.mjs`](./eslint.config.mjs). A PR
that makes `core` import an adapter fails `npm run lint`.

## Why these boundaries

- **Zero runtime dependencies.** Drivers (`mysql2`, `pg`) are touched only at the
  `adapters` edge, and even there only structurally (the builders return plain
  option objects; `health` depends on a minimal `Queryable` port, not on a
  driver type). The published package adds nothing to your `node_modules`.
- **Testability.** Everything in `core` and `application` is pure, so the unit
  suite is hermetic — `npm test` needs no database. `presentation` injects its
  I/O (`out`, `err`, `env`) so the CLI is unit-tested without spawning a process.
- **Stable public surface.** Internal files move between layers without breaking
  consumers: the published subpaths (`lambda-pool/mysql`, `lambda-pool/budget`,
  …) are mapped in `package.json#exports` independently of the folder layout.

## Ports

`adapters/health.ts` defines `Queryable` — the narrowest interface needed to run
a probe query. Both a `mysql2` pool and a `pg` pool satisfy it structurally, so
the package depends on the **abstraction**, not on a concrete driver (Dependency
Inversion). New adapters only need to provide something `Queryable`-shaped.

`application/preflight.ts` shows the same principle from the other side: it can
run a *live* reachability check, but instead of importing the health adapter
(which the dependency rule forbids) it accepts the probe as an injected
function. The caller wires `isReachable(pool)` in at the composition root.
