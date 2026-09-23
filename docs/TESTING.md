# Testing

## Unit and API boundary tests — no database or paid API needed

```bash
npm ci
npm run db:generate
npm test
```

The suite replaces provider methods with explicit mocks and blocks accidental fetch calls. It checks citation ranges, abstention handling, context boundaries, chunk line mapping, URL validation, ignored paths/symlinks, history bounds, retries, index reuse and safe errors. Clone regression tests run the installed Git and simple-git against temporary local repositories, without network access; they exercise the library's real security checks, inherited environment isolation and destination protection. The one real database test is skipped unless `TEST_DATABASE_URL` is provided.

These tests do not measure a live model's accuracy, abstention rate or prompt-injection resistance.

## Optional public clone smoke test — no OpenAI usage

To exercise the same clone function against an actual public GitHub repository, opt in explicitly:

```powershell
$env:TEST_PUBLIC_REPOSITORY_URL = 'https://github.com/LupsaLaurentiu/website-technologies-scraper'
npm test -- tests/clone-repository.test.ts
Remove-Item Env:TEST_PUBLIC_REPOSITORY_URL
```

On macOS/Linux, use `TEST_PUBLIC_REPOSITORY_URL=https://github.com/LupsaLaurentiu/website-technologies-scraper npm test -- tests/clone-repository.test.ts`.

This downloads into a temporary directory and removes only its own fixture afterward. It does not update the application database, generate embeddings or call OpenAI. It is skipped in normal CI. Git must be installed and available on `PATH`.

Cloning preserves an allowlist of OS, proxy and certificate environment settings while excluding application secrets and injected Git options. It disables system/global Git configuration using Git's documented configuration controls ([Git environment reference](https://git-scm.com/docs/git#Documentation/git.txt-GITCONFIGGLOBAL)). The simple-git config-path opt-in is limited to a fixed null-device path (`NUL` on Windows, `/dev/null` elsewhere), never a user-supplied configuration file. Host Git aliases, credential helpers, URL rewrites and custom filters are not loaded; custom proxy/CA settings must be supplied through the supported environment variables instead.

## Isolated database and browser suite

Do not run fixture scripts against your normal `codedoc` database. Create `codedoc_test` once:

```bash
docker compose exec -T postgres psql -U codedoc -d postgres -c "CREATE DATABASE codedoc_test"
```

If it already exists, keep it; do not drop it just to rerun tests.

In a separate PowerShell terminal:

```powershell
$env:DATABASE_URL = 'postgresql://codedoc:codedoc@localhost:5433/codedoc_test?schema=public'
$env:TEST_DATABASE_URL = $env:DATABASE_URL
$env:OPENAI_API_KEY = 'test-key-never-used'
npm run db:deploy
npm test
node scripts/seed-e2e.mjs
npx playwright install chromium
npm run build
npm run start -- --port 3100
```

On macOS/Linux use `export DATABASE_URL='...'`, `export TEST_DATABASE_URL="$DATABASE_URL"`, and `export OPENAI_API_KEY='test-key-never-used'` with the same commands.

The fixture script refuses databases not named `codedoc_test`. The integration test creates a uniquely named temporary repository and deletes only its own row afterward; the browser fixture remains available for repeat runs. The test app uses a dummy API key.

From another terminal:

```bash
npm run test:e2e
```

Default target is `http://127.0.0.1:3100`; override via `E2E_BASE_URL`. Browser tests intercept only the paid question/analysis responses used by each scenario; pages, metadata and source preview use the isolated application/database. They cover opening a saved index, progress counters, error/retry behavior, clipboard, refresh persistence, clearing history, source scoping and four viewport sizes.

The opt-in demo-capture test is skipped normally. Browser traces and reports are ignored by Git. CI repeats these commands against a fresh pgvector service with dummy credentials.

## Manual smoke check on a real repository

1. Index a small public repository you are authorized to send to the provider.
2. Ask a known-answer question and inspect every cited range.
3. Ask a question whose answer is not in the code; ensure the answer expresses uncertainty.
4. Reanalyze the same commit: expect `indexReused: true` and no embedding requests for that run.
5. Change a commit: expect a new index timestamp and a new browser conversation.
6. Trigger two analyses together: one should receive 409.

Steps 1–3 and a changed-commit reindex are billable. They are not part of the default test suite.
