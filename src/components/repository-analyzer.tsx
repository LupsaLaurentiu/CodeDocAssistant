"use client";
import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { GitFork, LoaderCircle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { AnalysisProgress } from "@/components/analysis-progress";
import { analysisResultSchema } from "@/lib/ingestion/progress-schema";
import { validateRepositoryUrl } from "@/lib/github/validate-repository-url";

export function RepositoryAnalyzer({
  initialUrl = "",
}: {
  initialUrl?: string;
}) {
  const router = useRouter();
  const [url, setUrl] = useState(initialUrl);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string>();
  const [activeUrl, setActiveUrl] = useState("");
  const [attempt, setAttempt] = useState(0);
  const active = useRef(false);
  async function analyze() {
    if (active.current) return;
    let normalized: string;
    try {
      normalized = validateRepositoryUrl(url).url;
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Enter a valid GitHub URL.",
      );
      return;
    }
    active.current = true;
    setIsAnalyzing(true);
    setError(undefined);
    setActiveUrl(normalized);
    setAttempt((value) => value + 1);
    try {
      const response = await fetch("/api/repositories/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repositoryUrl: normalized }),
      });
      const payload: unknown = await response.json();
      if (!response.ok)
        throw new Error(
          typeof payload === "object" &&
            payload !== null &&
            "error" in payload &&
            typeof payload.error === "string"
            ? payload.error
            : "Analysis failed. Please retry.",
        );
      const result = analysisResultSchema.parse(
        typeof payload === "object" && payload !== null && "result" in payload
          ? payload.result
          : undefined,
      );
      router.push(`/repositories/${result.repositoryId}`);
      router.refresh();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Analysis failed. Check your connection and retry.",
      );
    } finally {
      active.current = false;
      setIsAnalyzing(false);
    }
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void analyze();
  }
  return (
    <Card className="border-white/10 bg-zinc-900/70 shadow-xl ring-white/10">
      <CardHeader className="gap-2">
        <CardTitle className="text-lg text-zinc-100">
          Analyze a repository
        </CardTitle>
        <CardDescription className="text-zinc-400">
          Public GitHub repositories · Reuse unchanged indexes
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={submit}>
          <label
            htmlFor="repository-url"
            className="block text-sm font-medium text-zinc-300"
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
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://github.com/owner/repository"
              disabled={isAnalyzing}
              required
              maxLength={2048}
              className="h-11 border-white/10 bg-black/20 pl-10 text-zinc-100 placeholder:text-zinc-500"
            />
          </div>
          <Button
            type="submit"
            className="h-11 w-full bg-blue-600 text-white hover:bg-blue-500"
            disabled={isAnalyzing}
          >
            {isAnalyzing ? (
              <>
                <LoaderCircle
                  className="size-4 animate-spin"
                  aria-hidden="true"
                />
                Analyzing repository…
              </>
            ) : error ? (
              <>
                <RotateCcw className="size-4" aria-hidden="true" />
                Retry analysis
              </>
            ) : (
              "Analyze Repository"
            )}
          </Button>
          {error && (
            <p
              role="alert"
              className="rounded-lg border border-red-400/20 bg-red-400/5 p-3 text-sm leading-6 text-red-200"
            >
              {error}
            </p>
          )}
          {activeUrl && (
            <AnalysisProgress
              key={activeUrl}
              url={activeUrl}
              attempt={attempt}
            />
          )}
          <p className="text-xs leading-5 text-zinc-400">
            {isAnalyzing
              ? "Keep this page open. Progress reflects completed work, not an estimated percentage."
              : "Source chunks are sent to OpenAI for embedding. Analyze only code you are authorized to share with the provider."}
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
