import React from 'react';

import { LanguageSwitcher } from '@/components/i18n';

interface AuthLayoutProps {
  children: React.ReactNode;
}

export const AuthLayout: React.FC<AuthLayoutProps> = ({ children }) => {
  return (
    <div className="relative flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50 px-4 py-8">
      {/* Language Switcher - positioned in top-right corner */}
      <div className="absolute right-4 top-4">
        <LanguageSwitcher variant="icon" />
      </div>
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
};
