// Use-case: end-to-end pool recommendation from a connection URL.
//
// Composes provider detection (core/providers) with the budget math
// (core/budget): given just a URL and an expected instance count, identify the
// provider, use its typical max_connections as the budget, and recommend a
// per-instance pool size — plus whether a pooler is advisable. No I/O.

import { recommendPoolLimit, type BudgetResult } from "../core/budget.ts";
import { detectProvider, isPooledEndpoint, type ProviderId } from "../core/providers.ts";
import { parseConnectionString } from "../core/url.ts";

export interface RecommendInput {
  /** Connection URI. */
  url: string;
  /** Peak warm serverless instances. Default 20. */
  expectedInstances?: number;
  /** Override the provider's assumed max_connections (e.g. you know your plan). */
  maxConnections?: number;
}

export interface Recommendation extends BudgetResult {
  provider: ProviderId;
  /** True when the URL already targets the provider's pooled endpoint. */
  usingPooledEndpoint: boolean;
  /** True when a pooler is recommended (budget exceeded and one is available). */
  poolerAdvised: boolean;
  /** The max_connections value the recommendation was computed against. */
  assumedMaxConnections: number;
}

const DEFAULT_EXPECTED_INSTANCES = 20;

/** Recommend a pool size for the database behind `url`. Pure. */
export function recommendForUrl(input: RecommendInput): Recommendation {
  const { host } = parseConnectionString(input.url);
  const preset = detectProvider(host);
  const usingPooledEndpoint = isPooledEndpoint(host);

  const assumedMaxConnections =
    input.maxConnections ?? preset.typicalMaxConnections;
  const expectedInstances = input.expectedInstances ?? DEFAULT_EXPECTED_INSTANCES;

  const budget = recommendPoolLimit({
    maxConnections: assumedMaxConnections,
    expectedInstances,
  });

  return {
    ...budget,
    provider: preset.id,
    usingPooledEndpoint,
    assumedMaxConnections,
    poolerAdvised:
      budget.exceedsBudget && preset.hasPooledEndpoint && !usingPooledEndpoint,
  };
}
