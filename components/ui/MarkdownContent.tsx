'use client';

import type { ComponentPropsWithoutRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';

type MarkdownContentProps = {
  content: string;
  className?: string;
  /** Clip height for card previews (renders full markdown, hides overflow). */
  compact?: boolean;
};

const baseText = 'text-[var(--neutral-sub-600)]';

const markdownComponents = {
  p: ({ className, ...props }: ComponentPropsWithoutRef<'p'>) => (
    <p className={cn('mb-3 last:mb-0 leading-[1.65]', baseText, className)} {...props} />
  ),
  h1: ({ className, ...props }: ComponentPropsWithoutRef<'h1'>) => (
    <h1
      className={cn(
        'mb-3 mt-5 first:mt-0 text-[17px] font-semibold tracking-[-0.02em] text-[var(--neutral-strong-950)]',
        className,
      )}
      {...props}
    />
  ),
  h2: ({ className, ...props }: ComponentPropsWithoutRef<'h2'>) => (
    <h2
      className={cn(
        'mb-2.5 mt-4 first:mt-0 text-[15px] font-semibold tracking-[-0.015em] text-[var(--neutral-strong-950)]',
        className,
      )}
      {...props}
    />
  ),
  h3: ({ className, ...props }: ComponentPropsWithoutRef<'h3'>) => (
    <h3
      className={cn(
        'mb-2 mt-3.5 first:mt-0 text-[14px] font-semibold text-[var(--neutral-strong-950)]',
        className,
      )}
      {...props}
    />
  ),
  ul: ({ className, ...props }: ComponentPropsWithoutRef<'ul'>) => (
    <ul
      className={cn('mb-3 list-disc space-y-1 pl-5 last:mb-0 leading-[1.65]', baseText, className)}
      {...props}
    />
  ),
  ol: ({ className, ...props }: ComponentPropsWithoutRef<'ol'>) => (
    <ol
      className={cn('mb-3 list-decimal space-y-1 pl-5 last:mb-0 leading-[1.65]', baseText, className)}
      {...props}
    />
  ),
  li: ({ className, ...props }: ComponentPropsWithoutRef<'li'>) => (
    <li className={cn('pl-0.5', className)} {...props} />
  ),
  blockquote: ({ className, ...props }: ComponentPropsWithoutRef<'blockquote'>) => (
    <blockquote
      className={cn(
        'mb-3 border-l-2 border-[var(--primary-base)]/35 pl-3 italic last:mb-0 leading-[1.65]',
        baseText,
        className,
      )}
      {...props}
    />
  ),
  a: ({ className, ...props }: ComponentPropsWithoutRef<'a'>) => (
    <a
      className={cn(
        'font-medium text-[var(--primary-base)] underline decoration-[var(--primary-base)]/30 underline-offset-2 hover:decoration-[var(--primary-base)]',
        className,
      )}
      target="_blank"
      rel="noopener noreferrer"
      {...props}
    />
  ),
  code: ({ className, ...props }: ComponentPropsWithoutRef<'code'>) => (
    <code
      className={cn(
        'rounded-[4px] bg-[var(--neutral-weak-50)] px-1 py-0.5 text-[12px] text-[var(--neutral-strong-950)]',
        '[font-family:var(--font-geist-mono),ui-monospace,monospace]',
        className,
      )}
      {...props}
    />
  ),
  pre: ({ className, ...props }: ComponentPropsWithoutRef<'pre'>) => (
    <pre
      className={cn(
        'mb-3 overflow-x-auto rounded-[8px] border border-[var(--stroke-soft-200)] bg-[var(--neutral-weak-50)] px-3 py-2.5 last:mb-0',
        'text-[12px] leading-[1.55] text-[var(--neutral-strong-950)]',
        '[font-family:var(--font-geist-mono),ui-monospace,monospace]',
        className,
      )}
      {...props}
    />
  ),
  hr: ({ className, ...props }: ComponentPropsWithoutRef<'hr'>) => (
    <hr className={cn('my-4 border-[var(--stroke-soft-200)]', className)} {...props} />
  ),
  table: ({ className, ...props }: ComponentPropsWithoutRef<'table'>) => (
    <div className="mb-3 last:mb-0 overflow-x-auto">
      <table
        className={cn(
          'w-full min-w-[280px] border-collapse text-left text-[12.5px]',
          baseText,
          className,
        )}
        {...props}
      />
    </div>
  ),
  th: ({ className, ...props }: ComponentPropsWithoutRef<'th'>) => (
    <th
      className={cn(
        'border border-[var(--stroke-soft-200)] bg-[var(--neutral-weak-50)] px-2.5 py-1.5 font-semibold text-[var(--neutral-strong-950)]',
        className,
      )}
      {...props}
    />
  ),
  td: ({ className, ...props }: ComponentPropsWithoutRef<'td'>) => (
    <td
      className={cn('border border-[var(--stroke-soft-200)] px-2.5 py-1.5', className)}
      {...props}
    />
  ),
  strong: ({ className, ...props }: ComponentPropsWithoutRef<'strong'>) => (
    <strong className={cn('font-semibold text-[var(--neutral-strong-950)]', className)} {...props} />
  ),
  em: ({ className, ...props }: ComponentPropsWithoutRef<'em'>) => (
    <em className={cn('italic', className)} {...props} />
  ),
};

export function MarkdownContent({ content, className, compact }: MarkdownContentProps) {
  return (
    <div
      className={cn(
        'markdown-content',
        compact && 'max-h-[6.4em] overflow-hidden',
        className,
      )}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
