# Contributing

Thanks for considering a contribution to **lambda-pool**.

## Principles

- **Zero runtime dependencies.** The published package must not add a runtime
  dependency. Drivers (`mysql2`, `pg`) are the consumer's dependency and stay in
  `devDependencies` here.
- **Pure core.** `url`, `providers`, `budget`, and `diagnostics` perform no I/O.
  Keep side effects (env reads, process exit, logging) in `inspect`, `bin`, and
  the driver adapters only.
- **Every change ships with a test.** Unit tests are hermetic and must pass with
  `npm test` and no database.

## Development

```bash
npm install
npm run typecheck
npm test            # hermetic — no DB needed
npm run build
```

### Integration tests

```bash
docker compose -f docker-compose.test.yml up -d
RUN_DB_TESTS=1 npm run test:integration
docker compose -f docker-compose.test.yml down -v
```

## Adding a provider preset

Add an entry to `PRESETS` in `src/core/providers.ts` with a `matches(host)` predicate
and the provider's `typicalMaxConnections`, then cover it in
`test/providers.test.ts`. Detection is purely structural on the hostname — no
network calls.

## Commit style

Conventional-commit prefixes (`feat:`, `fix:`, `test:`, `docs:`, `chore:`).
Keep commits small and focused.
