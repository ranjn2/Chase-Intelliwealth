import type {
  AnalysisResponse,
  AnalyzeRequest,
  AssetClass,
  IntelliWealthResponse,
  GoalPath,
  HoldingExposureSummary,
  HoldingsListResponse,
  SectorExposure,
  PortfolioAnswerResponse,
} from "../models.js";
import { AdvisorAgent } from "./advisorAgent.js";
import { AnalystAgent } from "./analystAgent.js";
import { DecisionAgent } from "./decisionAgent.js";
import {
  renderAnalysisText,
  renderHoldingsText,
  renderPortfolioAnswerText,
} from "../presentation/formatter.js";
import type { PortfolioService } from "../services/portfolioService.js";
import type { OpenAiService } from "../services/openAiService.js";
import { roundNumber } from "../models.js";
import {
  getBaseAllocation,
  getMarketOutlook,
} from "../services/marketContext.js";
import {
  isPolicyViolation,
  POLICY_VIOLATION_RESPONSE,
  OFF_TOPIC_RESPONSE,
} from "../services/guardrails.js";

export class IntelliWealthPipeline {
  private readonly advisorAgent: AdvisorAgent;

  private readonly analystAgent = new AnalystAgent();

  private readonly decisionAgent: DecisionAgent;

  private readonly aiEnabled: boolean;

  private readonly openAiService: OpenAiService | null;

  constructor(
    private readonly portfolioService: PortfolioService,
    openAiService: OpenAiService | null,
  ) {
    this.openAiService = openAiService;
    this.aiEnabled = Boolean(openAiService?.isEnabled());
    this.advisorAgent = new AdvisorAgent();
    this.decisionAgent = new DecisionAgent(openAiService);
  }

  async analyze(request: AnalyzeRequest): Promise<IntelliWealthResponse> {
    // --- Deterministic safety gate (runs BEFORE any LLM call) ---
    if (isPolicyViolation(request.query)) {
      return {
        mode: "portfolio_answer",
        metadata: {
          deterministicVersion: "intelliwealth-deterministic-v1",
          marketContextVersion: "us-static-v1",
          portfolioSource: "generated" as const,
          understandingEngine: "rules" as const,
          responseEngine: "rules" as const,
        },
        renderedText: POLICY_VIOLATION_RESPONSE,
      };
    }

    const interpretation = (await this.openAiService?.interpretQuery(
      request,
    )) ?? {
      financeRelevant: true,
      mode: "analysis" as const,
      goal: request.goal,
      timeHorizonYears: request.timeHorizonYears,
      riskTolerance: request.riskTolerance,
      liquidityRequirement: request.liquidityRequirement,
      targetCorpusAmount: null,
    };
    const portfolio = await this.portfolioService.getPortfolio();
    const metadata = {
      deterministicVersion: "intelliwealth-deterministic-v1",
      marketContextVersion: "us-static-v1",
      portfolioSource: portfolio.source,
      understandingEngine: this.aiEnabled ? "openai" : "rules",
      responseEngine: this.aiEnabled ? "openai" : "rules",
    } as const;

    if (!interpretation.financeRelevant) {
      return {
        mode: "portfolio_answer",
        metadata,
        renderedText: OFF_TOPIC_RESPONSE,
      } as PortfolioAnswerResponse;
    }

    if (interpretation.mode === "holdings_list") {
      const response: HoldingsListResponse = {
        mode: "holdings_list",
        metadata,
        renderedText: "",
      };
      response.renderedText = renderHoldingsText({
        portfolio,
        metadata: response.metadata,
      });
      return response;
    }

    const holdingsSummary = [...portfolio.holdings, ...portfolio.positions]
      .map((asset) => ({
        symbol: asset.symbol,
        name: asset.name,
        assetClass: asset.assetClass,
        subAssetClass: asset.subAssetClass,
        instrumentType: asset.instrumentType,
        sector: asset.sector,
        marketValue: asset.marketValue,
        weightPct:
          portfolio.totalValue > 0
            ? Math.round((asset.marketValue / portfolio.totalValue) * 1000) / 10
            : 0,
      }))
      .sort((left, right) => right.marketValue - left.marketValue);
    const topHoldings: HoldingExposureSummary[] = holdingsSummary
      .slice(0, 5)
      .map((asset) => ({
        symbol: asset.symbol,
        name: asset.name,
        assetClass: asset.assetClass,
        marketValue: asset.marketValue,
        weightPct: asset.weightPct,
        sector: asset.sector,
      }));

    if (interpretation.mode === "portfolio_answer") {
      const analystOutput = this.analystAgent.run(
        portfolio,
        this.advisorAgent.run(request, interpretation),
      );
      const currentPercentages = Object.fromEntries(
        Object.entries(analystOutput.currentAllocation).map(
          ([assetClass, entry]) => [assetClass, entry.percentage],
        ),
      ) as Record<AssetClass, number>;
      const aiAnswer = await this.openAiService?.generatePortfolioAnswer({
        query: request.query,
        portfolioSource: portfolio.source,
        totalValue: portfolio.totalValue,
        currentAllocation: currentPercentages,
        holdings: holdingsSummary,
      });

      if (aiAnswer) {
        const response: PortfolioAnswerResponse = {
          mode: "portfolio_answer",
          metadata,
          renderedText: "",
        };
        response.renderedText = renderPortfolioAnswerText({
          title: aiAnswer.title,
          directAnswer: aiAnswer.directAnswer,
          supportingPoints: aiAnswer.supportingPoints,
          metadata,
        });
        return response;
      }

      const response: PortfolioAnswerResponse = {
        mode: "portfolio_answer",
        metadata,
        renderedText: "",
      };
      response.renderedText = renderPortfolioAnswerText({
        title: "IntelliWealth Portfolio Answer",
        directAnswer:
          "I could not answer that portfolio-specific question precisely from the local portfolio fields alone. The current snapshot does not explicitly label market-cap buckets or fund style buckets for every instrument.",
        supportingPoints: [
          `Current equity allocation is ${currentPercentages.equity.toFixed(1)}% of the portfolio.`,
          `Current debt allocation is ${currentPercentages.debt.toFixed(1)}% and cash allocation is ${currentPercentages.cash.toFixed(1)}%.`,
          `Top current holdings by value are ${holdingsSummary
            .slice(0, 5)
            .map((asset) => `${asset.symbol} (${asset.weightPct.toFixed(1)}%)`)
            .join(", ")}.`,
        ],
        metadata,
      });
      return response;
    }

    const context = this.advisorAgent.run(request, interpretation);
    const analystOutput = this.analystAgent.run(portfolio, context);
    const currentPercentages = Object.fromEntries(
      Object.entries(analystOutput.currentAllocation).map(
        ([assetClass, entry]) => [assetClass, entry.percentage],
      ),
    ) as Record<AssetClass, number>;
    const sectorHighlights = this.computeSectorHighlights(holdingsSummary);
    const preliminaryTargetAllocation = getBaseAllocation(
      context.timeHorizonBucket,
      context.riskTolerance,
      context.liquidityRequirement,
    );
    const preliminaryGoalPath = this.computeGoalPath(
      portfolio.totalValue,
      context.targetCorpusAmount,
      context.timeHorizonYears,
      this.estimateAnnualReturnAssumption(
        context.targetCorpusAmount,
        preliminaryTargetAllocation,
      ),
    );
    const decisionOutput = await this.decisionAgent.run(
      context,
      analystOutput.identifiedIssues,
      currentPercentages,
      {
        portfolioSource: portfolio.source,
        query: request.query,
        totalPortfolioValue: portfolio.totalValue,
        goalPath: preliminaryGoalPath,
        sectorHighlights,
        topHoldings,
        marketOutlook: getMarketOutlook(),
      },
    );
    const goalPath = this.computeGoalPath(
      portfolio.totalValue,
      context.targetCorpusAmount,
      context.timeHorizonYears,
      this.estimateAnnualReturnAssumption(
        context.targetCorpusAmount,
        decisionOutput.targetAllocation,
      ),
    );

    const response: AnalysisResponse = {
      mode: "analysis",
      context,
      currentAllocation: analystOutput.currentAllocation,
      goalPath,
      sectorHighlights,
      topHoldings,
      identifiedIssues: analystOutput.identifiedIssues,
      recommendation: decisionOutput.recommendationSummary,
      targetAllocation: decisionOutput.targetAllocation,
      confidenceScore: decisionOutput.confidenceScore,
      riskSummary: analystOutput.riskSummary,
      reasoning: decisionOutput.reasoning,
      tradeoffs: decisionOutput.tradeoffs,
      marketOutlook: decisionOutput.marketOutlook,
      sectorRecommendations: decisionOutput.sectorRecommendations,
      disclaimer: decisionOutput.disclaimer,
      metadata,
      renderedText: "",
    };

    response.renderedText = renderAnalysisText(response);
    return response;
  }

  private estimateAnnualReturnAssumption(
    targetCorpusAmount: number | null,
    targetAllocation: Record<AssetClass, number>,
  ): number {
    if (targetCorpusAmount === null) {
      return 0;
    }

    const annualReturnByAssetClass: Record<AssetClass, number> = {
      equity: 0.12,
      debt: 0.07,
      gold: 0.06,
      alternatives: 0.08,
      cash: 0.04,
    };

    const assumedReturn = (
      Object.entries(targetAllocation) as Array<[AssetClass, number]>
    ).reduce(
      (sum, [assetClass, pct]) =>
        sum + (pct / 100) * annualReturnByAssetClass[assetClass],
      0,
    );

    return roundNumber(assumedReturn * 100, 1);
  }

  private computeGoalPath(
    currentCorpusAmount: number,
    targetCorpusAmount: number | null,
    timeHorizonYears: number,
    assumedAnnualReturnPct: number,
  ): GoalPath | null {
    if (
      targetCorpusAmount === null ||
      targetCorpusAmount <= currentCorpusAmount
    ) {
      return null;
    }

    const annualReturn = assumedAnnualReturnPct / 100;
    const shortfallTodayAmount = roundNumber(
      Math.max(targetCorpusAmount - currentCorpusAmount, 0),
    );
    const projectedCorpusWithoutContribution = roundNumber(
      currentCorpusAmount * (1 + annualReturn) ** timeHorizonYears,
    );
    const gapAmount = roundNumber(
      Math.max(targetCorpusAmount - projectedCorpusWithoutContribution, 0),
    );
    const requiredAnnualReturnPctWithoutContribution = roundNumber(
      ((targetCorpusAmount / currentCorpusAmount) ** (1 / timeHorizonYears) -
        1) *
        100,
      1,
    );
    const months = Math.max(Math.round(timeHorizonYears * 12), 1);
    const monthlyRate = annualReturn / 12;
    const estimatedMonthlyContribution =
      monthlyRate > 0
        ? roundNumber(
            gapAmount / (((1 + monthlyRate) ** months - 1) / monthlyRate),
          )
        : roundNumber(gapAmount / months);

    return {
      currentCorpusAmount: roundNumber(currentCorpusAmount),
      targetCorpusAmount: roundNumber(targetCorpusAmount),
      shortfallTodayAmount,
      gapAmount,
      assumedAnnualReturnPct,
      requiredAnnualReturnPctWithoutContribution,
      projectedCorpusWithoutContribution,
      estimatedMonthlyContribution,
      status: gapAmount <= 0 ? "on_track" : "needs_contributions",
    };
  }

  private computeSectorHighlights(
    holdingsSummary: Array<{
      assetClass: AssetClass;
      sector: string | null;
      marketValue: number;
    }>,
  ): SectorExposure[] {
    const excludedSectors = new Set(["Diversified", "Debt", "Gold"]);
    const sectorEligibleHoldings = holdingsSummary.filter(
      (item) =>
        item.assetClass === "equity" &&
        item.sector &&
        !excludedSectors.has(item.sector),
    );
    const total = sectorEligibleHoldings.reduce(
      (sum, item) => sum + item.marketValue,
      0,
    );
    if (total <= 0) {
      return [];
    }

    const sectorTotals = new Map<string, number>();
    for (const holding of sectorEligibleHoldings) {
      const sector = holding.sector!;
      sectorTotals.set(
        sector,
        (sectorTotals.get(sector) ?? 0) + holding.marketValue,
      );
    }

    return [...sectorTotals.entries()]
      .map(([sector, value]) => ({
        sector,
        value: roundNumber(value),
        percentage: roundNumber((value / total) * 100),
      }))
      .sort((left, right) => right.value - left.value)
      .slice(0, 5);
  }
}
