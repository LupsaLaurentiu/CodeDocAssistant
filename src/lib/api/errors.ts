import OpenAI from "openai";

import { logEvent } from "@/lib/observability";

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function errorResponse(
  error: unknown,
  fallbackMessage: string,
): Response {
  let status = 500;
  let code = "INTERNAL_ERROR";
  let message = fallbackMessage;
  if (error instanceof ApiError) {
    ({ status, code } = error);
    message = error.message;
  } else if (error instanceof OpenAI.APIError) {
    if (error.status === 429) {
      status = 429;
      code = "PROVIDER_LIMIT";
      message =
        "The AI provider's quota or rate limit was reached. Check the API project's billing and limits before retrying.";
    } else if (error.status === 401 || error.status === 403) {
      status = 503;
      code = "PROVIDER_CONFIGURATION";
      message =
        "The AI provider could not authenticate this application. Check the server's API configuration.";
    } else {
      status = 502;
      code = "PROVIDER_UNAVAILABLE";
      message = "The AI provider is temporarily unavailable. Please try again.";
    }
  }
  const requestId = crypto.randomUUID();
  logEvent("request.failed", { requestId, status, code });
  return Response.json(
    { error: message, code, requestId },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}
