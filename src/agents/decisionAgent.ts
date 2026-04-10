import type {
  AdvisorOutput,
  AssetClass,
  DecisionOutput,
  GoalPath,
  HoldingExposureSummary,
  PortfolioSource,
  SectorExposure,
} from "../models.js";
import { DISCLAIMER_TEXT, DISPLAY_ORDER } from "../models.js";
import {
  PREFERRED_VEHICLES,
  getBaseAllocation,
  clampAllocation,
  type MarketOutlook,
} from "../services/marketContext.js";
import type { OpenAiService } from "../services/openAiService.js";

export class DecisionAgent {
  constructor(private readonly openAiService: OpenAiService | null) {}

  async run(
    advisorOutput: AdvisorOutput,
    analystIssues: string[],
    currentAllocation: Record<AssetClass, number>,
    options: {
      portfolioSource: PortfolioSource;
      query: string;
      totalPortfolioValue: number;
      goalPath: GoalPath | null;
      sectorHighlights: SectorExposure[];
      topHoldings: HoldingExposureSummary[];
      marketOutlook: MarketOutlook;
    },
  ): Promise<DecisionOutput> {
    const fallbackAllocation = getBaseAllocation(
      advisorOutput.timeHorizonBucket,
      advisorOutput.riskTolerance,
      advisorOutput.liquidityRequirement,
    );
    const confidenceScore = this.buildConfidenceScore({
      advisorOutput,
      analystIssues,
    });

    const aiNarrative = await this.openAiService?.generateDecisionNarrative({
      query: options.query,
      context: advisorOutput,
      identifiedIssues: analystIssues,
      currentAllocation,
      fallbackTargetAllocation: fallbackAllocation,
      totalPortfolioValue: options.totalPortfolioValue,
      confidenceScore,
      portfolioSource: options.portfolioSource,
      goalPath: options.goalPath,
      sectorHighlights: options.sectorHighlights,
      topHoldings: options.topHoldings,
      marketOutlook: options.marketOutlook,
    });

    const targetAllocation = aiNarrative?.targetAllocation
      ? clampAllocation(
          aiNarrative.targetAllocation,
          advisorOutput.riskTolerance,
          advisorOutput.liquidityRequirement,
        )
      : fallbackAllocation;

    const recommendationSummary =
      aiNarrative?.recommendationSummary ??
      this.buildFallbackRecommendations(
        currentAllocation,
        targetAllocation,
        advisorOutput,
        options.totalPortfolioValue,
        options.goalPath,
      );
    const reasoning =
      aiNarrative?.reasoning ??
      this.buildFallbackReasoning(advisorOutput, options.goalPath);
    const tradeoffs =
      aiNarrative?.tradeoffs ??
      this.buildFallbackTradeoffs(
        advisorOutput,
        currentAllocation,
        targetAllocation,
      );
    const marketOutlook =
      aiNarrative?.marketOutlook ??
      this.buildFallbackMarketOutlook(options.marketOutlook);
    const sectorRecommendations =
      aiNarrative?.sectorRecommendations ??
      this.buildFallbackSectorRecommendations(advisorOutput);

    return {
      recommendationSummary,
      targetAllocation,
      reasoning,
      tradeoffs,
      marketOutlook,
      sectorRecommendations,
      confidenceScore,
      disclaimer: DISCLAIMER_TEXT,
    };
  }

  /* ------------------------------------------------------------------ */
  /*  Fallback generators — used only when the AI path is unavailable   */
  /* ------------------------------------------------------------------ */

  private buildFallbackRecommendations(
    currentAllocation: Record<AssetClass, number>,
    targetAllocation: Record<AssetClass, number>,
    advisorOutput: AdvisorOutput,
    totalPortfolioValue: number,
    goalPath: GoalPath | null,
  ): string[] {
    const recommendations: string[] = [];
    const usd = (v: number) =>
      v.toLocaleString("en-US", { maximumFractionDigits: 0 });

    // Generate a recommendation for each asset class that needs material change
    for (const assetClass of DISPLAY_ORDER) {
      const current = currentAllocation[assetClass] ?? 0;
      const target = targetAllocation[assetClass];
      const diff = target - current;
      if (Math.abs(diff) < 2) continue;

      const amount = Math.abs((totalPortfolioValue * diff) / 100);
      const vehicle =
        PREFERRED_VEHICLES[
          assetClass as keyof typeof PREFERRED_VEHICLES
        ] ?? assetClass;
      const direction = diff > 0 ? "Increase" : "Reduce";
      recommendations.push(
        `${direction} ${assetClass} from ${current.toFixed(1)}% toward ${target.toFixed(1)}% (~$${usd(amount)}) via ${vehicle}.`,
      );
    }

    if (goalPath) {
      recommendations.push(
        goalPath.status === "on_track"
          ? `Current corpus $${usd(goalPath.currentCorpusAmount)} is on track for $${usd(goalPath.targetCorpusAmount)} in ${advisorOutput.timeHorizonYears.toFixed(1)} years — focus on protecting capital.`
          : `To reach $${usd(goalPath.targetCorpusAmount)} in ${advisorOutput.timeHorizonYears.toFixed(1)} years, contribute ~$${usd(goalPath.estimatedMonthlyContribution)}/month at ${goalPath.assumedAnnualReturnPct.toFixed(1)}% assumed return.`,
      );
    }

    if (recommendations.length === 0) {
      recommendations.push(
        "Portfolio is broadly aligned with the target allocation.",
      );
    }

    return recommendations;
  }

  private buildFallbackReasoning(
    advisorOutput: AdvisorOutput,
    goalPath: GoalPath | null,
  ): string[] {
    const reasoning = [
      `Allocation anchored to ${advisorOutput.riskTolerance}-risk, ${advisorOutput.timeHorizonBucket}-term horizon.`,
      `Equity via ${PREFERRED_VEHICLES.equity}; stability via ${PREFERRED_VEHICLES.debt}.`,
      "Gradual rebalancing preferred over frequent selling to reduce tax churn.",
    ];
    if (goalPath && goalPath.status === "needs_contributions") {
      reasoning.push(
        `Without contributions the corpus would reach ~$${goalPath.projectedCorpusWithoutContribution.toLocaleString("en-US", { maximumFractionDigits: 0 })} vs target $${goalPath.targetCorpusAmount.toLocaleString("en-US", { maximumFractionDigits: 0 })}.`,
      );
    }
    return reasoning;
  }

  private buildFallbackTradeoffs(
    advisorOutput: AdvisorOutput,
    currentAllocation: Record<AssetClass, number>,
    targetAllocation: Record<AssetClass, number>,
  ): string[] {
    const tradeoffs = [
      "More debt/cash reduces drawdown risk but caps upside in equity rallies.",
      "Holding liquidity helps goals and rebalancing but modestly drags long-term returns.",
    ];
    if ((currentAllocation.equity ?? 0) > targetAllocation.equity) {
      tradeoffs.push(
        "Cutting equity too fast can trigger avoidable tax; prefer gradual rebalancing.",
      );
    }
    return tradeoffs;
  }

  private buildFallbackMarketOutlook(outlook: MarketOutlook): string {
    return `${outlook.headline} ${outlook.equityNote} ${outlook.debtNote} ${outlook.goldNote}`;
  }

  private buildFallbackSectorRecommendations(
    advisorOutput: AdvisorOutput,
  ): Array<{
    sector: string;
    action: string;
    vehicle: string;
    rationale: string;
  }> {
    const recs: Array<{
      sector: string;
      action: string;
      vehicle: string;
      rationale: string;
    }> = [];
    if (advisorOutput.riskTolerance !== "low") {
      recs.push({
        sector: "Broad Equity",
        action: "Start or increase regular contributions",
        vehicle: "S&P 500 index fund or total stock market ETF",
        rationale:
          "Low-cost diversified equity exposure for long-term wealth creation.",
      });
      recs.push({
        sector: "Technology",
        action: "Add exposure",
        vehicle: "Nasdaq-100 ETF (QQQ) or Technology Select Sector SPDR (XLK)",
        rationale:
          "Technology sector offers growth potential driven by AI and digital spending.",
      });
    }
    recs.push({
      sector: "Bonds",
      action: "Add exposure",
      vehicle: "Intermediate-term Treasury bond fund or investment-grade corporate bond ETF",
      rationale:
        "Provides portfolio stability and benefits from the current easing rate cycle.",
    });
    recs.push({
      sector: "Gold",
      action: "Maintain or add",
      vehicle: "SPDR Gold Shares (GLD) or iShares Gold Trust (IAU)",
      rationale:
        "Hedge against inflation and global uncertainty with low-cost gold ETFs.",
    });
    return recs;
  }

  private buildConfidenceScore(options: {
    advisorOutput: AdvisorOutput;
    analystIssues: string[];
  }): number {
    let score = 92;
    if (options.advisorOutput.inferredRiskTolerance) score -= 5;
    if (options.advisorOutput.inferredTimeHorizon) score -= 3;
    if (options.advisorOutput.inferredGoal) score -= 2;
    score -= Math.min(options.analystIssues.length * 4, 20);
    return Math.max(55, Math.min(score, 95));
  }
}
