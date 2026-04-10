import assert from "node:assert/strict";
import test from "node:test";

import { IntelliWealthPipeline } from "../src/agents/pipeline.js";
import { getSettings } from "../src/config.js";
import type { AnalyzeRequest } from "../src/models.js";
import { OpenAiService } from "../src/services/openAiService.js";
import type { PortfolioService } from "../src/services/portfolioService.js";
import { MockPortfolioService } from "./helpers/mockPortfolio.js";

function buildPipeline(): IntelliWealthPipeline {
  const settings = getSettings();
  return new IntelliWealthPipeline(
    new MockPortfolioService() as unknown as PortfolioService,
    new OpenAiService(settings),
  );
}

test("pipeline is deterministic", async () => {
  const pipeline = buildPipeline();
  const request: AnalyzeRequest = {
    query: "Analyze my portfolio for a 5-year goal",
    goal: null,
    timeHorizonYears: null,
    riskTolerance: null,
    liquidityRequirement: null,
  };

  const first = await pipeline.analyze(request);
  const second = await pipeline.analyze(request);

  assert.equal(first.mode, "analysis");
  assert.equal(second.mode, "analysis");
  assert.deepEqual(first.currentAllocation, second.currentAllocation);
  assert.deepEqual(first.identifiedIssues, second.identifiedIssues);
  assert.deepEqual(first.recommendation, second.recommendation);
  assert.deepEqual(first.targetAllocation, second.targetAllocation);
  assert.equal(first.confidenceScore, second.confidenceScore);
  assert.equal(first.renderedText, second.renderedText);
});

test("low risk cap is enforced", async () => {
  const pipeline = buildPipeline();
  const response = await pipeline.analyze({
    query: "Analyze my portfolio for a house goal in 2 years with low risk",
    goal: null,
    timeHorizonYears: null,
    riskTolerance: null,
    liquidityRequirement: null,
  });

  assert.equal(response.mode, "analysis");
  assert.ok(response.targetAllocation.equity <= 50);
  assert.ok(response.targetAllocation.cash >= 10);
});

test("holdings inventory query bypasses advisory mode", async () => {
  const pipeline = buildPipeline();
  const response = await pipeline.analyze({
    query: "What stocks are there in my portfolio?",
    goal: null,
    timeHorizonYears: null,
    riskTolerance: null,
    liquidityRequirement: null,
  });

  assert.equal(response.mode, "holdings_list");
  assert.match(response.renderedText, /Stocks In Your Portfolio|No equity holdings/i);
});

test("portfolio fact query uses portfolio-answer mode", async () => {
  const pipeline = buildPipeline();
  const response = await pipeline.analyze({
    query:
      "What percentage of my portfolio consists of large-cap stocks and what percentage of my stocks are in mid-cap funds?",
    goal: null,
    timeHorizonYears: null,
    riskTolerance: null,
    liquidityRequirement: null,
  });

  assert.equal(response.mode, "portfolio_answer");
  assert.equal(typeof response.renderedText, "string");
});

test("goal corpus requests produce goal-path math", async () => {
  const pipeline = buildPipeline();
  const response = await pipeline.analyze({
    query:
      "Analyze my portfolio allocation and suggest changes I can make considering that I want to buy a car in 5 years and I want to achieve a target of 50k",
    goal: null,
    timeHorizonYears: null,
    riskTolerance: null,
    liquidityRequirement: null,
  });

  assert.equal(response.mode, "analysis");
  assert.ok(response.goalPath);
  assert.equal(response.goalPath.targetCorpusAmount, 50000);
  assert.match(response.renderedText, /Goal Path/);
});
