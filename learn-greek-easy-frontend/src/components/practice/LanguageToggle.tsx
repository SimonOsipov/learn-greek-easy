import React from 'react';

import { LanguageSelector } from '@/components/culture/LanguageSelector';
import { cn } from '@/lib/utils';
import type { CultureLanguage } from '@/types/culture';

export interface LanguageToggleProps {
  value: string;
  onChange: (language: string) => void;
  // TODO: Pass languages array to LanguageSelector once it supports filtering
  languages?: string[];
  variant?: 'buttons' | 'dropdown' | 'pill';
  size?: 'sm' | 'md';
  className?: string;
}

export const LanguageToggle: React.FC<LanguageToggleProps> = ({
  value,
  onChange,
  languages: _languages = ['el', 'en', 'ru'],
  variant = 'pill',
  size = 'sm',
  className,
}) => {
  return (
    <div className={cn('inline-flex', className)} data-testid="language-toggle">
      <LanguageSelector
        value={value as CultureLanguage}
        onChange={onChange as (lang: CultureLanguage) => void}
        variant={variant}
        size={size}
      />
    </div>
  );
};
