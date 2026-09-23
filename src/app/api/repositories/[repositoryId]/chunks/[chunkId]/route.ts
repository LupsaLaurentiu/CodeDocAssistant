import { z } from "zod";

import { db } from "@/lib/db";
import { errorResponse } from "@/lib/api/errors";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ repositoryId: string; chunkId: string }> },
): Promise<Response> {
  const { repositoryId, chunkId } = await params;
  const uuidSchema = z.string().uuid();
  if (
    !uuidSchema.safeParse(repositoryId).success ||
    !uuidSchema.safeParse(chunkId).success
  ) {
    return Response.json(
      { error: "Invalid source identifier." },
      { status: 400 },
    );
  }

  try {
    const chunk = await db.codeChunk.findFirst({
      where: { id: chunkId, repositoryId },
      select: {
        id: true,
        filePath: true,
        language: true,
        startLine: true,
        endLine: true,
        symbol: true,
        content: true,
      },
    });
    if (!chunk) {
      return Response.json(
        { error: "Source chunk was not found." },
        { status: 404 },
      );
    }

    return Response.json(
      {
        result: {
          chunkId: chunk.id,
          filePath: chunk.filePath,
          language: chunk.language,
          startLine: chunk.startLine,
          endLine: chunk.endLine,
          symbol: chunk.symbol ?? undefined,
          content: chunk.content,
        },
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return errorResponse(
      error,
      "Could not load this source. Check PostgreSQL and retry.",
    );
  }
}
