-- pgvector is required before creating the vector column.
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TYPE "RepositoryStatus" AS ENUM ('PENDING', 'CLONING', 'INDEXING', 'READY', 'FAILED');

CREATE TABLE "repositories" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "url" TEXT NOT NULL,
    "owner" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "default_branch" TEXT,
    "status" "RepositoryStatus" NOT NULL DEFAULT 'PENDING',
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "repositories_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "code_chunks" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "repository_id" UUID NOT NULL,
    "file_path" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "start_line" INTEGER NOT NULL,
    "end_line" INTEGER NOT NULL,
    "symbol" TEXT,
    "content" TEXT NOT NULL,
    "embedding" vector(1536),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "code_chunks_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "repositories_url_key" ON "repositories"("url");
CREATE INDEX "repositories_status_idx" ON "repositories"("status");
CREATE INDEX "code_chunks_repository_id_file_path_idx" ON "code_chunks"("repository_id", "file_path");

ALTER TABLE "code_chunks"
ADD CONSTRAINT "code_chunks_repository_id_fkey"
FOREIGN KEY ("repository_id") REFERENCES "repositories"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
