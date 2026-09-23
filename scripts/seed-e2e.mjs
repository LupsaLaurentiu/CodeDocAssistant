import { PrismaClient } from "@prisma/client";

// Explicit test DB only. This script never modifies a user's indexed repository.
const url = new URL(process.env.DATABASE_URL ?? "postgresql://invalid/invalid");
if (!url.pathname.endsWith("/codedoc_test"))
  throw new Error("E2E seed requires a database named codedoc_test.");
const db = new PrismaClient();
try {
  const repository = await db.repository.upsert({
    where: { url: "https://github.com/codedoc-fixtures/tiny-service" },
    create: {
      id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
      url: "https://github.com/codedoc-fixtures/tiny-service",
      owner: "codedoc-fixtures",
      name: "tiny-service",
      status: "READY",
      analysisPhase: "COMPLETE",
      defaultBranch: "main",
      indexedAt: new Date("2026-01-01T12:00:00Z"),
      indexedCommitSha: "a".repeat(40),
    },
    update: {},
  });
  await db.codeChunk.upsert({
    where: { id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd" },
    create: {
      id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      repositoryId: repository.id,
      filePath: "src/auth.ts",
      language: "typescript",
      startLine: 1,
      endLine: 3,
      content: "export function login() {\n  return validateSession();\n}",
    },
    update: {},
  });
  console.info(
    "Seeded the isolated E2E fixture (no embeddings or provider calls).",
  );
} finally {
  await db.$disconnect();
}
