"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown, PanelLeft } from "lucide-react";

export function RepositorySidebar({ children }: { children: ReactNode }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <aside className="relative min-h-0 min-w-0 lg:overflow-y-auto lg:overscroll-contain">
      <button
        type="button"
        className="flex w-full items-center gap-2 rounded-lg border border-white/10 bg-zinc-900/60 px-3 py-2 text-sm text-zinc-300 focus-visible:outline-2 focus-visible:outline-blue-400 lg:hidden"
        aria-expanded={expanded}
        aria-controls="repository-details"
        onClick={() => setExpanded((value) => !value)}
      >
        <PanelLeft className="size-4 text-zinc-400" aria-hidden="true" />
        Repository details
        <ChevronDown
          className={`ml-auto size-4 ${expanded ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      </button>
      <div
        id="repository-details"
        className={`${expanded ? "block" : "hidden"} absolute inset-x-0 top-full z-20 mt-2 max-h-[50dvh] space-y-3 overflow-y-auto overscroll-contain rounded-xl border border-white/10 bg-zinc-950 p-2 shadow-xl lg:static lg:mt-0 lg:block lg:max-h-none lg:overflow-visible lg:rounded-none lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none`}
      >
        {children}
      </div>
    </aside>
  );
}
