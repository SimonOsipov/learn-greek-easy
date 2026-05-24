// src/components/admin/Thread.tsx
//
// Compound component for displaying message threads in admin drawers.
// Designed for single-message compact use (CER-27 Card Errors Review tab)
// and is future-proof for multi-message timelines without API change.
//
// Uses admin-thread* CSS class prefix — no fb-* legacy prefix.

import * as React from 'react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

// ── Helpers ────────────────────────────────────────────────────────────────────

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

function formatRelative(ts: string | Date): string {
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

// ── Types ──────────────────────────────────────────────────────────────────────

type ThreadProps = {
  /** Collapse inter-message gap (single-message drawer cards). */
  compact?: boolean;
  children: React.ReactNode;
};

type ThreadMessageProps = {
  author: { name: string; avatarUrl?: string };
  /** ISO string or Date object. */
  timestamp: string | Date;
  /** Body slot — supports any ReactNode. */
  children: React.ReactNode;
};

// ── Message sub-component ──────────────────────────────────────────────────────

function ThreadMessage({ author, timestamp, children }: ThreadMessageProps) {
  return (
    <div className="admin-thread-msg">
      <Avatar className="size-7">
        {author.avatarUrl ? <AvatarImage src={author.avatarUrl} alt={author.name} /> : null}
        <AvatarFallback>{initials(author.name)}</AvatarFallback>
      </Avatar>
      <div className="admin-thread-meta">
        <span className="font-medium">{author.name}</span>
        <span className="text-muted-foreground">· {formatRelative(timestamp)}</span>
      </div>
      <div className="admin-thread-text">{children}</div>
    </div>
  );
}

// ── Root component ─────────────────────────────────────────────────────────────

function ThreadRoot({ compact, children }: ThreadProps) {
  return <div className={cn('admin-thread', compact && 'admin-thread-compact')}>{children}</div>;
}

// ── Compound export ────────────────────────────────────────────────────────────

export const Thread = Object.assign(ThreadRoot, { Message: ThreadMessage });
