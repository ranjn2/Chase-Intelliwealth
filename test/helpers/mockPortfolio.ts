import type { ClientProfile, PortfolioSnapshot } from "../../src/models.js";

export const mockPortfolioSnapshot: PortfolioSnapshot = {
  holdings: [
    {
      symbol: "SPY",
      name: "SPDR S&P 500 ETF Trust",
      assetClass: "equity",
      subAssetClass: "index_fund",
      quantity: 25,
      marketValue: 13138,
      sector: null,
      liquidityBucket: "liquid",
      instrumentType: "ETF",
      sourceBucket: "holding",
    },
    {
      symbol: "AAPL",
      name: "Apple Inc.",
      assetClass: "equity",
      subAssetClass: "single_stock",
      quantity: 60,
      marketValue: 12769,
      sector: "Technology",
      liquidityBucket: "liquid",
      instrumentType: "EQ",
      sourceBucket: "holding",
    },
    {
      symbol: "JPM",
      name: "JPMorgan Chase & Co.",
      assetClass: "equity",
      subAssetClass: "single_stock",
      quantity: 40,
      marketValue: 8432,
      sector: "Financials",
      liquidityBucket: "liquid",
      instrumentType: "EQ",
      sourceBucket: "holding",
    },
    {
      symbol: "GLD",
      name: "SPDR Gold Shares",
      assetClass: "gold",
      subAssetClass: "gold_exposure",
      quantity: 15,
      marketValue: 3247,
      sector: null,
      liquidityBucket: "liquid",
      instrumentType: "ETF",
      sourceBucket: "holding",
    },
    {
      symbol: "BND",
      name: "Vanguard Total Bond Market ETF",
      assetClass: "debt",
      subAssetClass: "bond_etf",
      quantity: 150,
      marketValue: 11500,
      sector: null,
      liquidityBucket: "moderate",
      instrumentType: "ETF",
      sourceBucket: "holding",
    },
  ],
  positions: [
    {
      symbol: "TSLA",
      name: "Tesla Inc.",
      assetClass: "equity",
      subAssetClass: "single_stock",
      quantity: 20,
      marketValue: 5876,
      sector: "Consumer Discretionary",
      liquidityBucket: "liquid",
      instrumentType: "EQ",
      sourceBucket: "position",
    },
  ],
  cashBalance: 25000,
  totalValue: 79962,
  source: "generated",
  fetchedAt: "2026-04-04T00:00:00.000Z",
};

export const mockClientProfile: ClientProfile = {
  name: "James Smith",
  age: 30,
  riskTolerance: "medium",
  portfolio: mockPortfolioSnapshot,
};

export class MockPortfolioService {
  async getPortfolio(): Promise<PortfolioSnapshot> {
    return structuredClone(mockPortfolioSnapshot);
  }

  getClientProfile(): ClientProfile {
    return structuredClone(mockClientProfile);
  }

  regenerateClient(): ClientProfile {
    return structuredClone(mockClientProfile);
  }

  async close(): Promise<void> {}
}
