import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

export interface Settings {
  rootDir: string;
  apiHost: string;
  apiPort: number;
  backendUrl: string;
  requestTimeoutMs: number;
  enableOpenAi: boolean;
  openAiApiKey: string;
  openAiBaseUrl: string;
  openAiModel: string;
  openAiCacheTtlSeconds: number;
  portfolioCacheTtlSeconds: number;
}

let cachedSettings: Settings | undefined;

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) {
    return fallback;
  }
  return value === "true";
}

function parseInteger(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function getSettings(): Settings {
  if (cachedSettings) {
    return cachedSettings;
  }

  cachedSettings = Object.freeze({
    rootDir,
    apiHost: process.env.INTELLIWEALTH_API_HOST ?? "0.0.0.0",
    apiPort: parseInteger(process.env.INTELLIWEALTH_API_PORT, 8000),
    backendUrl: process.env.INTELLIWEALTH_BACKEND_URL ?? "http://127.0.0.1:8000",
    requestTimeoutMs: parseInteger(
      process.env.INTELLIWEALTH_REQUEST_TIMEOUT_MS,
      20_000,
    ),
    enableOpenAi: true,
    openAiApiKey: process.env.INTELLIWEALTH_OPENAI_API_KEY ?? "",
    openAiBaseUrl: process.env.INTELLIWEALTH_OPENAI_BASE_URL ?? "https://api.groq.com/openai/v1",
    openAiModel: process.env.INTELLIWEALTH_OPENAI_MODEL ?? "openai/gpt-oss-120b",
    openAiCacheTtlSeconds: parseInteger(
      process.env.INTELLIWEALTH_OPENAI_CACHE_TTL_SECONDS,
      3600,
    ),
    portfolioCacheTtlSeconds: parseInteger(
      process.env.INTELLIWEALTH_PORTFOLIO_CACHE_TTL_SECONDS,
      300,
    ),
  });

  return cachedSettings;
}
