import type {
  PortfolioSnapshot,
} from "../models.js";
import type { Settings } from "../config.js";
import { TTLCache } from "./cache.js";
import { generateClientProfile } from "./clientGenerator.js";
import type { ClientProfile } from "../models.js";

export class PortfolioService {
  private readonly cache: TTLCache<PortfolioSnapshot>;

  private currentClient: ClientProfile | null = null;

  constructor(private readonly settings: Settings) {
    this.cache = new TTLCache<PortfolioSnapshot>(settings.portfolioCacheTtlSeconds);
  }

  async close(): Promise<void> {}

  getClientProfile(): ClientProfile {
    if (!this.currentClient) {
      this.currentClient = generateClientProfile();
      this.cache.set("portfolio:live", this.currentClient.portfolio);
    }
    return this.currentClient;
  }

  regenerateClient(): ClientProfile {
    this.cache.clear();
    this.currentClient = generateClientProfile();
    this.cache.set("portfolio:live", this.currentClient.portfolio);
    return this.currentClient;
  }

  async getPortfolio(): Promise<PortfolioSnapshot> {
    const cacheKey = "portfolio:live";
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const client = this.getClientProfile();
    this.cache.set(cacheKey, client.portfolio);
    return client.portfolio;
  }
}
