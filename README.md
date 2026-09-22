# Code Documentation Assistant

A conversational developer tool that will ingest a GitHub repository and answer questions grounded in its source code, including file and line citations.

This repository contains a production-oriented Next.js foundation and a working repository ingestion and Q&A flow. A public GitHub repository can be cloned, scanned, chunked, embedded with OpenAI, indexed in PostgreSQL/pgvector, and explored through grounded questions with file/line citations.

## Stack

- Next.js 16, React 19, TypeScript (strict), App Router
- Tailwind CSS 4, shadcn/ui, and react-markdown
- PostgreSQL 17 with pgvector
- Prisma 6
- OpenAI Node SDK
- Zod, simple-git, and fast-glob
- Docker Compose for local infrastructure

## Prerequisites

- Node.js 20.9 or newer (Node.js 22 LTS recommended)
- npm
- Git
- Docker Desktop or another Docker Compose-compatible runtime
- An OpenAI API key (required when calling embedding or answer-generation modules)

## Local setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create the local environment file:

   ```bash
   cp .env.example .env
   ```

   On PowerShell, use `Copy-Item .env.example .env`.

3. Add your `OPENAI_API_KEY` to `.env`. The example database URL already matches the Docker Compose service.

4. Start PostgreSQL with pgvector:

   ```bash
   docker compose up -d
   ```

5. Generate the Prisma client and apply the initial migration:

   ```bash
   npm run db:generate
   npm run db:migrate
   ```

6. Start the application:

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000).

## Environment variables

| Variable                  | Required | Purpose                                               |
| ------------------------- | -------- | ----------------------------------------------------- |
| `DATABASE_URL`            | Yes      | PostgreSQL connection string used by Prisma           |
| `OPENAI_API_KEY`          | Yes      | OpenAI API authentication                             |
| `OPENAI_CHAT_MODEL`       | No       | Chat model; defaults to `gpt-4.1-mini`                |
| `OPENAI_EMBEDDING_MODEL`  | No       | Embedding model; defaults to `text-embedding-3-small` |
| `REPOSITORY_STORAGE_PATH` | No       | Local clone root; defaults to `.data/repositories`    |

Environment variables are validated with Zod at the boundary where server-side infrastructure is initialized. Missing or invalid required values produce a descriptive startup/runtime error.

## Project structure

```text
src/
  app/                 # App Router pages and global styles
  components/ui/       # Minimal shadcn/ui component set
  config/              # Validated environment and model configuration
  lib/
    db/                # Prisma client
    github/            # GitHub URL validation and cloning
    ingestion/         # End-to-end indexing, discovery, limits, line chunking
    llm/               # OpenAI client, guarded prompts, answer generation
    rag/               # Embeddings, pgvector retrieval, context, Q&A orchestration
  types/               # Shared domain types
prisma/                # Schema and pgvector-aware SQL migration
scripts/               # Future operational scripts
```

## Quality commands

```bash
npm run lint
npm run typecheck
npm run format
npm run format:check
npm run build
```

## Repository ingestion

Enter a public GitHub repository URL on the landing page. The server validates the URL, creates a shallow temporary clone, ignores generated/dependency directories, chunks supported source files with line metadata, generates embeddings in batches, and atomically replaces that repository's pgvector index. Temporary source files are removed after the request.

Source chunk text is sent to the configured OpenAI embedding model. Only analyze repositories whose source you are authorized to send to that provider.

The current local-first implementation keeps the HTTP request open while indexing and limits ingestion to 1,000 supported files, 512 KB per file, and 25 MB total source text. Empty and oversized files are reported as skipped. A production deployment should move this long-running operation to a durable background worker.

## Question answering

After indexing completes, the application opens a dedicated repository workspace with index metadata, detected languages, suggested questions, and a full-width chat. Each question and up to six recent conversation messages are validated with Zod. The question is embedded, the eight closest chunks are ranked using pgvector cosine distance, and a bounded selection of those chunks is sent to the configured chat model.

Answers are rendered as Markdown. The prompt requires grounded answers and `path/to/file.ts:startLine-endLine` citations; the API also returns the exact retrieved chunk identifiers separately. Source chips are clickable and open a local code preview with line numbers, backed by an ownership-checked chunk endpoint.

## Current scope

End-to-end repository ingestion, semantic retrieval, conversational follow-ups, grounded answer generation, and file/line citations are operational. Conversations are currently held in browser memory rather than persisted. No synthetic analysis results are shown.
