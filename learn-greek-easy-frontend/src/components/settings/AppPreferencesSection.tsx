import { useState, useEffect } from 'react';

import { Settings, Loader2 } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { toast } from '@/hooks/use-toast';
import { useAuthStore } from '@/stores/authStore';

/**
 * AppPreferencesSection Component
 *
 * Provides app preference management focused on daily study goal:
 * - Daily goal slider (5-100 cards, step 5)
 * - Auto-save with 1-second debounce
 * - Live value preview
 *
 * Integrates with authStore for persistence.
 */
export function AppPreferencesSection() {
  const { user, updateProfile } = useAuthStore();

  const [dailyGoal, setDailyGoal] = useState(user?.preferences?.dailyGoal || 20);
  const [isSaving, setIsSaving] = useState(false);

  // Auto-save with debounce
  useEffect(() => {
    // Don't save on initial mount or if value hasn't changed
    if (dailyGoal === user?.preferences?.dailyGoal) {
      return;
    }

    // Debounce: wait 1 second after last change
    const timer = setTimeout(async () => {
      setIsSaving(true);

      try {
        if (!user) return;

        await updateProfile({
          preferences: {
            ...user.preferences,
            dailyGoal,
          },
        });

        toast({
          title: 'Preferences saved',
          description: `Daily goal set to ${dailyGoal} cards per day`,
        });
      } catch (error) {
        toast({
          title: 'Failed to save preferences',
          description: error instanceof Error ? error.message : 'An error occurred',
          variant: 'destructive',
        });
      } finally {
        setIsSaving(false);
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [dailyGoal, user?.preferences, updateProfile]);

  if (!user) {
    return null; // Should not happen (Settings page requires auth)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>App Preferences</CardTitle>
        <CardDescription>Customize your learning experience</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Daily Goal Section */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Settings className="h-4 w-4 text-muted-foreground" />
            <h3 className="font-medium">Daily Study Goal</h3>
          </div>

          <div className="space-y-4 rounded-lg bg-muted/50 p-4">
            <div>
              <p className="mb-4 text-sm text-muted-foreground">
                Number of new cards to review each day
              </p>

              <Slider
                min={5}
                max={100}
                step={5}
                value={[dailyGoal]}
                onValueChange={(value) => setDailyGoal(value[0])}
                className="w-full"
                aria-label="Daily study goal slider"
              />
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Goal:</span>
              <div className="flex items-center gap-2">
                <span className="text-foreground text-lg font-semibold">
                  {dailyGoal} cards per day
                </span>
                {isSaving && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
