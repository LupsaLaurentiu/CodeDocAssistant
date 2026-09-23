import Link from "next/link";
import {
  ArrowLeft,
  Boxes,
  Braces,
  CheckCircle2,
  ExternalLink,
  FileCode2,
  FolderGit2,
  GitBranch,
} from "lucide-react";

import { RepositoryChat } from "@/components/repository-chat";
import { RepositorySidebar } from "@/components/repository-sidebar";
import { RepositoryAnalyzer } from "@/components/repository-analyzer";
import type { RepositoryWorkspaceData } from "@/types/repository";

export function RepositoryWorkspace({
  repository,
}: {
  repository: RepositoryWorkspaceData;
}) {
  const indexedAt = new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(repository.indexedAt));

  return (
    <main className="h-dvh overflow-hidden bg-zinc-950 text-zinc-50">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_70%_0%,rgba(59,130,246,0.1),transparent_35%)]" />
      <div className="relative mx-auto flex h-full min-h-0 w-full max-w-[1600px] flex-col px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-5 sm:pt-4 lg:px-6">
        <header className="flex shrink-0 items-center justify-between gap-4 border-b border-white/10 pb-3 sm:pb-4">
          <div className="flex min-w-0 items-center gap-3">
            <Link
              href="/"
              className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-zinc-400 transition-colors hover:text-white"
              aria-label="Back to repository input"
            >
              <ArrowLeft className="size-4" aria-hidden="true" />
            </Link>
            <span className="hidden size-9 shrink-0 items-center justify-center rounded-lg border border-blue-400/20 bg-blue-400/10 sm:flex">
              <Braces className="size-4 text-blue-300" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-xs text-zinc-400">
                {repository.owner}
              </p>
              <h1 className="truncate text-base font-semibold text-zinc-100">
                {repository.name}
              </h1>
            </div>
          </div>
          <a
            href={repository.url}
            aria-label="Open repository on GitHub"
            target="_blank"
            rel="noreferrer"
            className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-zinc-300 transition-colors hover:bg-white/10 hover:text-white"
          >
            <FolderGit2 className="size-4" aria-hidden="true" />
            <span className="hidden sm:inline">Open on GitHub</span>
            <ExternalLink className="size-3" aria-hidden="true" />
          </a>
        </header>

        <div className="grid min-h-0 flex-1 grid-rows-[auto_minmax(0,1fr)] gap-3 pt-3 lg:grid-cols-[250px_minmax(0,1fr)] lg:grid-rows-[minmax(0,1fr)] lg:gap-5 lg:pt-4">
          <RepositorySidebar>
            <section className="rounded-xl border border-white/10 bg-zinc-900/60 p-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-medium tracking-wide text-zinc-400 uppercase">
                  Repository index
                </h2>
                <span
                  className={`inline-flex items-center gap-1.5 text-xs ${repository.status === "READY" ? "text-emerald-300" : "text-amber-300"}`}
                >
                  <CheckCircle2 className="size-3.5" aria-hidden="true" />
                  {repository.status === "READY" ? "Ready" : repository.status}
                </span>
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-black/20 p-3">
                  <dt className="flex items-center gap-1.5 text-xs text-zinc-400">
                    <FileCode2 className="size-3" aria-hidden="true" /> Files
                  </dt>
                  <dd className="mt-1 text-lg font-semibold text-zinc-100">
                    {repository.fileCount}
                  </dd>
                </div>
                <div className="rounded-lg bg-black/20 p-3">
                  <dt className="flex items-center gap-1.5 text-xs text-zinc-400">
                    <Boxes className="size-3" aria-hidden="true" /> Chunks
                  </dt>
                  <dd className="mt-1 text-lg font-semibold text-zinc-100">
                    {repository.chunkCount}
                  </dd>
                </div>
              </dl>
              <div className="mt-4 flex items-center gap-2 text-xs text-zinc-400">
                <GitBranch className="size-3.5 shrink-0" aria-hidden="true" />
                <span className="truncate" title={repository.defaultBranch}>
                  {repository.defaultBranch ?? "Default branch"}
                </span>
              </div>
              <p className="mt-2 text-xs leading-5 text-zinc-400">
                {repository.status === "READY" ? "Indexed" : "Updated"}{" "}
                {indexedAt}
              </p>
              {repository.indexedCommitSha && (
                <p
                  className="mt-1 font-mono text-xs text-zinc-400"
                  title={repository.indexedCommitSha}
                >
                  Commit {repository.indexedCommitSha.slice(0, 7)}
                </p>
              )}
            </section>

            <section className="rounded-xl border border-white/10 bg-zinc-900/60 p-4">
              <h2 className="text-xs font-medium tracking-wide text-zinc-400 uppercase">
                Languages
              </h2>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {repository.languages.map((language) => (
                  <span
                    key={language}
                    className="max-w-full rounded-md border border-white/10 bg-white/5 px-2 py-1 font-mono text-xs wrap-anywhere text-zinc-300"
                  >
                    {language}
                  </span>
                ))}
              </div>
            </section>

            <section className="rounded-xl border border-blue-400/10 bg-blue-400/5 p-4 text-xs leading-5 text-zinc-400">
              Answers are grounded in retrieved code. Open a source citation to
              inspect the exact indexed chunk.
            </section>
          </RepositorySidebar>

          <section className="min-h-0 min-w-0 overflow-hidden rounded-xl border border-white/10 bg-zinc-900/60 shadow-2xl shadow-black/20">
            {repository.status === "READY" ? (
              <RepositoryChat
                key={repository.id + repository.indexedAt}
                repositoryId={repository.id}
                repositoryName={repository.name}
                indexRevision={repository.indexedAt}
              />
            ) : (
              <div className="flex h-full items-center justify-center overflow-y-auto p-8 text-center text-sm text-zinc-400">
                <div className="w-full max-w-md space-y-4">
                  <p>
                    This repository is not ready for questions. Current status:{" "}
                    {repository.status}.
                  </p>
                  <RepositoryAnalyzer initialUrl={repository.url} />
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
