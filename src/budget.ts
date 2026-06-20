// Connection-budget math.
//
// The core insight of this package as a pure function: given the database's
// `max_connections`, how many connections may a single warm instance safely
// pool, accounting for the number of instances the platform may keep warm and a
// reserve for migrations / admin / other clients?
//
// Pure and dependency-free. No env, no I/O — just arithmetic you can unit-test.

export interface BudgetInput {
  /** The database server's `max_connections`. */
  maxConnections: number;
  /** Peak number of warm instances the platform may run concurrently. */
  expectedInstances: number;
  /**
   * Connections to hold back for migrations, admin tools, the DB's own
   * superuser reserve, cron jobs, etc. Defaults to a sensible floor.
   */
  reserved?: number;
  /** Other long-lived clients (a separate worker, a BI tool) using the DB. */
  otherClients?: number;
}

export interface BudgetResult {
  /** Recommended per-instance pool size (>= 1). */
  recommendedPoolLimit: number;
  /** Connections available to serverless instances after reserves. */
  usableConnections: number;
  /** Projected peak usage at the recommended pool size. */
  projectedPeakUsage: number;
  /** True when even a pool of 1 across all instances exceeds the budget. */
  exceedsBudget: boolean;
  /** Human-readable explanation of how the number was derived. */
  rationale: string;
}

/** Postgres reserves superuser slots; default reserve reflects that + admin. */
const DEFAULT_RESERVED = 3;

function asPositiveInt(n: number, name: string): number {
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error(`lambda-pool: ${name} must be a positive number (got ${n}).`);
  }
  return Math.floor(n);
}

/**
 * Recommend a per-instance pool size from a connection budget.
 *
 * Formula: `floor((maxConnections - reserved - otherClients) / expectedInstances)`,
 * clamped to at least 1. When even 1×instances exceeds the usable budget, the
 * result still recommends 1 but flags `exceedsBudget` so the caller can warn
 * that a pooler is needed.
 */
export function recommendPoolLimit(input: BudgetInput): BudgetResult {
  const maxConnections = asPositiveInt(input.maxConnections, "maxConnections");
  const expectedInstances = asPositiveInt(
    input.expectedInstances,
    "expectedInstances",
  );
  const reserved = Math.max(0, Math.floor(input.reserved ?? DEFAULT_RESERVED));
  const otherClients = Math.max(0, Math.floor(input.otherClients ?? 0));

  const usableConnections = Math.max(
    0,
    maxConnections - reserved - otherClients,
  );

  const raw = Math.floor(usableConnections / expectedInstances);
  const recommendedPoolLimit = Math.max(1, raw);
  const projectedPeakUsage = recommendedPoolLimit * expectedInstances;
  const exceedsBudget = projectedPeakUsage > usableConnections;

  const rationale = exceedsBudget
    ? `Even 1 connection × ${expectedInstances} instances (${expectedInstances}) exceeds the ${usableConnections} usable connections ` +
      `(${maxConnections} max − ${reserved} reserved − ${otherClients} other). Use a connection pooler (PgBouncer / RDS Proxy / Neon pooled endpoint).`
    : `${usableConnections} usable connections (${maxConnections} max − ${reserved} reserved − ${otherClients} other) ` +
      `÷ ${expectedInstances} instances → pool of ${recommendedPoolLimit} per instance (peak ${projectedPeakUsage}).`;

  return {
    recommendedPoolLimit,
    usableConnections,
    projectedPeakUsage,
    exceedsBudget,
    rationale,
  };
}
