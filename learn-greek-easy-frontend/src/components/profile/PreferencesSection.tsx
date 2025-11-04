import React, { useState, useRef } from 'react';

import { Globe, Bell, Clock, Palette, Check } from 'lucide-react';

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
          title: 'Preferences saved',
          description: 'Your learning preferences have been updated.',
        });
      } catch (error) {
        toast({
          title: 'Error',
          description: 'Failed to save preferences. Please try again.',
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
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-900">Learning Preferences</h2>
        <p className="text-sm text-gray-600">
          Customize your learning experience to match your goals
        </p>
      </div>

      <Separator className="mb-6" />

      <div className="space-y-6">
        {/* Language Preference */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Globe className="h-5 w-5 text-blue-600" />
              Interface Language
            </CardTitle>
            <CardDescription>Choose your preferred language for the app interface</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
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
                  <span className="font-medium text-gray-900">English</span>
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
                  <span className="font-medium text-gray-900">Ελληνικά</span>
                </div>
                {preferences.language === 'el' && <Check className="h-5 w-5 text-blue-600" />}
              </button>
            </div>
          </CardContent>
        </Card>

        {/* Daily Goal */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="h-5 w-5 text-green-600" />
              Daily Learning Goal
            </CardTitle>
            <CardDescription>Set your target study time per day (5-120 minutes)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="dailyGoal" className="text-base font-medium text-gray-900">
                {preferences.dailyGoal} minutes per day
              </Label>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                {preferences.dailyGoal < 15 && <span>Light</span>}
                {preferences.dailyGoal >= 15 && preferences.dailyGoal < 30 && <span>Moderate</span>}
                {preferences.dailyGoal >= 30 && preferences.dailyGoal < 60 && <span>Regular</span>}
                {preferences.dailyGoal >= 60 && <span>Intensive</span>}
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
            <p className="text-sm text-gray-600">
              We'll remind you to maintain your streak and help you reach your daily goal.
            </p>
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Bell className="h-5 w-5 text-purple-600" />
              Notifications
            </CardTitle>
            <CardDescription>
              Manage how we keep you updated on your learning progress
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between rounded-lg border border-gray-200 p-4">
              <div className="flex-1">
                <p className="font-medium text-gray-900">Push Notifications</p>
                <p className="text-sm text-gray-600">
                  Daily reminders, streak alerts, and achievement updates
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
                <span className="sr-only">Enable notifications</span>
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    preferences.notifications ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
            {preferences.notifications && (
              <div className="mt-4 rounded-lg bg-purple-50 p-4">
                <p className="text-sm font-medium text-purple-900">Notifications enabled! 🎉</p>
                <p className="mt-1 text-sm text-purple-700">
                  You'll receive daily reminders at your preferred time and alerts when you're about
                  to lose your streak.
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
              Theme Preference
              <span className="ml-auto rounded-full bg-gray-200 px-2 py-1 text-xs font-medium text-gray-700">
                Coming Soon
              </span>
            </CardTitle>
            <CardDescription>
              Switch between light and dark mode (available in a future update)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-3 opacity-50">
              <button
                disabled
                className="flex flex-col items-center gap-2 rounded-lg border-2 border-gray-200 p-4"
              >
                <div className="h-12 w-12 rounded-lg bg-white shadow-sm" />
                <span className="text-sm font-medium text-gray-700">Light</span>
              </button>
              <button
                disabled
                className="flex flex-col items-center gap-2 rounded-lg border-2 border-gray-200 p-4"
              >
                <div className="h-12 w-12 rounded-lg bg-gray-900 shadow-sm" />
                <span className="text-sm font-medium text-gray-700">Dark</span>
              </button>
              <button
                disabled
                className="flex flex-col items-center gap-2 rounded-lg border-2 border-gray-200 p-4"
              >
                <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-white to-gray-900 shadow-sm" />
                <span className="text-sm font-medium text-gray-700">Auto</span>
              </button>
            </div>
          </CardContent>
        </Card>

        {/* Save Status Indicator */}
        {isSaving && (
          <div className="flex items-center justify-center gap-2 text-sm text-gray-600">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600" />
            Saving preferences...
          </div>
        )}
      </div>
    </div>
  );
};
