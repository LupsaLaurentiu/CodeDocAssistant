"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  GitFork,
  LoaderCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { RepositoryAnalysisResult } from "@/types/repository";

type AnalysisState =
  | { status: "idle" }
  | { status: "analyzing" }
  | { status: "success"; result: RepositoryAnalysisResult }
  | { status: "error"; message: string };

function isAnalysisResult(value: unknown): value is RepositoryAnalysisResult {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.repositoryId === "string" &&
    typeof candidate.repositoryUrl === "string" &&
    typeof candidate.filesDiscovered === "number" &&
    typeof candidate.filesIndexed === "number" &&
    typeof candidate.filesSkipped === "number" &&
    typeof candidate.chunksIndexed === "number"
  );
}

function getResponseError(payload: unknown): string {
  if (typeof payload === "object" && payload !== null) {
    const error = (payload as Record<string, unknown>).error;
    if (typeof error === "string") {
      return error;
    }
  }
  return "Repository analysis failed. Check the server logs for details.";
}

export function RepositoryAnalyzer() {
  const router = useRouter();
  const [state, setState] = useState<AnalysisState>({ status: "idle" });

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const repositoryUrl = String(formData.get("repositoryUrl") ?? "").trim();

    setState({ status: "analyzing" });

    try {
      const response = await fetch("/api/repositories/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repositoryUrl }),
      });
      const payload: unknown = await response.json();

      if (!response.ok) {
        throw new Error(getResponseError(payload));
      }

      const result =
        typeof payload === "object" && payload !== null
          ? (payload as Record<string, unknown>).result
          : undefined;
      if (!isAnalysisResult(result)) {
        throw new Error("The server returned an invalid analysis result.");
      }

      setState({ status: "success", result });
      router.push(`/repositories/${result.repositoryId}`);
    } catch (error) {
      setState({
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "Repository analysis failed unexpectedly.",
      });
    }
  }

  const isAnalyzing = state.status === "analyzing";

  return (
    <Card className="border-white/10 bg-zinc-900/70 shadow-2xl shadow-blue-950/20 ring-white/10 backdrop-blur">
      <CardHeader className="gap-2">
        <CardTitle className="text-lg text-zinc-100">
          Analyze a repository
        </CardTitle>
        <CardDescription className="text-zinc-400">
          Public GitHub repositories are supported in the initial version.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <label
            className="block text-sm font-medium text-zinc-300"
            htmlFor="repository-url"
          >
            GitHub repository URL
          </label>
          <div className="relative">
            <GitFork
              className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-zinc-500"
              aria-hidden="true"
            />
            <Input
              id="repository-url"
              name="repositoryUrl"
              type="url"
              inputMode="url"
              autoComplete="url"
              placeholder="https://github.com/owner/repository"
              className="h-11 border-white/10 bg-black/20 pl-10 text-zinc-100 placeholder:text-zinc-600"
              disabled={isAnalyzing}
              required
            />
          </div>
          <Button
            type="submit"
            size="lg"
            className="h-11 w-full bg-blue-600 text-white hover:bg-blue-500"
            aria-describedby="analysis-status"
            disabled={isAnalyzing}
          >
            {isAnalyzing ? (
              <>
                <LoaderCircle className="animate-spin" aria-hidden="true" />
                Cloning and indexing…
              </>
            ) : (
              <>
                Analyze Repository
                <ArrowRight data-icon="inline-end" aria-hidden="true" />
              </>
            )}
          </Button>

          <div
            id="analysis-status"
            className="min-h-10 text-center text-xs text-zinc-500"
            aria-live="polite"
          >
            {state.status === "idle" &&
              "Source chunks are sent to OpenAI for embedding, then stored in your local database."}
            {state.status === "analyzing" &&
              "This can take a few minutes. Keep this page open."}
            {state.status === "error" && (
              <span className="inline-flex items-start gap-2 text-left text-red-300">
                <AlertCircle
                  className="mt-0.5 size-4 shrink-0"
                  aria-hidden="true"
                />
                {state.message}
              </span>
            )}
            {state.status === "success" && (
              <span className="inline-flex items-start gap-2 text-left text-emerald-300">
                <CheckCircle2
                  className="mt-0.5 size-4 shrink-0"
                  aria-hidden="true"
                />
                <span>
                  Indexed {state.result.filesIndexed} files into{" "}
                  {state.result.chunksIndexed} chunks. Opening workspace…
                  {state.result.filesSkipped > 0 &&
                    ` Skipped ${state.result.filesSkipped} empty or oversized files.`}
                </span>
              </span>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
