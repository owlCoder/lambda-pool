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
- Subpath exports for every module.
- CI matrix (Node 20/22/24) and Docker-based integration tests against real
  MySQL and Postgres.

[Unreleased]: https://github.com/owlCoder/lambda-pool/commits/main
