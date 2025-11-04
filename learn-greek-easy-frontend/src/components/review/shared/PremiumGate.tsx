import React from 'react';

interface PremiumGateProps {
  isLocked: boolean;
  badgeText?: string;
  children: React.ReactNode;
}

export function PremiumGate({
  isLocked,
  badgeText = 'Pro',
  children,
}: PremiumGateProps) {
  if (!isLocked) {
    return <>{children}</>;
  }

  return (
    <div className="relative">
      <div className="filter blur-sm select-none pointer-events-none">{children}</div>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="bg-amber-400 text-gray-900 text-sm font-bold px-4 py-2 rounded-xl shadow-lg uppercase tracking-wider">
          {badgeText}
        </span>
      </div>
    </div>
  );
}
