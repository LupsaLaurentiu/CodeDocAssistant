# Submission checklist and development notes

I keep this checklist to distinguish completed implementation work, automated verification and my own manual feedback. Codex helped write these notes and ran the local automated checks recorded below. A checked local item is not a claim that I performed it manually or that remote CI has passed.

## Completed locally

- [x] Implement public GitHub repository ingestion, code chunking, embeddings, pgvector retrieval and repository Q&A.
- [x] Validate citation source IDs and line ranges on the server; separate cited sources from other retrieved context.
- [x] Add recent repositories, local conversation persistence, progress reporting, retry, answer copying and source previews.
- [x] Protect indexing with database leases and transactional replacement; reuse an unchanged index when its commit and configuration match.
- [x] Apply the ingestion-progress migration without removing the existing repository index.
- [x] Pass lint, TypeScript checks, formatting checks and a production build.
- [x] Pass 77 automated tests, including the opt-in real PostgreSQL integration test.
- [x] Pass six Playwright scenarios with demo capture enabled, including responsive layout and conversation recovery checks.
- [x] Prepare screenshots and a clearly labelled scripted UX video using test fixtures, without paid OpenAI calls during milestone verification.
- [x] Document setup, architecture, RAG decisions, production requirements, testing and known limitations in the README and supporting docs.
- [x] Configure both GitHub Actions jobs; remote results are tracked separately below.

Verification details and repeatable commands are in [TESTING.md](TESTING.md). Browser tests use mocked provider responses; passing them does not establish live-model answer accuracy.

## My development decisions

### Scope and stack

I selected the Code Documentation Assistant and specified a single Next.js/TypeScript application. Keeping the UI and server endpoints together limits deployment and coordination overhead for this take-home. I chose PostgreSQL for repository metadata and chunks, with pgvector for vector search in the same database. Prisma handles the relational schema and migrations; vector operations use parameterized SQL where needed.

I wanted an explicit RAG pipeline rather than LangChain: clone, scan, chunk, embed, retrieve, build context and generate an answer. This makes each stage easier to inspect and explain. I deliberately kept authentication, billing, microservices, Redis and queues outside the requested scope.

### AI assistance and actual feedback

I used Codex for scaffolding, implementation, review, tests, debugging and documentation. I supplied the scope and stack, requested incremental milestones, tried answers against my DailyLove repository and shared UI screenshots. AI also helped draft these first-person notes; I do not present the implementation as entirely hand-written.

I reported a Romanian follow-up rejected by request validation and a workspace with double scrolling and a difficult-to-reach composer. Subsequent work addressed conversation validation and the responsive chat layout. Automated checks now exercise these areas, but I have not recorded a systematic manual review of the final version's answers and citations.

These are the concrete feedback examples documented during development. I distinguish them from the automated test runs performed by Codex.

### Main trade-off

I kept indexing within a long HTTP request to keep the local application small and understandable. The trade-off is that a process restart can interrupt the operation. Database leases prevent concurrent writers and transactional replacement protects the previous index; neither provides durable job execution or crash recovery. I would add durable background execution when hosting limits or workload require it.

### Proposed first improvement

I would first create a small labelled evaluation set with expected files and line ranges, including Romanian follow-ups, missing functionality and ambiguous questions. I would measure retrieval coverage and whether answers are supported by the cited code before adding hybrid search or syntax-aware chunking. Citation validation currently verifies reference integrity, not the truth of every claim. This is a next-step proposal, not a completed accuracy benchmark.

## Remaining before submission

- [x] Prepare first-person explanations of my scope, decisions, AI-assisted workflow, feedback and trade-offs, with AI assistance disclosed.
- [ ] Personally inspect the final main workflow and several answers against their cited source lines; record what I checked. New live-model requests incur API usage.
- [x] Keep the clearly labelled scripted UX video for this submission. A live RAG video is optional and has not been recorded.
- [x] Complete a publication preflight of current files, tracked Git history and demo artifacts. No credential-pattern matches or private source content were found; `.env` and my personal submission link remain outside Git. This is a scoped check, not a security certification.
- [x] Commit and push the implementation milestone and first-person documentation to `main`.
- [x] Verify both GitHub Actions jobs (`verify` and `browser-and-database`) passed on implementation commit `c9812e2`: [successful run](https://github.com/LupsaLaurentiu/CodeDocAssistant/actions/runs/35869180524). Subsequent documentation commits also run the workflow; their status is available in [Actions](https://github.com/LupsaLaurentiu/CodeDocAssistant/actions/workflows/ci.yml).
- [x] Make the repository public, as I requested, after checking current files and Git history for secrets.
- [x] Verify anonymous access to the public repository, README, all four screenshots and scripted video.
- [ ] Open my private assignment submission link and click Submit manually.

I keep the personal submission link in the original assignment email and in the ignored local file `.data/submission.md`, not in this public repository.

The delivery items above are checked only after their corresponding actions have been verified. The assignment itself is not submitted automatically.
