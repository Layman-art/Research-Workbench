import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';

interface MarkdownPreviewProps {
  source: string;
  onOpenExternal: (url: string) => void | Promise<void>;
  className?: string;
}

export function MarkdownPreview({ source, onOpenExternal, className = '' }: MarkdownPreviewProps) {
  return (
    <div className={`markdown-body ${className}`.trim()}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        components={{
          a: ({ href, children }) => (
            <a
              href={href}
              onClick={(event) => {
                event.preventDefault();
                if (href) void onOpenExternal(href);
              }}
            >
              {children}
            </a>
          ),
        }}
      >
        {source}
      </ReactMarkdown>
    </div>
  );
}
