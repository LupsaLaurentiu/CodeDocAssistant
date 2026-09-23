"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, RefreshCw } from "lucide-react";
import { z } from "zod";
import { RepositoryAnalyzer } from "@/components/repository-analyzer";

const recentSchema = z.array(
  z.object({
    id: z.string().uuid(),
    url: z.string().url(),
    owner: z.string(),
    name: z.string(),
    status: z.enum(["PENDING", "CLONING", "INDEXING", "READY", "FAILED"]),
    indexedAt: z.string().nullable(),
    commitSha: z.string().nullable(),
    chunkCount: z.number(),
    phase: z.string(),
  }),
);
type RecentRepository = z.infer<typeof recentSchema>[number];

export function RepositoryLauncher() {
  const [selectedUrl, setSelectedUrl] = useState("");
  const [repositories, setRepositories] = useState<RecentRepository[]>([]);
  const [error, setError] = useState<string>();
  const [loaded, setLoaded] = useState(false);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch("/api/repositories", {
          signal: controller.signal,
          cache: "no-store",
        });
        if (!response.ok)
          throw new Error(
            "Could not load recent repositories. Check PostgreSQL and retry.",
          );
        const payload: unknown = await response.json();
        const result = recentSchema.parse(
          typeof payload === "object" && payload !== null && "result" in payload
            ? payload.result
            : undefined,
        );
        if (!controller.signal.aborted) {
          setRepositories(result);
          setError(undefined);
        }
      } catch {
        if (!controller.signal.aborted)
          setError(
            "Could not load recent repositories. Check PostgreSQL and retry.",
          );
      } finally {
        if (!controller.signal.aborted) setLoaded(true);
      }
    }
    void load();
    return () => controller.abort();
  }, [refresh]);
  function choose(url: string) {
    setSelectedUrl(url);
    requestAnimationFrame(() =>
      document.getElementById("repository-url")?.focus(),
    );
  }
  return (
    <div className="min-w-0 space-y-5">
      <RepositoryAnalyzer key={selectedUrl} initialUrl={selectedUrl} />
      <section
        aria-labelledby="recent-repositories"
        className="rounded-xl border border-white/10 bg-zinc-900/50 p-4"
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2
            id="recent-repositories"
            className="text-sm font-medium text-zinc-200"
          >
            Recent repositories
          </h2>
          <button
            type="button"
            aria-label="Refresh recent repositories"
            onClick={() => setRefresh((value) => value + 1)}
            className="rounded p-2 text-zinc-400 hover:bg-white/5 hover:text-white"
          >
            <RefreshCw className="size-3.5" />
          </button>
        </div>
        {!loaded && (
          <p role="status" className="text-xs text-zinc-400">
            Loading repositories…
          </p>
        )}
        {error && (
          <p role="alert" className="text-xs leading-5 text-amber-200">
            {error}
          </p>
        )}
        {loaded && !error && !repositories.length && (
          <p className="text-xs leading-5 text-zinc-400">
            Your indexed repositories will appear here. Reopen them without
            generating embeddings again.
          </p>
        )}
        <ul className="max-h-72 space-y-2 overflow-y-auto">
          {repositories.map((repository) => (
            <li
              key={repository.id}
              className="rounded-lg border border-white/5 bg-black/15 p-3"
            >
              <div className="flex items-start justify-between gap-3">
                <Link
                  href={`/repositories/${repository.id}`}
                  className="min-w-0 text-sm text-zinc-100 hover:text-blue-300"
                >
                  <span className="block truncate">
                    {repository.owner}/{repository.name}
                  </span>
                  <span className="mt-1 block text-xs text-zinc-400">
                    {repository.status === "READY"
                      ? `${repository.chunkCount} chunks · Ready`
                      : repository.status}
                  </span>
                </Link>
                <Link
                  aria-label={`Open ${repository.name}`}
                  href={`/repositories/${repository.id}`}
                  className="rounded p-1 text-blue-300"
                >
                  <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
              </div>
              <button
                type="button"
                onClick={() => choose(repository.url)}
                className="mt-2 text-xs text-zinc-400 underline underline-offset-4 hover:text-zinc-200"
              >
                {repository.status === "FAILED"
                  ? "Retry analysis"
                  : "Check for updates"}
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
