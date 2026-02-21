import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

interface TerminalProps {
  lines: string[];
  className?: string;
  maxHeight?: string;
  title?: string;
}

export function Terminal({
  lines,
  className,
  maxHeight = '400px',
  title,
}: TerminalProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new content
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [lines]);

  return (
    <div
      className={cn(
        'rounded-lg border border-border bg-zinc-950 text-zinc-100 overflow-hidden',
        className,
      )}
    >
      {/* Title bar */}
      {title && (
        <div className="flex items-center border-b border-zinc-800 bg-zinc-900 px-4 py-2">
          <div className="flex space-x-2">
            <div className="h-3 w-3 rounded-full bg-red-500" />
            <div className="h-3 w-3 rounded-full bg-yellow-500" />
            <div className="h-3 w-3 rounded-full bg-green-500" />
          </div>
          <span className="ml-4 text-xs text-zinc-400">{title}</span>
        </div>
      )}

      {/* Content */}
      <div
        ref={scrollRef}
        className="overflow-y-auto p-4 font-mono text-sm scrollbar-thin"
        style={{ maxHeight }}
      >
        {lines.length === 0 ? (
          <span className="text-zinc-500">No output</span>
        ) : (
          lines.map((line, index) => (
            <div key={index} className="whitespace-pre-wrap leading-relaxed">
              {line}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
