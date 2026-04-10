import type {
  ClientProfile,
  PortfolioAsset,
  PortfolioSnapshot,
  RiskTolerance,
} from "../models.js";
import { roundNumber } from "../models.js";

const FIRST_NAMES = [
  "James", "John", "Robert", "Michael", "David",
  "William", "Richard", "Joseph", "Thomas", "Daniel",
  "Mary", "Patricia", "Jennifer", "Linda", "Elizabeth",
  "Barbara", "Susan", "Jessica", "Sarah", "Emily",
];

const LAST_NAMES = [
  "Smith", "Johnson", "Williams", "Brown", "Jones",
  "Garcia", "Miller", "Davis", "Rodriguez", "Martinez",
  "Anderson", "Taylor", "Thomas", "Moore", "Jackson",
];

interface StockEntry {
  symbol: string;
  name: string;
  sector: string;
  priceRange: [number, number];
}

const STOCKS: StockEntry[] = [
  { symbol: "AAPL", name: "Apple Inc.", sector: "Technology", priceRange: [170, 230] },
  { symbol: "MSFT", name: "Microsoft Corp.", sector: "Technology", priceRange: [380, 450] },
  { symbol: "GOOGL", name: "Alphabet Inc.", sector: "Technology", priceRange: [140, 185] },
  { symbol: "AMZN", name: "Amazon.com Inc.", sector: "Consumer Discretionary", priceRange: [170, 220] },
  { symbol: "NVDA", name: "NVIDIA Corp.", sector: "Technology", priceRange: [800, 1200] },
  { symbol: "META", name: "Meta Platforms Inc.", sector: "Technology", priceRange: [450, 600] },
  { symbol: "JPM", name: "JPMorgan Chase & Co.", sector: "Financials", priceRange: [180, 230] },
  { symbol: "V", name: "Visa Inc.", sector: "Financials", priceRange: [270, 310] },
  { symbol: "JNJ", name: "Johnson & Johnson", sector: "Healthcare", priceRange: [150, 175] },
  { symbol: "UNH", name: "UnitedHealth Group Inc.", sector: "Healthcare", priceRange: [480, 580] },
  { symbol: "PG", name: "Procter & Gamble Co.", sector: "Consumer Staples", priceRange: [155, 175] },
  { symbol: "XOM", name: "Exxon Mobil Corp.", sector: "Energy", priceRange: [100, 125] },
  { symbol: "HD", name: "The Home Depot Inc.", sector: "Consumer Discretionary", priceRange: [330, 400] },
  { symbol: "DIS", name: "The Walt Disney Co.", sector: "Communication Services", priceRange: [90, 120] },
  { symbol: "KO", name: "The Coca-Cola Co.", sector: "Consumer Staples", priceRange: [58, 68] },
  { symbol: "PFE", name: "Pfizer Inc.", sector: "Healthcare", priceRange: [25, 35] },
  { symbol: "BA", name: "The Boeing Co.", sector: "Industrials", priceRange: [180, 260] },
  { symbol: "TSLA", name: "Tesla Inc.", sector: "Consumer Discretionary", priceRange: [200, 350] },
  { symbol: "NEE", name: "NextEra Energy Inc.", sector: "Utilities", priceRange: [65, 85] },
  { symbol: "LLY", name: "Eli Lilly and Co.", sector: "Healthcare", priceRange: [700, 900] },
];

interface EtfEntry {
  symbol: string;
  name: string;
  priceRange: [number, number];
}

const ETFS: EtfEntry[] = [
  { symbol: "SPY", name: "SPDR S&P 500 ETF Trust", priceRange: [480, 560] },
  { symbol: "QQQ", name: "Invesco QQQ Trust", priceRange: [430, 510] },
  { symbol: "GLD", name: "SPDR Gold Shares", priceRange: [210, 250] },
  { symbol: "IWM", name: "iShares Russell 2000 ETF", priceRange: [190, 230] },
  { symbol: "VTI", name: "Vanguard Total Stock Market ETF", priceRange: [240, 280] },
  { symbol: "XLK", name: "Technology Select Sector SPDR Fund", priceRange: [190, 230] },
];

interface BondEntry {
  symbol: string;
  name: string;
  priceRange: [number, number];
}

const BONDS: BondEntry[] = [
  { symbol: "BND", name: "Vanguard Total Bond Market ETF", priceRange: [70, 80] },
  { symbol: "TLT", name: "iShares 20+ Year Treasury Bond ETF", priceRange: [85, 105] },
  { symbol: "AGG", name: "iShares Core U.S. Aggregate Bond ETF", priceRange: [95, 105] },
  { symbol: "LQD", name: "iShares iBoxx Investment Grade Corp Bond ETF", priceRange: [105, 120] },
  { symbol: "SHY", name: "iShares 1-3 Year Treasury Bond ETF", priceRange: [80, 85] },
];

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFloat(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

function pickRandom<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)]!;
}

function pickRandomSubset<T>(array: T[], min: number, max: number): T[] {
  const count = randomInt(min, Math.min(max, array.length));
  const shuffled = [...array].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

function generateHoldings(): PortfolioAsset[] {
  const assets: PortfolioAsset[] = [];

  const stocks = pickRandomSubset(STOCKS, 2, 6);
  for (const stock of stocks) {
    const price = randomFloat(stock.priceRange[0], stock.priceRange[1]);
    const quantity = randomInt(5, 100);
    assets.push({
      symbol: stock.symbol,
      name: stock.name,
      assetClass: "equity",
      subAssetClass: "single_stock",
      quantity,
      marketValue: roundNumber(quantity * price),
      sector: stock.sector,
      liquidityBucket: "liquid",
      instrumentType: "EQ",
      sourceBucket: "holding",
    });
  }

  const etfs = pickRandomSubset(ETFS, 1, 3);
  for (const etf of etfs) {
    const price = randomFloat(etf.priceRange[0], etf.priceRange[1]);
    const quantity = randomInt(10, 200);
    const isGold = etf.symbol === "GLD";
    assets.push({
      symbol: etf.symbol,
      name: etf.name,
      assetClass: isGold ? "gold" : "equity",
      subAssetClass: isGold ? "gold_exposure" : "index_fund",
      quantity,
      marketValue: roundNumber(quantity * price),
      sector: null,
      liquidityBucket: "liquid",
      instrumentType: "ETF",
      sourceBucket: "holding",
    });
  }

  const bonds = pickRandomSubset(BONDS, 1, 3);
  for (const bond of bonds) {
    const price = randomFloat(bond.priceRange[0], bond.priceRange[1]);
    const quantity = randomInt(5, 50);
    assets.push({
      symbol: bond.symbol,
      name: bond.name,
      assetClass: "debt",
      subAssetClass: "bond_etf",
      quantity,
      marketValue: roundNumber(quantity * price),
      sector: null,
      liquidityBucket: "moderate",
      instrumentType: "ETF",
      sourceBucket: "holding",
    });
  }

  return assets;
}

export function generateClientProfile(): ClientProfile {
  const name = `${pickRandom(FIRST_NAMES)} ${pickRandom(LAST_NAMES)}`;
  const age = randomInt(22, 65);
  const riskTolerance: RiskTolerance = pickRandom(["low", "medium", "high"]);

  const holdings = generateHoldings();
  const cashBalance = roundNumber(randomFloat(10_000, 200_000));
  const totalValue = roundNumber(
    cashBalance + holdings.reduce((sum, asset) => sum + asset.marketValue, 0),
  );

  const portfolio: PortfolioSnapshot = {
    holdings,
    positions: [],
    cashBalance,
    totalValue,
    source: "generated",
    fetchedAt: new Date().toISOString(),
  };

  return { name, age, riskTolerance, portfolio };
}
