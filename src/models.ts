export const DISCLAIMER_TEXT =
  "This is not financial advice. Please consult a qualified financial advisor before making investment decisions.";

export const DISPLAY_ORDER = [
  "equity",
  "debt",
  "gold",
  "alternatives",
  "cash",
] as const;

export type AssetClass = (typeof DISPLAY_ORDER)[number];
export type AssetBucket = "holding" | "position";
export type LiquidityBucket = "liquid" | "moderate" | "low";
export type RiskTolerance = "low" | "medium" | "high";
export type TimeBucket = "short" | "medium" | "long";
export type LiquidityRequirement = "low" | "medium" | "high";
export type PortfolioSource = "generated";

export interface ClientProfile {
  name: string;
  age: number;
  riskTolerance: RiskTolerance;
  portfolio: PortfolioSnapshot;
}

export interface AnalyzeRequest {
  query: string;
  goal: string | null;
  timeHorizonYears: number | null;
  riskTolerance: RiskTolerance | null;
  liquidityRequirement: LiquidityRequirement | null;
}

export interface PortfolioAsset {
  symbol: string;
  name: string;
  assetClass: AssetClass;
  subAssetClass: string;
  quantity: number;
  marketValue: number;
  sector: string | null;
  liquidityBucket: LiquidityBucket;
  instrumentType: string;
  sourceBucket: AssetBucket;
}

export interface PortfolioSnapshot {
  holdings: PortfolioAsset[];
  positions: PortfolioAsset[];
  cashBalance: number;
  totalValue: number;
  source: PortfolioSource;
  fetchedAt: string;
}

export interface AllocationEntry {
  value: number;
  percentage: number;
}

export interface AdvisorOutput {
  goal: string;
  timeHorizonYears: number;
  timeHorizonBucket: TimeBucket;
  riskTolerance: RiskTolerance;
  liquidityRequirement: LiquidityRequirement;
  targetCorpusAmount: number | null;
  executionPlan: string[];
  inferredGoal: boolean;
  inferredTimeHorizon: boolean;
  inferredRiskTolerance: boolean;
  inferredLiquidityRequirement: boolean;
  inferredTargetCorpus: boolean;
}

export interface AnalystRiskSummary {
  volatilityProxy: "low" | "medium" | "high";
  diversificationStatus: "weak" | "adequate";
  liquidityStatus: "insufficient" | "adequate";
  horizonFit: "misaligned" | "aligned" | "conservative";
  issueCount: string;
}

export interface AnalystOutput {
  currentAllocation: Record<AssetClass, AllocationEntry>;
  identifiedIssues: string[];
  riskSummary: AnalystRiskSummary;
}

export interface SectorRecommendation {
  sector: string;
  action: string;
  vehicle: string;
  rationale: string;
}

export interface DecisionOutput {
  recommendationSummary: string[];
  targetAllocation: Record<AssetClass, number>;
  reasoning: string[];
  tradeoffs: string[];
  marketOutlook: string;
  sectorRecommendations: SectorRecommendation[];
  confidenceScore: number;
  disclaimer: string;
}

export interface AnalysisMetadata {
  deterministicVersion: string;
  marketContextVersion: string;
  portfolioSource: PortfolioSource;
  understandingEngine: "openai" | "rules";
  responseEngine: "openai" | "rules";
}

export interface GoalPath {
  currentCorpusAmount: number;
  targetCorpusAmount: number;
  shortfallTodayAmount: number;
  gapAmount: number;
  assumedAnnualReturnPct: number;
  requiredAnnualReturnPctWithoutContribution: number;
  projectedCorpusWithoutContribution: number;
  estimatedMonthlyContribution: number;
  status: "on_track" | "needs_contributions";
}

export interface SectorExposure {
  sector: string;
  value: number;
  percentage: number;
}

export interface HoldingExposureSummary {
  symbol: string;
  name: string;
  assetClass: AssetClass;
  marketValue: number;
  weightPct: number;
  sector: string | null;
}

export interface AnalysisResponse {
  mode: "analysis";
  context: AdvisorOutput;
  currentAllocation: Record<AssetClass, AllocationEntry>;
  goalPath: GoalPath | null;
  sectorHighlights: SectorExposure[];
  topHoldings: HoldingExposureSummary[];
  identifiedIssues: string[];
  recommendation: string[];
  targetAllocation: Record<AssetClass, number>;
  confidenceScore: number;
  riskSummary: AnalystRiskSummary;
  reasoning: string[];
  tradeoffs: string[];
  marketOutlook: string;
  sectorRecommendations: SectorRecommendation[];
  disclaimer: string;
  metadata: AnalysisMetadata;
  renderedText: string;
}

export interface HoldingsListResponse {
  mode: "holdings_list";
  metadata: AnalysisMetadata;
  renderedText: string;
}

export interface PortfolioAnswerResponse {
  mode: "portfolio_answer";
  metadata: AnalysisMetadata;
  renderedText: string;
}

export type IntelliWealthResponse =
  | AnalysisResponse
  | HoldingsListResponse
  | PortfolioAnswerResponse;

export type JsonRecord = Record<string, unknown>;

const RISK_LEVELS = new Set<RiskTolerance>(["low", "medium", "high"]);
const LIQUIDITY_LEVELS = new Set<LiquidityRequirement>([
  "low",
  "medium",
  "high",
]);

export function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireString(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${fieldName} must be a non-empty string.`);
  }
  return value.trim();
}

function asNullableString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function asNullablePositiveNumber(value: unknown): number | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue) || numberValue <= 0) {
    throw new Error("timeHorizonYears must be a positive number.");
  }
  return numberValue;
}

function asNullableRisk(value: unknown): RiskTolerance | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  if (typeof value !== "string") {
    throw new Error("riskTolerance must be low, medium, or high.");
  }
  const normalized = value.toLowerCase() as RiskTolerance;
  if (!RISK_LEVELS.has(normalized)) {
    throw new Error("riskTolerance must be low, medium, or high.");
  }
  return normalized;
}

function asNullableLiquidity(value: unknown): LiquidityRequirement | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  if (typeof value !== "string") {
    throw new Error("liquidityRequirement must be low, medium, or high.");
  }
  const normalized = value.toLowerCase() as LiquidityRequirement;
  if (!LIQUIDITY_LEVELS.has(normalized)) {
    throw new Error("liquidityRequirement must be low, medium, or high.");
  }
  return normalized;
}

export function normalizeAnalyzeRequest(payload: unknown): AnalyzeRequest {
  const record = isRecord(payload) ? payload : {};

  return {
    query: requireString(record.query, "query"),
    goal: asNullableString(record.goal),
    timeHorizonYears: asNullablePositiveNumber(record.timeHorizonYears),
    riskTolerance: asNullableRisk(record.riskTolerance),
    liquidityRequirement: asNullableLiquidity(record.liquidityRequirement),
  };
}

export function roundNumber(value: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
