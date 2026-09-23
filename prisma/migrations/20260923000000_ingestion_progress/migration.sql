-- Existing source chunks and index timestamps are preserved.
ALTER TABLE "repositories"
  ADD COLUMN "analysis_token" UUID,
  ADD COLUMN "lease_expires_at" TIMESTAMP(3),
  ADD COLUMN "analysis_phase" TEXT NOT NULL DEFAULT 'IDLE',
  ADD COLUMN "files_discovered" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "files_processed" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "files_skipped" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "chunks_total" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "chunks_embedded" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "index_reused" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "indexed_commit_sha" TEXT,
  ADD COLUMN "index_signature" TEXT,
  ADD COLUMN "indexed_at" TIMESTAMP(3);

UPDATE "repositories" SET "indexed_at" = "updated_at", "analysis_phase" = 'COMPLETE'
WHERE "status" = 'READY';

-- GitHub repository paths are case-insensitive. Fail rather than discard data
-- if an older installation already contains duplicates with different casing.
CREATE UNIQUE INDEX "repositories_url_case_insensitive_key" ON "repositories" (lower("url"));
