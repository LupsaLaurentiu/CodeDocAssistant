"use client";
import { useState } from "react";
import { Check, Copy } from "lucide-react";

export function CopyAnswer({ content }: { content: string }) {
  const [status, setStatus] = useState<"idle" | "copied" | "error">("idle");
  async function copy() {
    try {
      await navigator.clipboard.writeText(content);
      setStatus("copied");
    } catch {
      setStatus("error");
    }
  }
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-zinc-400">
      <button
        type="button"
        onClick={() => void copy()}
        className="inline-flex items-center gap-1.5 rounded px-2 py-1.5 hover:bg-white/5 hover:text-white focus-visible:outline-2 focus-visible:outline-blue-400"
        aria-label="Copy answer"
      >
        {status === "copied" ? (
          <Check className="size-3.5" aria-hidden="true" />
        ) : (
          <Copy className="size-3.5" aria-hidden="true" />
        )}{" "}
        Copy answer
      </button>
      <span role="status">
        {status === "copied"
          ? "Copied"
          : status === "error"
            ? "Clipboard unavailable. Select and copy the text manually."
            : ""}
      </span>
    </div>
  );
}
