import * as React from 'react';

import { cn } from '@/lib/utils';

interface ScrollableTableProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function ScrollableTable({ className, children, ...props }: ScrollableTableProps) {
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = React.useState(false);
  const [canScrollRight, setCanScrollRight] = React.useState(false);

  const checkScroll = React.useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setCanScrollLeft(scrollLeft > 0);
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 1);
  }, []);

  React.useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    checkScroll();
    el.addEventListener('scroll', checkScroll);
    const resizeObserver = new ResizeObserver(checkScroll);
    resizeObserver.observe(el);

    return () => {
      el.removeEventListener('scroll', checkScroll);
      resizeObserver.disconnect();
    };
  }, [checkScroll]);

  return (
    <div className={cn('relative', className)} {...props}>
      {/* Left fade indicator */}
      <div
        className={cn(
          'pointer-events-none absolute inset-y-0 left-0 z-10 w-4 bg-gradient-to-r from-background to-transparent transition-opacity duration-200',
          canScrollLeft ? 'opacity-100' : 'opacity-0'
        )}
        aria-hidden="true"
      />
      {/* Scrollable container */}
      <div ref={scrollRef} className="overflow-x-auto">
        {children}
      </div>
      {/* Right fade indicator */}
      <div
        className={cn(
          'pointer-events-none absolute inset-y-0 right-0 z-10 w-4 bg-gradient-to-l from-background to-transparent transition-opacity duration-200',
          canScrollRight ? 'opacity-100' : 'opacity-0'
        )}
        aria-hidden="true"
      />
    </div>
  );
}
