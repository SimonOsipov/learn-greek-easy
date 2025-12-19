import React, { useState, useRef } from 'react';

import { Globe, Bell, Clock, Palette, Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { useAuthStore } from '@/stores/authStore';
import type { User } from '@/types/auth';

interface PreferencesSectionProps {
  user: User;
}

// Simple debounce function
function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

export const PreferencesSection: React.FC<PreferencesSectionProps> = ({ user }) => {
  const { t, i18n } = useTranslation('profile');
  const updateProfile = useAuthStore((state) => state.updateProfile);
  const { toast } = useToast();

  const [preferences, setPreferences] = useState(user.preferences);
  const [isSaving, setIsSaving] = useState(false);

  // Debounced save function
  const debouncedSaveRef = useRef(
    debounce(async (newPreferences: typeof preferences) => {
      setIsSaving(true);
      try {
        await updateProfile({ preferences: newPreferences });
        toast({
          title: t('preferences.success'),
          description: t('preferences.successDescription'),
        });
      } catch (error) {
        toast({
          title: t('preferences.error'),
          description: t('preferences.errorDescription'),
          variant: 'destructive',
        });
      } finally {
        setIsSaving(false);
      }
    }, 1000)
  );

  const handlePreferenceChange = (key: keyof typeof preferences, value: any) => {
    const newPreferences = { ...preferences, [key]: value };
    setPreferences(newPreferences);
    debouncedSaveRef.current(newPreferences);

    // Change app language when language preference changes
    if (key === 'language') {
      i18n.changeLanguage(value);
    }
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-900">{t('preferences.title')}</h2>
        <p className="text-sm text-gray-600">{t('preferences.subtitle')}</p>
      </div>

      <Separator className="mb-6" />

      <div className="space-y-6">
        {/* Language Preference */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Globe className="h-5 w-5 text-blue-600" />
              {t('preferences.language.title')}
            </CardTitle>
            <CardDescription>{t('preferences.language.description')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={() => handlePreferenceChange('language', 'en')}
                className={`flex items-center justify-between rounded-lg border-2 p-4 transition-all ${
                  preferences.language === 'en'
                    ? 'border-blue-600 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-2xl">🇬🇧</span>
                  <span className="font-medium text-gray-900">
                    {t('preferences.language.english')}
                  </span>
                </div>
                {preferences.language === 'en' && <Check className="h-5 w-5 text-blue-600" />}
              </button>
              <button
                onClick={() => handlePreferenceChange('language', 'el')}
                className={`flex items-center justify-between rounded-lg border-2 p-4 transition-all ${
                  preferences.language === 'el'
                    ? 'border-blue-600 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-2xl">🇬🇷</span>
                  <span className="font-medium text-gray-900">
                    {t('preferences.language.greek')}
                  </span>
                </div>
                {preferences.language === 'el' && <Check className="h-5 w-5 text-blue-600" />}
              </button>
              <button
                onClick={() => handlePreferenceChange('language', 'ru')}
                className={`flex items-center justify-between rounded-lg border-2 p-4 transition-all ${
                  preferences.language === 'ru'
                    ? 'border-blue-600 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-2xl">🇷🇺</span>
                  <span className="font-medium text-gray-900">
                    {t('preferences.language.russian')}
                  </span>
                </div>
                {preferences.language === 'ru' && <Check className="h-5 w-5 text-blue-600" />}
              </button>
            </div>
          </CardContent>
        </Card>

        {/* Daily Goal */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="h-5 w-5 text-green-600" />
              {t('preferences.dailyGoal.title')}
            </CardTitle>
            <CardDescription>{t('preferences.dailyGoal.description')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="dailyGoal" className="text-base font-medium text-gray-900">
                {t('preferences.dailyGoal.unit', { minutes: preferences.dailyGoal })}
              </Label>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                {preferences.dailyGoal < 15 && <span>{t('preferences.dailyGoal.light')}</span>}
                {preferences.dailyGoal >= 15 && preferences.dailyGoal < 30 && (
                  <span>{t('preferences.dailyGoal.moderate')}</span>
                )}
                {preferences.dailyGoal >= 30 && preferences.dailyGoal < 60 && (
                  <span>{t('preferences.dailyGoal.regular')}</span>
                )}
                {preferences.dailyGoal >= 60 && <span>{t('preferences.dailyGoal.intensive')}</span>}
              </div>
            </div>
            <div className="space-y-2">
              <input
                id="dailyGoal"
                type="range"
                min="5"
                max="120"
                step="5"
                value={preferences.dailyGoal}
                onChange={(e) => handlePreferenceChange('dailyGoal', Number(e.target.value))}
                className="w-full accent-green-600"
              />
              <div className="flex justify-between text-xs text-gray-500">
                <span>5 min</span>
                <span>30 min</span>
                <span>60 min</span>
                <span>120 min</span>
              </div>
            </div>
            <p className="text-sm text-gray-600">{t('preferences.dailyGoal.reminder')}</p>
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Bell className="h-5 w-5 text-purple-600" />
              {t('preferences.notifications.title')}
            </CardTitle>
            <CardDescription>{t('preferences.notifications.description')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between rounded-lg border border-gray-200 p-4">
              <div className="flex-1">
                <p className="font-medium text-gray-900">{t('preferences.notifications.push')}</p>
                <p className="text-sm text-gray-600">
                  {t('preferences.notifications.pushDescription')}
                </p>
              </div>
              <button
                onClick={() => handlePreferenceChange('notifications', !preferences.notifications)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 ${
                  preferences.notifications ? 'bg-purple-600' : 'bg-gray-300'
                }`}
                role="switch"
                aria-checked={preferences.notifications}
              >
                <span className="sr-only">
                  {t('preferences.notifications.enableNotifications')}
                </span>
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    preferences.notifications ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
            {preferences.notifications && (
              <div className="mt-4 rounded-lg bg-purple-50 p-4">
                <p className="text-sm font-medium text-purple-900">
                  {t('preferences.notifications.enabled')}
                </p>
                <p className="mt-1 text-sm text-purple-700">
                  {t('preferences.notifications.enabledDescription')}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Theme (Coming Soon) */}
        <Card className="opacity-60">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Palette className="h-5 w-5 text-gray-600" />
              {t('preferences.theme.title')}
              <span className="ml-auto rounded-full bg-gray-200 px-2 py-1 text-xs font-medium text-gray-700">
                {t('preferences.theme.comingSoon')}
              </span>
            </CardTitle>
            <CardDescription>{t('preferences.theme.description')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-3 opacity-50">
              <button
                disabled
                className="flex flex-col items-center gap-2 rounded-lg border-2 border-gray-200 p-4"
              >
                <div className="h-12 w-12 rounded-lg bg-white shadow-sm" />
                <span className="text-sm font-medium text-gray-700">
                  {t('preferences.theme.light')}
                </span>
              </button>
              <button
                disabled
                className="flex flex-col items-center gap-2 rounded-lg border-2 border-gray-200 p-4"
              >
                <div className="h-12 w-12 rounded-lg bg-gray-900 shadow-sm" />
                <span className="text-sm font-medium text-gray-700">
                  {t('preferences.theme.dark')}
                </span>
              </button>
              <button
                disabled
                className="flex flex-col items-center gap-2 rounded-lg border-2 border-gray-200 p-4"
              >
                <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-white to-gray-900 shadow-sm" />
                <span className="text-sm font-medium text-gray-700">
                  {t('preferences.theme.auto')}
                </span>
              </button>
            </div>
          </CardContent>
        </Card>

        {/* Save Status Indicator */}
        {isSaving && (
          <div className="flex items-center justify-center gap-2 text-sm text-gray-600">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600" />
            {t('preferences.saving')}
          </div>
        )}
      </div>
    </div>
  );
};
