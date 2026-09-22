import Link from "next/link";
import { ArrowLeft, FileQuestion } from "lucide-react";

export default function RepositoryNotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-6 text-zinc-50">
      <div className="max-w-md text-center">
        <span className="mx-auto flex size-12 items-center justify-center rounded-xl border border-white/10 bg-white/5">
          <FileQuestion className="size-5 text-zinc-400" aria-hidden="true" />
        </span>
        <h1 className="mt-5 text-2xl font-semibold">Repository not found</h1>
        <p className="mt-2 text-sm leading-6 text-zinc-400">
          This repository has not been indexed, or its local index was removed.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-blue-300 hover:text-blue-200"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Analyze a repository
        </Link>
      </div>
    </main>
  );
}
