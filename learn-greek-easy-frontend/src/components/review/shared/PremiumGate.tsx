import React from 'react';

interface PremiumGateProps {
  isLocked: boolean;
  badgeText?: string;
  children: React.ReactNode;
}

export function PremiumGate({ isLocked, badgeText = 'Pro', children }: PremiumGateProps) {
  if (!isLocked) {
    return <>{children}</>;
  }

  return (
    <div className="relative">
      <div className="pointer-events-none select-none blur-sm filter">{children}</div>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="rounded-xl bg-amber-400 px-4 py-2 text-sm font-bold uppercase tracking-wider text-gray-900 shadow-lg">
          {badgeText}
        </span>
      </div>
    </div>
  );
}
