import { z } from "zod";

import { db } from "@/lib/db";
import { answerRepositoryQuestion } from "@/lib/rag";
import { errorResponse } from "@/lib/api/errors";
import { questionRequestSchema } from "@/lib/api/question-schema";
import { getAiConfig } from "@/config/ai";
import { indexSignature } from "@/lib/ingestion/index-signature";
import { effectiveRepositoryStatus } from "@/lib/ingestion/effective-status";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ repositoryId: string }> },
): Promise<Response> {
  const { repositoryId } = await params;
  if (!z.string().uuid().safeParse(repositoryId).success) {
    return Response.json(
      { error: "Invalid repository identifier." },
      { status: 400 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: "Request body must be valid JSON." },
      { status: 400 },
    );
  }

  const parsed = questionRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      {
        error:
          "Use a question of 2–2,000 characters and at most six history messages of up to 8,000 characters each.",
      },
      { status: 400 },
    );
  }

  try {
    const repository = await db.repository.findUnique({
      where: { id: repositoryId },
      select: {
        status: true,
        indexSignature: true,
        indexedAt: true,
        leaseExpiresAt: true,
      },
    });
    if (!repository) {
      return Response.json(
        { error: "Repository was not found." },
        { status: 404 },
      );
    }
    if (effectiveRepositoryStatus(repository) !== "READY") {
      return Response.json(
        {
          error:
            "Repository must finish indexing before questions can be asked.",
        },
        { status: 409 },
      );
    }
    if (repository.indexSignature) {
      const config = getAiConfig();
      if (
        repository.indexSignature !==
        indexSignature(config.embeddingModel, config.embeddingDimensions)
      ) {
        return Response.json(
          {
            error:
              "The index configuration changed. Reanalyze this repository before asking questions.",
          },
          { status: 409 },
        );
      }
    }

    const result = await answerRepositoryQuestion({
      repositoryId,
      question: parsed.data.question,
      history: parsed.data.history,
    });
    return Response.json(
      { result },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return errorResponse(
      error,
      "Could not answer this question. Check that PostgreSQL is running and try again.",
    );
  }
}
