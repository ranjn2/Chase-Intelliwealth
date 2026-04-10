import type {
  AnalysisResponse,
  HoldingsListResponse,
  PortfolioAnswerResponse,
  PortfolioAsset,
  PortfolioSnapshot,
} from "../models.js";
import { DISPLAY_ORDER } from "../models.js";

export function renderAnalysisText(response: AnalysisResponse): string {
  const lines: string[] = [
    "IntelliWealth Analysis",
    `Goal: ${response.context.goal}`,
    `Horizon: ${response.context.timeHorizonYears.toFixed(1)} years (${response.context.timeHorizonBucket})`,
    `Risk tolerance: ${response.context.riskTolerance}`,
    `Portfolio source: ${response.metadata.portfolioSource}`,
  ];

  if (response.goalPath) {
    lines.push(
      "",
      "Goal Path",
      `- Current corpus: $${response.goalPath.currentCorpusAmount.toLocaleString("en-US", { maximumFractionDigits: 0 })} → Target: $${response.goalPath.targetCorpusAmount.toLocaleString("en-US", { maximumFractionDigits: 0 })}`,
      `- Shortfall: $${response.goalPath.shortfallTodayAmount.toLocaleString("en-US", { maximumFractionDigits: 0 })}`,
      `- Estimated monthly contribution needed: $${response.goalPath.estimatedMonthlyContribution.toLocaleString("en-US", { maximumFractionDigits: 0 })} (at ${response.goalPath.assumedAnnualReturnPct.toFixed(1)}% annual return)`,
      `- Status: ${response.goalPath.status === "on_track" ? "broadly on track" : "needs additional contributions"}`,
    );
  }

  lines.push("", "Identified Issues");
  if (response.identifiedIssues.length > 0) {
    lines.push(...response.identifiedIssues.map((issue) => `- ${issue}`));
  } else {
    lines.push("- No material issues detected.");
  }

  if (response.marketOutlook) {
    lines.push("", "Market Outlook");
    lines.push(response.marketOutlook);
  }

  lines.push("", "Target Allocation");
  for (const assetClass of DISPLAY_ORDER) {
    lines.push(
      `- ${capitalize(assetClass)}: ${(response.targetAllocation[assetClass] ?? 0).toFixed(1)}%`,
    );
  }

  lines.push("", "Recommendations");
  lines.push(...response.recommendation.map((item) => `- ${item}`));

  if (response.sectorRecommendations.length > 0) {
    lines.push("", "Sector-wise Recommendations");
    for (const sr of response.sectorRecommendations) {
      lines.push(
        `- ${sr.sector}: ${sr.action} via ${sr.vehicle} — ${sr.rationale}`,
      );
    }
  }

  lines.push("", "Reasoning");
  lines.push(...response.reasoning.map((item) => `- ${item}`));
  if (response.tradeoffs.length > 0) {
    lines.push(...response.tradeoffs.map((item) => `- ${item}`));
  }

  lines.push(
    "",
    `Confidence: ${response.confidenceScore}/100`,
    "",
    `Disclaimer: ${response.disclaimer}`,
  );

  return lines.join("\n");
}

export function renderHoldingsText(options: {
  portfolio: PortfolioSnapshot;
  metadata: HoldingsListResponse["metadata"];
}): string {
  const stocks = [...options.portfolio.holdings, ...options.portfolio.positions]
    .filter((asset) => asset.assetClass === "equity")
    .sort((left, right) => {
      if (right.marketValue !== left.marketValue) {
        return right.marketValue - left.marketValue;
      }
      return left.symbol.localeCompare(right.symbol);
    });

  const lines: string[] = [
    "IntelliWealth Portfolio Holdings",
    `Portfolio source: ${options.metadata.portfolioSource}`,
    "",
  ];

  if (stocks.length === 0) {
    lines.push(
      "No equity holdings were found in the current portfolio snapshot.",
    );
  } else {
    lines.push("Stocks In Your Portfolio");
    for (const asset of stocks) {
      lines.push(formatHoldingLine(asset, options.portfolio.totalValue));
    }
  }

  lines.push(
    "",
    `Total portfolio value: $${options.portfolio.totalValue.toLocaleString(
      "en-US",
      {
        maximumFractionDigits: 0,
      },
    )}`,
  );

  return lines.join("\n");
}

export function renderPortfolioAnswerText(options: {
  title: string;
  directAnswer: string;
  supportingPoints: string[];
  metadata: PortfolioAnswerResponse["metadata"];
}): string {
  const lines: string[] = [
    options.title,
    `Portfolio source: ${options.metadata.portfolioSource}`,
    "",
    options.directAnswer,
  ];

  if (options.supportingPoints.length > 0) {
    lines.push("", "Details");
    lines.push(...options.supportingPoints.map((item) => `- ${item}`));
  }

  return lines.join("\n");
}

export function chunkText(text: string, limit: number): string[] {
  if (text.length <= limit) {
    return [text];
  }

  const chunks: string[] = [];
  let current: string[] = [];
  let currentLength = 0;

  for (const line of text.split("\n")) {
    const extra = line.length + 1;
    if (current.length > 0 && currentLength + extra > limit) {
      chunks.push(current.join("\n"));
      current = [line];
      currentLength = extra;
    } else {
      current.push(line);
      currentLength += extra;
    }
  }

  if (current.length > 0) {
    chunks.push(current.join("\n"));
  }

  return chunks;
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatHoldingLine(asset: PortfolioAsset, totalValue: number): string {
  const weight = totalValue > 0 ? (asset.marketValue / totalValue) * 100 : 0;
  return `- ${asset.name} (${asset.symbol}): Qty ${asset.quantity.toLocaleString(
    "en-US",
    {
      maximumFractionDigits: 4,
    },
  )}, Value $${asset.marketValue.toLocaleString("en-US", {
    maximumFractionDigits: 0,
  })}, Weight ${weight.toFixed(1)}%`;
}
