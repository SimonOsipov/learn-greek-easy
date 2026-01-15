import React from 'react';

import { LanguageSwitcher } from '@/components/i18n';
import { ThemeSwitcher } from '@/components/theme';

interface AuthLayoutProps {
  children: React.ReactNode;
}

export const AuthLayout: React.FC<AuthLayoutProps> = ({ children }) => {
  return (
    <div className="relative flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50 px-4 py-8 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800">
      {/* Theme and Language Switchers - positioned in top-right corner */}
      <div className="absolute right-4 top-4 flex items-center gap-2">
        <ThemeSwitcher />
        <LanguageSwitcher variant="icon" />
      </div>
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
};
