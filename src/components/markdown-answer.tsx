import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function MarkdownAnswer({ content }: { content: string }) {
  return (
    <div className="min-w-0 space-y-4 text-[15px] leading-7 [overflow-wrap:anywhere] text-zinc-200">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        skipHtml
        components={{
          h1: ({ children }) => (
            <h3 className="mt-6 text-lg leading-7 font-semibold text-zinc-100">
              {children}
            </h3>
          ),
          h2: ({ children }) => (
            <h3 className="mt-6 text-base leading-7 font-semibold text-zinc-100">
              {children}
            </h3>
          ),
          h3: ({ children }) => (
            <h4 className="mt-5 text-sm leading-6 font-semibold text-zinc-100">
              {children}
            </h4>
          ),
          h4: ({ children }) => (
            <h5 className="mt-4 text-sm font-semibold">{children}</h5>
          ),
          h5: ({ children }) => (
            <h6 className="mt-4 text-sm font-semibold">{children}</h6>
          ),
          h6: ({ children }) => (
            <h6 className="mt-4 text-sm font-semibold">{children}</h6>
          ),
          p: ({ children }) => <p>{children}</p>,
          ul: ({ children }) => (
            <ul className="list-disc space-y-2 pl-5 marker:text-zinc-500">
              {children}
            </ul>
          ),
          ol: ({ children, start }) => (
            <ol
              start={start}
              className="list-decimal space-y-2 pl-5 marker:text-zinc-400"
            >
              {children}
            </ol>
          ),
          li: ({ children }) => (
            <li className="pl-1 [&>ol]:mt-2 [&>p+p]:mt-2 [&>ul]:mt-2">
              {children}
            </li>
          ),
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-sm text-blue-300 underline decoration-blue-400/40 underline-offset-4 hover:text-blue-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400"
            >
              {children}
            </a>
          ),
          img: ({ alt }) => (
            <span className="text-zinc-400">[Image: {alt || "image"}]</span>
          ),
          pre: ({ children }) => (
            <pre
              tabIndex={0}
              aria-label="Code block"
              className="max-w-full overflow-x-auto overscroll-x-contain rounded-lg border border-white/10 bg-black/30 p-4 text-xs leading-6 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400 [&>code]:block [&>code]:rounded-none [&>code]:bg-transparent [&>code]:p-0 [&>code]:text-xs [&>code]:[overflow-wrap:normal] [&>code]:whitespace-pre [&>code]:text-inherit"
            >
              {children}
            </pre>
          ),
          code: ({ className, children }) => (
            <code
              className={`rounded bg-white/[0.07] px-1.5 py-0.5 font-mono text-[0.85em] text-blue-200 ${className ?? ""}`}
            >
              {children}
            </code>
          ),
          table: ({ children }) => (
            <div
              tabIndex={0}
              role="region"
              aria-label="Answer table"
              className="max-w-full overflow-x-auto overscroll-x-contain rounded-lg border border-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400"
            >
              <table className="w-full border-collapse text-left text-xs leading-6">
                {children}
              </table>
            </div>
          ),
          th: ({ children, style }) => (
            <th
              style={style}
              className="border-b border-white/10 bg-white/5 px-3 py-2 font-semibold text-zinc-100"
            >
              {children}
            </th>
          ),
          td: ({ children, style }) => (
            <td
              style={style}
              className="border-b border-white/5 px-3 py-2 align-top"
            >
              {children}
            </td>
          ),
          blockquote: ({ children }) => (
            <blockquote className="space-y-2 border-l-2 border-blue-400/40 pl-4 text-zinc-400">
              {children}
            </blockquote>
          ),
          hr: () => <hr className="border-white/10" />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
