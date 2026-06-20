# Changelog

All notable changes to this project are documented here.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added
- MySQL (`mysql2`) and Postgres (`pg`) serverless-safe pool option builders.
- Connection-string parsing, password redaction, and SSL-request detection.
- Provider presets with host-based auto-detection (Aiven, Neon, Supabase,
  PlanetScale, RDS/Aurora, Railway, Render, Vercel Postgres).
- Connection-budget calculator (`recommendPoolLimit`).
- Diagnostics that lint a connection config for serverless safety, plus
  `inspectEnv` to run them straight from environment variables.
- CLI: `lambda-pool inspect | budget | providers`.
- Driver-agnostic health checks (`checkHealth`, `isReachable`) via a minimal
  `Queryable` port.
- Jittered exponential backoff (`withRetry`, `backoffDelay`, `isTransientDbError`).
- `Result` type with `ok`/`err`/`attempt`/`unwrap` and non-throwing
  `safeParseConnectionString`.
- `preflight` startup gate (config + diagnostics + an optional injected
  reachability probe) and a `doctor` CLI command.
- `redact` for structural masking of secret-looking object keys in logs.
- `buildDsn` to assemble a connection string from typed parts.
- `loadPoolConfig` to normalize environment variables into a typed config.
- `recommendForUrl` use-case and a `recommend` CLI command that suggest a pool
  size directly from a connection URL.
- Clean-architecture layout (`core`/`application`/`adapters`/`presentation`)
  with the dependency rule enforced by ESLint, documented in ARCHITECTURE.md.
- ESLint flat config and `lint` script.
- Subpath exports for every module.
- CI matrix (Node 20/22/24) and Docker-based integration tests against real
  MySQL and Postgres.

[Unreleased]: https://github.com/owlCoder/lambda-pool/commits/main
