import assert from "node:assert/strict";
import test from "node:test";

import { buildApp } from "../src/api/app.js";
import { OpenAiService } from "../src/services/openAiService.js";
import { getSettings } from "../src/config.js";
import type { PortfolioService } from "../src/services/portfolioService.js";
import { MockPortfolioService } from "./helpers/mockPortfolio.js";

function buildTestApp() {
  const settings = getSettings();
  return buildApp({
    portfolioService: new MockPortfolioService() as unknown as PortfolioService,
    openAiService: new OpenAiService(settings),
  });
}

test("health endpoint returns ok", async () => {
  const app = buildTestApp();
  const response = await app.inject({
    method: "GET",
    url: "/health",
  });
  const body = response.json() as { status: string };

  assert.equal(response.statusCode, 200);
  assert.equal(body.status, "ok");
  await app.close();
});

test("analyze endpoint returns structured response", async () => {
  const app = buildTestApp();
  const response = await app.inject({
    method: "POST",
    url: "/analyze",
    payload: {
      query: "Analyze my portfolio for a 5-year goal",
    },
  });

  const body = response.json() as {
    mode?: unknown;
    currentAllocation?: unknown;
    identifiedIssues?: unknown;
    recommendation?: unknown;
    targetAllocation?: unknown;
    confidenceScore?: unknown;
    renderedText?: unknown;
  };
  assert.equal(response.statusCode, 200);
  assert.equal(body.mode, "analysis");
  assert.ok(body.currentAllocation);
  assert.ok(Array.isArray(body.identifiedIssues));
  assert.ok(Array.isArray(body.recommendation));
  assert.ok(body.targetAllocation);
  assert.equal(typeof body.confidenceScore, "number");
  assert.equal(typeof body.renderedText, "string");
  await app.close();
});

test("holdings query returns holdings response", async () => {
  const app = buildTestApp();
  const response = await app.inject({
    method: "POST",
    url: "/analyze",
    payload: {
      query: "What stocks are there in my portfolio?",
    },
  });

  const body = response.json() as {
    mode?: unknown;
    renderedText?: unknown;
  };

  assert.equal(response.statusCode, 200);
  assert.equal(body.mode, "holdings_list");
  assert.equal(typeof body.renderedText, "string");
  await app.close();
});

test("portfolio percentage query returns portfolio answer response", async () => {
  const app = buildTestApp();
  const response = await app.inject({
    method: "POST",
    url: "/analyze",
    payload: {
      query:
        "What percentage of my portfolio consists of large-cap stocks and what percentage of my stocks are in mid-cap funds?",
    },
  });

  const body = response.json() as {
    mode?: unknown;
    renderedText?: unknown;
  };

  assert.equal(response.statusCode, 200);
  assert.equal(body.mode, "portfolio_answer");
  assert.equal(typeof body.renderedText, "string");
  await app.close();
});
