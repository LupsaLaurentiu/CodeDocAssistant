import { z } from "zod";

import { validateRepositoryUrl } from "@/lib/github";
import { analyzeRepository } from "@/lib/ingestion";
import { errorResponse } from "@/lib/api/errors";

export const runtime = "nodejs";
export const maxDuration = 300;

const requestSchema = z.object({
  repositoryUrl: z.string().trim().min(1).max(2_048),
});

export async function POST(request: Request): Promise<Response> {
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
      { error: "A GitHub repository URL is required." },
      { status: 400 },
    );
  }

  let reference;
  try {
    reference = validateRepositoryUrl(parsed.data.repositoryUrl);
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Invalid repository URL.",
      },
      { status: 400 },
    );
  }

  try {
    const result = await analyzeRepository(reference);
    return Response.json({ result }, { status: 201 });
  } catch (error) {
    return errorResponse(
      error,
      "Repository analysis failed. Check PostgreSQL and the server configuration, then retry.",
    );
  }
}
