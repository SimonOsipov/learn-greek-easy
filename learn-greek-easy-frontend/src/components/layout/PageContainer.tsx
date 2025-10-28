import React from 'react';

import { cn } from '@/lib/utils';

interface PageContainerProps {
  children: React.ReactNode;
  className?: string;
}

export const PageContainer: React.FC<PageContainerProps> = ({ children, className }) => {
  return <div className={cn('mx-auto w-full max-w-[1440px] px-4', className)}>{children}</div>;
};
