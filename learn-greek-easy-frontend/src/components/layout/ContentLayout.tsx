import React from 'react';

import { cn } from '@/lib/utils';

interface ContentLayoutProps {
  children: React.ReactNode;
  sidebar?: React.ReactNode;
  className?: string;
  sidebarClassName?: string;
}

export const ContentLayout: React.FC<ContentLayoutProps> = ({
  children,
  sidebar,
  className,
  sidebarClassName,
}) => {
  if (!sidebar) {
    return <div className={className}>{children}</div>;
  }

  return (
    <div
      className={cn(
        'grid gap-6',
        'grid-cols-1', // Mobile: single column
        'lg:grid-cols-[2fr_1fr]', // Desktop: 2/3 content, 1/3 sidebar
        className
      )}
    >
      {/* Main Content */}
      <div className="space-y-6">{children}</div>

      {/* Sidebar */}
      <div
        className={cn(
          'space-y-6',
          'order-first lg:order-last', // Sidebar on top for mobile, right for desktop
          sidebarClassName
        )}
      >
        {sidebar}
      </div>
    </div>
  );
};
