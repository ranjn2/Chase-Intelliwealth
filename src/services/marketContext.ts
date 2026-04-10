import type {
  AssetClass,
  RiskTolerance,
  TimeBucket,
  LiquidityRequirement,
} from "../models.js";

export const PREFERRED_VEHICLES = {
  equity: "low-cost index funds such as S&P 500 or total stock market ETFs",
  debt: "investment-grade bond ETFs, Treasury bond funds, or short-duration bond funds",
  gold: "gold ETFs such as GLD or IAU",
  cash: "money market funds or high-yield savings accounts",
} as const;

export const TAX_AWARENESS_NOTES = [
  "Prefer gradual rebalancing and fresh contributions before frequent selling to reduce taxable churn.",
  "Use diversified core holdings instead of speculative rotations unless the risk profile is explicitly high.",
] as const;

export const RETURN_GUARDRAIL =
  "Target allocations are built without assuming unrealistic annual returns above the 15% to 18% range for long-term equity outcomes.";

/* ------------------------------------------------------------------ */
/*  Allocation presets & constraint guardrails                        */
/* ------------------------------------------------------------------ */

/** Base allocation presets keyed by [timeHorizonBucket][riskTolerance]. */
const ALLOCATION_PRESETS: Record<
  TimeBucket,
  Record<RiskTolerance, Record<AssetClass, number>>
> = {
  short: {
    low: { equity: 30, debt: 50, gold: 5, alternatives: 0, cash: 15 },
    medium: { equity: 40, debt: 40, gold: 5, alternatives: 0, cash: 15 },
    high: { equity: 50, debt: 30, gold: 5, alternatives: 0, cash: 15 },
  },
  medium: {
    low: { equity: 40, debt: 45, gold: 5, alternatives: 0, cash: 10 },
    medium: { equity: 60, debt: 25, gold: 5, alternatives: 0, cash: 10 },
    high: { equity: 70, debt: 15, gold: 5, alternatives: 0, cash: 10 },
  },
  long: {
    low: { equity: 50, debt: 40, gold: 5, alternatives: 0, cash: 5 },
    medium: { equity: 70, debt: 20, gold: 5, alternatives: 0, cash: 5 },
    high: { equity: 80, debt: 10, gold: 5, alternatives: 0, cash: 5 },
  },
};

/** Hard caps on equity exposure per risk tolerance. */
export const EQUITY_CAPS: Record<RiskTolerance, number> = {
  low: 50,
  medium: 70,
  high: 90,
};

/** Minimum cash/liquid allocation depending on liquidity requirement. */
export const MIN_CASH: Record<LiquidityRequirement, number> = {
  low: 5,
  medium: 5,
  high: 10,
};

/** No single asset class can exceed this percentage. */
export const MAX_SINGLE_ASSET_CLASS_PCT = 80;

/**
 * Look up the deterministic fallback allocation for a given
 * horizon / risk / liquidity combination.
 */
export function getBaseAllocation(
  timeHorizonBucket: TimeBucket,
  riskTolerance: RiskTolerance,
  liquidityRequirement: LiquidityRequirement,
): Record<AssetClass, number> {
  const base = { ...ALLOCATION_PRESETS[timeHorizonBucket][riskTolerance] };
  const minCash = MIN_CASH[liquidityRequirement];
  if (base.cash < minCash) {
    const adjustment = minCash - base.cash;
    base.cash = minCash;
    base.debt = Math.max(base.debt - adjustment, 0);
  }
  return base;
}

/**
 * Validate and clamp an AI-proposed allocation so it respects the
 * hard constraints. Returns the clamped allocation (always sums to 100).
 */
export function clampAllocation(
  proposed: Record<AssetClass, number>,
  riskTolerance: RiskTolerance,
  liquidityRequirement: LiquidityRequirement,
): Record<AssetClass, number> {
  const clamped = { ...proposed };

  // Enforce equity cap
  const equityCap = EQUITY_CAPS[riskTolerance];
  if (clamped.equity > equityCap) {
    const excess = clamped.equity - equityCap;
    clamped.equity = equityCap;
    clamped.debt += excess;
  }

  // Enforce single-asset concentration limit
  for (const key of Object.keys(clamped) as AssetClass[]) {
    if (clamped[key] > MAX_SINGLE_ASSET_CLASS_PCT) {
      const excess = clamped[key] - MAX_SINGLE_ASSET_CLASS_PCT;
      clamped[key] = MAX_SINGLE_ASSET_CLASS_PCT;
      clamped.debt += excess;
    }
  }

  // Enforce minimum cash
  const minCash = MIN_CASH[liquidityRequirement];
  if (clamped.cash < minCash) {
    const deficit = minCash - clamped.cash;
    clamped.cash = minCash;
    // Pull from whichever non-cash class is largest
    const largest = (Object.keys(clamped) as AssetClass[])
      .filter((k) => k !== "cash")
      .sort((a, b) => clamped[b] - clamped[a])[0]!;
    clamped[largest] = Math.max(clamped[largest] - deficit, 0);
  }

  // Re-normalise to 100
  const total = Object.values(clamped).reduce((s, v) => s + v, 0);
  if (total > 0 && Math.abs(total - 100) > 0.5) {
    const factor = 100 / total;
    for (const key of Object.keys(clamped) as AssetClass[]) {
      clamped[key] = Math.round(clamped[key] * factor * 10) / 10;
    }
  }

  return clamped;
}

/* ------------------------------------------------------------------ */
/*  Market outlook                                                     */
/* ------------------------------------------------------------------ */

export interface MarketOutlook {
  asOf: string;
  spTrailingPE: number;
  spPEBand: "cheap" | "fair" | "expensive";
  fedFundsRate: number;
  rateDirection: "easing" | "neutral" | "tightening";
  tenYearTreasury: number;
  goldTrendUSD: "rising" | "flat" | "falling";
  headline: string;
  equityNote: string;
  debtNote: string;
  goldNote: string;
}

/**
 * Returns a static market snapshot. In production this would be fetched
 * from a live data source; for now we maintain a manually-updated
 * snapshot that reflects the broad US market environment.
 */
export function getMarketOutlook(): MarketOutlook {
  return {
    asOf: "2026-04-01",
    spTrailingPE: 21.5,
    spPEBand: "fair",
    fedFundsRate: 4.5,
    rateDirection: "easing",
    tenYearTreasury: 4.2,
    goldTrendUSD: "rising",
    headline:
      "S&P 500 trades near fair value (PE ~21.5). The Fed has signalled a gradual easing cycle. Gold remains elevated on global uncertainty.",
    equityNote:
      "Broad-market valuations are reasonable; prefer diversified index exposure over concentrated bets.",
    debtNote:
      "With rates easing, existing bond funds may see price appreciation. Consider locking in yields via intermediate-term Treasury or investment-grade bond funds.",
    goldNote:
      "Gold has rallied on geopolitical tailwinds; maintain allocation as a hedge but avoid chasing momentum.",
  };
}
