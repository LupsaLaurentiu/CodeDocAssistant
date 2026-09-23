import { Braces, SearchCode } from "lucide-react";

import { RepositoryLauncher } from "@/components/repository-launcher";

export default function Home() {
  return (
    <main className="relative flex min-h-screen overflow-hidden bg-zinc-950 text-zinc-50">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(59,130,246,0.16),transparent_45%)]" />
      <div className="relative mx-auto flex w-full max-w-6xl flex-col px-6 py-8 sm:px-10 lg:px-12">
        <header className="flex items-center gap-3 text-sm font-medium text-zinc-300">
          <span className="flex size-9 items-center justify-center rounded-lg border border-white/10 bg-white/5">
            <Braces className="size-4 text-blue-400" aria-hidden="true" />
          </span>
          Code Documentation Assistant
        </header>

        <section className="flex flex-1 items-center py-20">
          <div className="grid w-full items-center gap-14 lg:grid-cols-[1.05fr_0.95fr]">
            <div>
              <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-blue-400/20 bg-blue-400/10 px-3 py-1 text-xs font-medium text-blue-300">
                <SearchCode className="size-3.5" aria-hidden="true" />
                Repository intelligence
              </p>
              <h1 className="max-w-3xl text-4xl leading-tight font-semibold tracking-tight text-balance sm:text-6xl">
                Understand any codebase through conversation.
              </h1>
              <p className="mt-6 max-w-xl text-base leading-7 text-zinc-400 sm:text-lg">
                Connect a GitHub repository to explore its architecture, trace
                functionality, and get answers grounded in the source code.
              </p>
            </div>

            <RepositoryLauncher />
          </div>
        </section>

        <footer className="text-xs text-zinc-600">
          Answers grounded in your repository, with file and line citations.
        </footer>
      </div>
    </main>
  );
}
