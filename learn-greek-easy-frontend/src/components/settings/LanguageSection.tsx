import React from 'react';

import { Globe } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useLanguage } from '@/contexts/LanguageContext';
import { type SupportedLanguage } from '@/i18n';

/**
 * LanguageSection Component
 *
 * A settings card for changing the application's interface language.
 * Uses a Select dropdown for a more form-like experience on the settings page.
 *
 * Features:
 * - Globe icon in card title
 * - Select dropdown showing all available languages
 * - Shows flag emoji + native name + English name
 * - Disabled state while language is changing
 * - Syncs with backend for authenticated users
 */
export const LanguageSection: React.FC = () => {
  const { t } = useTranslation('settings');
  const { currentLanguage, changeLanguage, isChanging, availableLanguages } = useLanguage();

  const handleChange = async (value: string) => {
    try {
      await changeLanguage(value as SupportedLanguage, 'settings');
    } catch (error) {
      console.error('[LanguageSection] Language change failed:', error);
    }
  };

  const currentLangOption = availableLanguages.find((opt) => opt.code === currentLanguage);

  return (
    <Card data-testid="language-settings-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe className="h-5 w-5 text-muted-foreground" />
          {t('language.title')}
        </CardTitle>
        <CardDescription>{t('language.description')}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <Select value={currentLanguage} onValueChange={handleChange} disabled={isChanging}>
            <SelectTrigger className="w-full sm:w-[280px]" data-testid="language-select-trigger">
              <SelectValue>
                {currentLangOption && (
                  <span className="flex items-center gap-2">
                    {currentLangOption.flag && (
                      <span className="text-base">{currentLangOption.flag}</span>
                    )}
                    <span>{currentLangOption.nativeName}</span>
                  </span>
                )}
              </SelectValue>
            </SelectTrigger>
            <SelectContent data-testid="language-select-content">
              {availableLanguages.map((option) => (
                <SelectItem
                  key={option.code}
                  value={option.code}
                  data-testid={`language-select-option-${option.code}`}
                >
                  <span className="flex items-center gap-2">
                    {option.flag && <span className="text-base">{option.flag}</span>}
                    <span>{option.nativeName}</span>
                    <span className="text-muted-foreground">({option.name})</span>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {isChanging && <p className="text-sm text-muted-foreground">{t('language.changing')}</p>}
        </div>
      </CardContent>
    </Card>
  );
};

LanguageSection.displayName = 'LanguageSection';
