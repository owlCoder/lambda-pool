// CLI entry — `npx lambda-pool <command>`.
//
// Thin presentation layer over the pure core; it parses argv, reads env, calls
// the library, prints text, and sets an exit code. No business logic lives here.

import { recommendPoolLimit } from "./budget.ts";
import { formatReport } from "./diagnostics.ts";
import { inspectEnv } from "./inspect.ts";
import { listProviders } from "./providers.ts";

const HELP = `lambda-pool — serverless-safe DB pool helper

Usage:
  lambda-pool inspect          Lint the connection in your env for serverless safety
  lambda-pool budget <max> <instances> [reserved] [other]
                               Recommend a per-instance pool size
  lambda-pool providers        List recognized managed providers
  lambda-pool help             Show this help

Env (for "inspect"):
  DATABASE_URL | MYSQL_URL | POSTGRES_URL | PG_URL   connection string (required)
  DATABASE_POOL_LIMIT                                intended pool size (default 1)
  DATABASE_SSL_CA_BASE64                             base64 CA cert
  EXPECTED_INSTANCES                                 peak warm instances (default 20)
`;

interface CliIo {
  argv: string[];
  env: NodeJS.ProcessEnv;
  out: (s: string) => void;
  err: (s: string) => void;
}

/** Run the CLI and return a process exit code. Pure-ish: I/O is injected. */
export function runCli(io: CliIo): number {
  const [cmd, ...rest] = io.argv;

  switch (cmd) {
    case undefined:
    case "help":
    case "-h":
    case "--help":
      io.out(HELP);
      return 0;

    case "inspect": {
      try {
        const report = inspectEnv(io.env);
        io.out(formatReport(report));
        // Non-zero on any warning/error so `inspect` is usable as a CI gate.
        const clean = report.diagnostics.every((d) => d.severity === "info");
        return clean ? 0 : 1;
      } catch (e) {
        io.err((e as Error).message);
        return 2;
      }
    }

    case "budget": {
      const [max, instances, reserved, other] = rest.map(Number);
      if (!Number.isFinite(max) || !Number.isFinite(instances)) {
        io.err("usage: lambda-pool budget <maxConnections> <instances> [reserved] [other]");
        return 2;
      }
      try {
        const r = recommendPoolLimit({
          maxConnections: max!,
          expectedInstances: instances!,
          ...(Number.isFinite(reserved) ? { reserved: reserved! } : {}),
          ...(Number.isFinite(other) ? { otherClients: other! } : {}),
        });
        io.out(`recommended pool limit: ${r.recommendedPoolLimit}`);
        io.out(r.rationale);
        return r.exceedsBudget ? 1 : 0;
      } catch (e) {
        io.err((e as Error).message);
        return 2;
      }
    }

    case "providers": {
      for (const p of listProviders()) {
        io.out(
          `${p.id.padEnd(16)} max~${p.typicalMaxConnections}  pooler:${p.hasPooledEndpoint ? "yes" : "no"}  ${p.label}`,
        );
      }
      return 0;
    }

    default:
      io.err(`unknown command: ${cmd}\n\n${HELP}`);
      return 2;
  }
}
