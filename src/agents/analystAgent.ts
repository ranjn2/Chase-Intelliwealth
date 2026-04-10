import type {
  AdvisorOutput,
  AnalystOutput,
  AssetClass,
  PortfolioSnapshot,
} from "../models.js";
import { DISPLAY_ORDER, roundNumber } from "../models.js";

export class AnalystAgent {
  run(portfolio: PortfolioSnapshot, advisorOutput: AdvisorOutput): AnalystOutput {
    const currentAllocation = this.computeAllocation(portfolio);
    const identifiedIssues = this.identifyIssues(
      portfolio,
      currentAllocation,
      advisorOutput,
    );
    const riskSummary = this.buildRiskSummary(
      portfolio,
      currentAllocation,
      advisorOutput,
      identifiedIssues,
    );

    return {
      currentAllocation,
      identifiedIssues,
      riskSummary,
    };
  }

  private computeAllocation(portfolio: PortfolioSnapshot): AnalystOutput["currentAllocation"] {
    const totals = Object.fromEntries(
      DISPLAY_ORDER.map((assetClass) => [assetClass, 0]),
    ) as Record<AssetClass, number>;

    for (const asset of [...portfolio.holdings, ...portfolio.positions]) {
      totals[asset.assetClass] += asset.marketValue;
    }
    totals.cash += portfolio.cashBalance;

    const allocation = {} as AnalystOutput["currentAllocation"];
    for (const assetClass of DISPLAY_ORDER) {
      const value = roundNumber(totals[assetClass]);
      const percentage = roundNumber((value / portfolio.totalValue) * 100);
      allocation[assetClass] = { value, percentage };
    }
    return allocation;
  }

  private identifyIssues(
    portfolio: PortfolioSnapshot,
    allocation: AnalystOutput["currentAllocation"],
    advisorOutput: AdvisorOutput,
  ): string[] {
    const issues: string[] = [];
    const equityPct = allocation.equity.percentage;
    const cashPct = allocation.cash.percentage;
    const liquidReservePct = this.liquidReservePct(portfolio);
    const maxAssetPct = Math.max(
      ...Object.values(allocation).map((entry) => entry.percentage),
    );
    const [sectorPct, sectorName] = this.largestEquitySectorPct(portfolio);
    const topHoldingPct = this.largestHoldingPct(portfolio);
    const equityCap = {
      low: 50,
      medium: 70,
      high: 80,
    }[advisorOutput.riskTolerance];
    const requiredLiquidity =
      advisorOutput.timeHorizonBucket === "short" ? 10 : 5;

    if (equityPct > equityCap) {
      issues.push(
        `Equity exposure is ${equityPct.toFixed(1)}%, above the ${advisorOutput.riskTolerance}-risk ceiling of ${equityCap.toFixed(0)}%.`,
      );
    }
    if (maxAssetPct > 80) {
      issues.push(
        `One asset class accounts for ${maxAssetPct.toFixed(1)}% of the portfolio, above the 80% concentration limit.`,
      );
    }
    if (sectorName && sectorPct > 35) {
      issues.push(
        `Sector concentration is elevated: ${sectorName} represents ${sectorPct.toFixed(1)}% of the portfolio.`,
      );
    }
    if (liquidReservePct < requiredLiquidity) {
      issues.push(
        `Liquid reserve is ${liquidReservePct.toFixed(1)}%, below the recommended minimum of ${requiredLiquidity.toFixed(0)}%.`,
      );
    }
    if (topHoldingPct > 25) {
      issues.push(
        `The largest single holding is ${topHoldingPct.toFixed(1)}% of the portfolio, which weakens diversification.`,
      );
    }
    if (advisorOutput.timeHorizonBucket === "short" && equityPct > 50) {
      issues.push("Short-term goals should not rely on a heavily equity-led allocation.");
    }
    if (issues.length === 0 && cashPct < 5) {
      issues.push("Cash flexibility is tight even though the portfolio is otherwise balanced.");
    }

    return issues;
  }

  private buildRiskSummary(
    portfolio: PortfolioSnapshot,
    allocation: AnalystOutput["currentAllocation"],
    advisorOutput: AdvisorOutput,
    issues: string[],
  ): AnalystOutput["riskSummary"] {
    const equityPct = allocation.equity.percentage;
    const liquidReservePct = this.liquidReservePct(portfolio);
    const topHoldingPct = this.largestHoldingPct(portfolio);

    const volatilityProxy =
      equityPct >= 75 || topHoldingPct >= 25
        ? "high"
        : equityPct >= 50
          ? "medium"
          : "low";

    const diversificationStatus = topHoldingPct >= 25 ? "weak" : "adequate";
    const liquidityStatus = liquidReservePct < 5 ? "insufficient" : "adequate";

    const horizonFit =
      advisorOutput.timeHorizonBucket === "short" && equityPct > 50
        ? "misaligned"
        : advisorOutput.timeHorizonBucket === "long" && equityPct < 40
          ? "conservative"
          : "aligned";

    return {
      volatilityProxy,
      diversificationStatus,
      liquidityStatus,
      horizonFit,
      issueCount: String(issues.length),
    };
  }

  private liquidReservePct(portfolio: PortfolioSnapshot): number {
    let liquidValue = portfolio.cashBalance;
    for (const asset of [...portfolio.holdings, ...portfolio.positions]) {
      if (asset.liquidityBucket === "liquid" && asset.assetClass === "debt") {
        liquidValue += asset.marketValue;
      }
    }
    return roundNumber((liquidValue / portfolio.totalValue) * 100);
  }

  private largestEquitySectorPct(portfolio: PortfolioSnapshot): [number, string | null] {
    const sectorTotals = new Map<string, number>();
    for (const asset of [...portfolio.holdings, ...portfolio.positions]) {
      if (asset.assetClass !== "equity" || !asset.sector) {
        continue;
      }
      sectorTotals.set(asset.sector, (sectorTotals.get(asset.sector) ?? 0) + asset.marketValue);
    }
    if (sectorTotals.size === 0) {
      return [0, null];
    }

    const [sectorName, sectorValue] = [...sectorTotals.entries()].sort((left, right) => {
      if (right[1] !== left[1]) {
        return right[1] - left[1];
      }
      return left[0].localeCompare(right[0]);
    })[0]!;

    return [roundNumber((sectorValue / portfolio.totalValue) * 100), sectorName];
  }

  private largestHoldingPct(portfolio: PortfolioSnapshot): number {
    const values = [...portfolio.holdings, ...portfolio.positions].map(
      (asset) => asset.marketValue,
    );
    if (values.length === 0) {
      return 0;
    }
    return roundNumber((Math.max(...values) / portfolio.totalValue) * 100);
  }
}
