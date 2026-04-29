import React from 'react';

import { cn } from '@/lib/utils';

interface PageContainerProps {
  children: React.ReactNode;
  className?: string;
}

export const PageContainer: React.FC<PageContainerProps> = ({ children, className }) => {
  return <div className={cn('mx-auto w-full max-w-screen-2xl px-4', className)}>{children}</div>;
};
