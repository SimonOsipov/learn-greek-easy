// src/components/admin/InlineEditableText.tsx

import React, { useRef, useState } from 'react';

import { Pencil } from 'lucide-react';

import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface InlineEditableTextProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  'data-testid'?: string;
}

export const InlineEditableText: React.FC<InlineEditableTextProps> = ({
  value,
  onChange,
  placeholder,
  className,
  'data-testid': dataTestId,
}) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const originalRef = useRef(value);

  const startEditing = () => {
    originalRef.current = value;
    setDraft(value);
    setEditing(true);
  };

  const commit = () => {
    onChange(draft);
    setEditing(false);
  };

  const revert = () => {
    setDraft(originalRef.current);
    setEditing(false);
  };

  if (editing) {
    return (
      <Input
        data-testid={dataTestId}
        value={draft}
        autoFocus
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            commit();
          } else if (e.key === 'Escape') {
            revert();
          }
        }}
        className={cn('h-7 text-xs', className)}
      />
    );
  }

  return (
    <span
      data-testid={dataTestId}
      className={cn('group flex cursor-pointer items-center gap-1', className)}
      onClick={startEditing}
    >
      {value ? <span>{value}</span> : <span className="text-muted-foreground">{placeholder}</span>}
      <Pencil className="h-3 w-3 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
    </span>
  );
};
