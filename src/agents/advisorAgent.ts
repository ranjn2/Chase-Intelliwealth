import type {
  AdvisorOutput,
  AnalyzeRequest,
  LiquidityRequirement,
  RiskTolerance,
  TimeBucket,
} from "../models.js";
import type { QueryInterpretation } from "../services/openAiService.js";

export class AdvisorAgent {
  run(
    request: AnalyzeRequest,
    interpretation: QueryInterpretation,
  ): AdvisorOutput {
    const [goal, inferredGoal] = this.resolveGoal(request, interpretation.goal);
    const [timeHorizonYears, inferredTimeHorizon] = this.resolveTimeHorizon(
      request,
      interpretation.timeHorizonYears,
    );
    const timeHorizonBucket = this.bucketTimeHorizon(timeHorizonYears);
    const [liquidityRequirement, inferredLiquidityRequirement] =
      this.resolveLiquidity(
        request,
        goal,
        timeHorizonYears,
        interpretation.liquidityRequirement,
      );
    const [targetCorpusAmount, inferredTargetCorpus] = this.resolveTargetCorpus(
      interpretation.targetCorpusAmount,
    );
    const [riskTolerance, inferredRiskTolerance] = this.resolveRisk(request, {
      goal,
      timeHorizonYears,
      liquidityRequirement,
      riskHint: interpretation.riskTolerance,
    });

    return {
      goal,
      timeHorizonYears,
      timeHorizonBucket,
      riskTolerance,
      liquidityRequirement,
      targetCorpusAmount,
      executionPlan: [
        "Analyze current portfolio",
        "Identify issues",
        "Generate optimized allocation",
      ],
      inferredGoal,
      inferredTimeHorizon,
      inferredRiskTolerance,
      inferredLiquidityRequirement,
      inferredTargetCorpus,
    };
  }

  private resolveGoal(
    request: AnalyzeRequest,
    aiGoal: string | null | undefined,
  ): [string, boolean] {
    if (request.goal) {
      return [request.goal, false];
    }
    if (aiGoal && aiGoal.trim().length > 0) {
      return [aiGoal.trim(), true];
    }
    return ["wealth growth", true];
  }

  private resolveTimeHorizon(
    request: AnalyzeRequest,
    aiTimeHorizonYears: number | null,
  ): [number, boolean] {
    if (request.timeHorizonYears !== null) {
      return [Math.round(request.timeHorizonYears * 10) / 10, false];
    }
    if (typeof aiTimeHorizonYears === "number" && Number.isFinite(aiTimeHorizonYears)) {
      return [Math.round(Math.max(aiTimeHorizonYears, 0.1) * 10) / 10, true];
    }

    return [5, true];
  }

  private bucketTimeHorizon(timeHorizonYears: number): TimeBucket {
    if (timeHorizonYears < 3) {
      return "short";
    }
    if (timeHorizonYears <= 7) {
      return "medium";
    }
    return "long";
  }

  private resolveLiquidity(
    request: AnalyzeRequest,
    goal: string,
    timeHorizonYears: number,
    queryHint: LiquidityRequirement | null,
  ): [LiquidityRequirement, boolean] {
    if (request.liquidityRequirement !== null) {
      return [request.liquidityRequirement, false];
    }
    if (queryHint !== null) {
      return [queryHint, true];
    }
    if (timeHorizonYears < 3) {
      return ["high", true];
    }
    if (["buy a house", "education", "emergency reserve"].includes(goal)) {
      return ["medium", true];
    }
    return ["low", true];
  }

  private resolveRisk(
    request: AnalyzeRequest,
    context: {
      goal: string;
      timeHorizonYears: number;
      liquidityRequirement: LiquidityRequirement;
      riskHint: RiskTolerance | null;
    },
  ): [RiskTolerance, boolean] {
    if (request.riskTolerance !== null) {
      return [request.riskTolerance, false];
    }
    if (context.riskHint !== null) {
      return [context.riskHint, true];
    }

    if (
      context.liquidityRequirement === "high" ||
      context.timeHorizonYears < 3
    ) {
      return ["low", true];
    }
    if (
      ["retirement", "wealth growth", "financial freedom"].includes(context.goal) &&
      context.timeHorizonYears > 7
    ) {
      return ["high", true];
    }
    return ["medium", true];
  }

  private resolveTargetCorpus(
    interpretedTargetCorpus: number | null,
  ): [number | null, boolean] {
    if (typeof interpretedTargetCorpus === "number" && interpretedTargetCorpus > 0) {
      return [Math.round(interpretedTargetCorpus), true];
    }
    return [null, false];
  }
}
