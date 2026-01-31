import { cn } from '@/lib/utils';

export interface SectionHeaderProps {
  /** The title text to display */
  title: string;
  /** Optional additional CSS classes */
  className?: string;
}

export function SectionHeader({ title, className }: SectionHeaderProps) {
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <span className="text-sm font-medium text-muted-foreground">{title}</span>
      <div className="h-px flex-1 bg-border" />
    </div>
  );
}
