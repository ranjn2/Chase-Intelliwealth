import Fastify, { type FastifyInstance } from "fastify";
import path from "node:path";
import { readFile } from "node:fs/promises";

import { normalizeAnalyzeRequest } from "../models.js";
import type { ClientProfile } from "../models.js";
import { getSettings } from "../config.js";
import { PortfolioService } from "../services/portfolioService.js";
import { IntelliWealthPipeline } from "../agents/pipeline.js";
import { OpenAiService } from "../services/openAiService.js";

interface ConversationMessage {
  role: "client" | "advisor" | "system";
  content: string;
  timestamp: string;
}

function formatClientIntro(profile: ClientProfile): string {
  const { portfolio } = profile;
  const holdingLines = portfolio.holdings
    .map(
      (h) =>
        `  - ${h.name} (${h.symbol}): ${h.quantity} shares, $${h.marketValue.toLocaleString("en-US", { maximumFractionDigits: 0 })} [${h.assetClass}]`,
    )
    .join("\n");
  return [
    `Hello, I'm ${profile.name}, age ${profile.age}.`,
    `My risk tolerance is ${profile.riskTolerance}.`,
    `My current portfolio is worth $${portfolio.totalValue.toLocaleString("en-US", { maximumFractionDigits: 0 })} with $${portfolio.cashBalance.toLocaleString("en-US", { maximumFractionDigits: 0 })} in cash.`,
    `Holdings:\n${holdingLines}`,
  ].join("\n");
}

export function buildApp(dependencies?: {
  portfolioService?: PortfolioService;
  openAiService?: OpenAiService | null;
}): FastifyInstance {
  const settings = getSettings();
  const portfolioService =
    dependencies?.portfolioService ?? new PortfolioService(settings);
  const openAiService =
    dependencies?.openAiService ?? new OpenAiService(settings);
  const pipeline = new IntelliWealthPipeline(portfolioService, openAiService);

  const app = Fastify({
    logger: false,
  });

  app.addHook("onRequest", async (request) => {
    console.log(`[${new Date().toISOString()}] ${request.method} ${request.url}`);
  });

  const conversations = new Map<string, ConversationMessage[]>();

  // Serve static web UI
  app.get("/", async (_request, reply) => {
    const htmlPath = path.join(settings.rootDir, "public", "index.html");
    const html = await readFile(htmlPath, "utf-8");
    reply.type("text/html").send(html);
  });

  app.get("/health", async () => ({
    status: "ok",
    service: "chase-intelliwealth",
    runtime: "node-typescript",
  }));

  app.get("/client", async () => {
    const profile = portfolioService.getClientProfile();
    return {
      status: "ok",
      client: {
        name: profile.name,
        age: profile.age,
        riskTolerance: profile.riskTolerance,
        portfolioTotalValue: profile.portfolio.totalValue,
        holdingsCount: profile.portfolio.holdings.length,
      },
    };
  });

  app.post("/client/regenerate", async () => {
    const profile = portfolioService.regenerateClient();
    return {
      status: "ok",
      client: {
        name: profile.name,
        age: profile.age,
        riskTolerance: profile.riskTolerance,
        portfolioTotalValue: profile.portfolio.totalValue,
        holdingsCount: profile.portfolio.holdings.length,
      },
    };
  });

  app.post("/analyze", async (request, reply) => {
    try {
      const normalizedRequest = normalizeAnalyzeRequest(request.body);
      return await pipeline.analyze(normalizedRequest);
    } catch (error) {
      reply.code(400);
      return {
        error: error instanceof Error ? error.message : "Invalid request.",
      };
    }
  });

  app.post("/conversation/start", async () => {
    const profile = portfolioService.regenerateClient();
    const sessionId = crypto.randomUUID();
    const intro = formatClientIntro(profile);
    const messages: ConversationMessage[] = [
      {
        role: "system",
        content: `New session started. Client profile generated.`,
        timestamp: new Date().toISOString(),
      },
      {
        role: "client",
        content: intro,
        timestamp: new Date().toISOString(),
      },
    ];
    conversations.set(sessionId, messages);
    return {
      sessionId,
      client: {
        name: profile.name,
        age: profile.age,
        riskTolerance: profile.riskTolerance,
        portfolio: profile.portfolio,
      },
      messages,
    };
  });

  app.post("/conversation/message", async (request, reply) => {
    const body = request.body as { sessionId?: string; message?: string };
    if (!body.sessionId || !body.message?.trim()) {
      reply.code(400);
      return { error: "sessionId and message are required." };
    }

    const history = conversations.get(body.sessionId);
    if (!history) {
      reply.code(404);
      return { error: "Session not found. Start a new conversation." };
    }

    const clientMsg: ConversationMessage = {
      role: "client",
      content: body.message.trim(),
      timestamp: new Date().toISOString(),
    };
    history.push(clientMsg);

    try {
      const profile = portfolioService.getClientProfile();
      const normalizedRequest = normalizeAnalyzeRequest({
        query: body.message.trim(),
        riskTolerance: profile.riskTolerance,
      });
      const result = await pipeline.analyze(normalizedRequest);

      const advisorMsg: ConversationMessage = {
        role: "advisor",
        content: result.renderedText,
        timestamp: new Date().toISOString(),
      };
      history.push(advisorMsg);

      return {
        messages: [clientMsg, advisorMsg],
        fullResponse: result,
      };
    } catch (error) {
      const errorMsg: ConversationMessage = {
        role: "advisor",
        content: `I'm sorry, I couldn't process that request. ${error instanceof Error ? error.message : "Please try again."}`,
        timestamp: new Date().toISOString(),
      };
      history.push(errorMsg);
      return {
        messages: [clientMsg, errorMsg],
      };
    }
  });

  app.get("/conversation/:sessionId", async (request, reply) => {
    const { sessionId } = request.params as { sessionId: string };
    const history = conversations.get(sessionId);
    if (!history) {
      reply.code(404);
      return { error: "Session not found." };
    }
    return { messages: history };
  });

  app.addHook("onClose", async () => {
    await portfolioService.close();
  });

  return app;
}
