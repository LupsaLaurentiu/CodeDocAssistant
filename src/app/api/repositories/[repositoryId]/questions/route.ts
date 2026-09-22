import { z } from "zod";

import { db } from "@/lib/db";
import { answerRepositoryQuestion } from "@/lib/rag";

export const runtime = "nodejs";
export const maxDuration = 120;

const messageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1).max(8_000),
});

const requestSchema = z.object({
  question: z.string().trim().min(2).max(2_000),
  history: z.array(messageSchema).max(6).default([]),
});

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

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Question or conversation history is invalid." },
      { status: 400 },
    );
  }

  const repository = await db.repository.findUnique({
    where: { id: repositoryId },
    select: { status: true },
  });
  if (!repository) {
    return Response.json(
      { error: "Repository was not found." },
      { status: 404 },
    );
  }
  if (repository.status !== "READY") {
    return Response.json(
      {
        error: "Repository must finish indexing before questions can be asked.",
      },
      { status: 409 },
    );
  }

  try {
    const result = await answerRepositoryQuestion({
      repositoryId,
      question: parsed.data.question,
      history: parsed.data.history,
    });
    return Response.json({ result });
  } catch (error) {
    console.error("Repository question failed", error);
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Question answering failed unexpectedly.",
      },
      { status: 500 },
    );
  }
}
