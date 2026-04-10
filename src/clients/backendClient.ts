import type { AnalyzeRequest, IntelliWealthResponse } from "../models.js";
import { getSettings } from "../config.js";

export class BackendConnectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BackendConnectionError";
  }
}

export class BackendRequestError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = "BackendRequestError";
  }
}

export async function analyzeViaBackend(
  payload: Pick<AnalyzeRequest, "query">,
): Promise<IntelliWealthResponse> {
  return await postJson<IntelliWealthResponse>("/analyze", payload);
}

async function postJson<TResponse>(
  path: string,
  payload: unknown,
): Promise<TResponse> {
  const settings = getSettings();
  let response: Response;
  try {
    response = await fetch(`${settings.backendUrl.replace(/\/$/, "")}${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(settings.requestTimeoutMs),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown backend connection error.";
    throw new BackendConnectionError(
      `Could not reach IntelliWealth backend at ${settings.backendUrl}. ${message}`,
    );
  }

  if (!response.ok) {
    const body = await response.text();
    let message = body;
    try {
      const parsed = JSON.parse(body) as { error?: unknown };
      if (typeof parsed.error === "string" && parsed.error.trim().length > 0) {
        message = parsed.error;
      }
    } catch {}
    throw new BackendRequestError(response.status, message);
  }

  return (await response.json()) as TResponse;
}
