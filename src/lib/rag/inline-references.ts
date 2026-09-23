import { isIP } from "node:net";
import type { SourceCitation } from "@/types/rag";

export interface ValidatedReference {
  sourceId: string;
  citation: SourceCitation;
}

export function formatCitation(citation: SourceCitation): string {
  const label = `${citation.filePath}:${citation.startLine}-${citation.endLine}`;
  const fence = "`".repeat(
    Math.max(1, ...(label.match(/`+/g) ?? []).map((run) => run.length + 1)),
  );
  return `${fence} ${label} ${fence}`;
}

function isNetworkEndpoint(host: string, port: number): boolean {
  if (!Number.isInteger(port) || port < 1 || port > 65_535) return false;
  if (isIP(host)) return true;
  if (!/^https?:\/\//i.test(host)) return false;
  try {
    const url = new URL(`${host}:${port}`);
    return (
      url.pathname === "/" &&
      !url.search &&
      !url.hash &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
}

/** Repeated inline labels must agree with this section's validated references. */
export function validateInlineReferences(
  text: string,
  references: ValidatedReference[],
): string | null {
  const pattern =
    /\[S\d+\]|([^\s`"'<>]+?\.[\w-]+):(\d+(?:\.\d+)?)(?:-(\d+(?:\.\d+)?))?/g;
  let valid = true;
  const rendered = text.replace(
    pattern,
    (
      label: string,
      rawPath: string | undefined,
      rawStart: string | undefined,
      rawEnd: string | undefined,
    ) => {
      if (label.startsWith("[S") && /^\[S\d+\]$/.test(label)) {
        const reference = references.find(
          (item) => item.sourceId === label.slice(1, -1),
        );
        if (!reference) {
          valid = false;
          return label;
        }
        return formatCitation(reference.citation);
      }
      if (!rawPath || !rawStart) {
        valid = false;
        return label;
      }
      const startLine = Number(rawStart);
      const endLine = rawEnd ? Number(rawEnd) : startLine;
      if (!/^\d+$/.test(rawStart) || (rawEnd && !/^\d+$/.test(rawEnd))) {
        valid = false;
        return label;
      }
      // Markdown link/emphasis/opening punctuation is not part of a file path.
      const paths = [rawPath, rawPath.replace(/^[\[(*]+/, "")];
      if (!rawEnd && paths.some((path) => isNetworkEndpoint(path, startLine)))
        return label;
      const matches = references.some(
        ({ citation }) =>
          paths.includes(citation.filePath) &&
          Number.isSafeInteger(startLine) &&
          Number.isSafeInteger(endLine) &&
          startLine >= citation.startLine &&
          endLine <= citation.endLine &&
          endLine >= startLine,
      );
      if (!matches) valid = false;
      return label;
    },
  );
  return valid ? rendered : null;
}
