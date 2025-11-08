import React from 'react';

import { DeckCard } from '@/components/display/DeckCard';
import { MetricCard } from '@/components/display/MetricCard';
import { WelcomeSection } from '@/components/display/WelcomeSection';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import type { DashboardData } from '@/types/dashboard';

// Sample data with Greek content for authenticity
const mockDashboardData: DashboardData = {
  user: {
    name: 'Alex',
    email: 'alex@example.com',
    streak: 12,
    totalWords: 186,
    lastActivity: new Date('2025-10-28T10:00:00'),
  },
  metrics: [
    {
      id: '1',
      label: 'Due Today',
      value: 24,
      sublabel: 'cards to review',
      color: 'primary',
      icon: '📚',
      trend: { value: 5, direction: 'up' },
    },
    {
      id: '2',
      label: 'Current Streak',
      value: 12,
      sublabel: 'days',
      color: 'orange',
      icon: '🔥',
    },
    {
      id: '3',
      label: 'Mastered',
      value: 186,
      sublabel: 'words total',
      color: 'green',
      icon: '✅',
    },
    {
      id: '4',
      label: 'Accuracy',
      value: '92%',
      sublabel: 'last 7 days',
      color: 'blue',
      icon: '🎯',
    },
    {
      id: '5',
      label: 'Total Time',
      value: '4.5h',
      sublabel: 'this week',
      color: 'muted',
      icon: '⏱️',
    },
  ],
  decks: [
    {
      id: '1',
      title: 'A1 Βασικές Λέξεις', // A1 Essential Words in Greek
      description: 'Basic vocabulary for everyday communication',
      status: 'in-progress',
      level: 'A1',
      progress: { current: 68, total: 100, percentage: 68 },
      stats: { due: 12, mastered: 68, learning: 20 },
      lastStudied: new Date('2025-10-28T09:00:00'),
    },
    {
      id: '2',
      title: 'Αριθμοί & Χρόνος', // Numbers & Time in Greek
      description: 'Numbers, dates, time expressions',
      status: 'in-progress',
      level: 'A1',
      progress: { current: 45, total: 75, percentage: 60 },
      stats: { due: 8, mastered: 45, learning: 15 },
      lastStudied: new Date('2025-10-27T14:00:00'),
    },
    {
      id: '3',
      title: 'Οικογένεια & Σχέσεις', // Family & Relationships in Greek
      description: 'Family members, relationships, and social terms',
      status: 'not-started',
      level: 'A2',
      progress: { current: 0, total: 80, percentage: 0 },
      stats: { due: 0, mastered: 0, learning: 0 },
    },
  ],
  upcomingReviews: {
    today: 24,
    tomorrow: 18,
    week: 96,
  },
};

export const Dashboard: React.FC = () => {
  const { user, metrics, decks } = mockDashboardData;

  const handleStartReview = () => {
    console.log('Starting review session...');
    // This would navigate to review page
  };

  const handleContinueDeck = (deckId: string) => {
    console.log(`Continuing deck: ${deckId}`);
    // This would navigate to deck study page
  };

  return (
    <div className="space-y-6 pb-8">
      {/* Welcome Section */}
      <WelcomeSection
        userName={user.name}
        dueCount={metrics[0].value as number}
        streak={user.streak}
        onStartReview={handleStartReview}
      />

      {/* Metrics Grid */}
      <section>
        <h2 className="mb-4 text-lg font-semibold text-text-primary">Your Progress</h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
          {metrics.map((metric) => (
            <MetricCard
              key={metric.id}
              {...metric}
              tooltip={`Click to view ${metric.label.toLowerCase()} details`}
              onClick={() => console.log(`Clicked metric: ${metric.label}`)}
            />
          ))}
        </div>
      </section>

      <Separator className="my-6" />

      {/* Active Decks Section */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-text-primary">Active Decks</h2>
          <button className="text-sm text-primary hover:underline">View all decks →</button>
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {decks.slice(0, 2).map((deck) => (
            <DeckCard key={deck.id} deck={deck} onContinue={() => handleContinueDeck(deck.id)} />
          ))}
        </div>
      </section>

      <Separator className="my-6" />

      {/* Configuration Test Section */}
      <section>
        <Card>
          <CardHeader>
            <CardTitle>Setup Verification ✅</CardTitle>
            <CardDescription>All configurations are working correctly</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Typography Test */}
            <div className="space-y-2">
              <h3 className="font-semibold text-text-primary">Typography Scale</h3>
              <div className="space-y-1">
                <p className="text-3xl font-bold">Heading 1 (3xl)</p>
                <p className="text-2xl font-semibold">Heading 2 (2xl)</p>
                <p className="text-xl font-medium">Heading 3 (xl)</p>
                <p className="text-lg">Large text (lg)</p>
                <p className="text-base">Base text size</p>
                <p className="text-sm text-text-muted">Small text (sm)</p>
                <p className="text-xs text-text-subtle">Extra small text (xs)</p>
              </div>
            </div>

            <Separator />

            {/* Color Test */}
            <div className="space-y-2">
              <h3 className="font-semibold text-text-primary">Color Palette</h3>
              <div className="flex flex-wrap gap-2">
                <div className="flex h-20 w-20 items-center justify-center rounded-lg bg-primary text-xs text-white">
                  Primary
                </div>
                <div className="flex h-20 w-20 items-center justify-center rounded-lg bg-gradient-to-br from-[#667eea] to-[#764ba2] text-xs text-white">
                  Gradient
                </div>
                <div className="flex h-20 w-20 items-center justify-center rounded-lg bg-success text-xs text-white">
                  Success
                </div>
                <div className="flex h-20 w-20 items-center justify-center rounded-lg bg-warning text-xs text-white">
                  Warning
                </div>
                <div className="flex h-20 w-20 items-center justify-center rounded-lg bg-info text-xs text-white">
                  Info
                </div>
              </div>
            </div>

            <Separator />

            {/* Greek Text Rendering */}
            <div className="space-y-2">
              <h3 className="font-semibold text-text-primary">Greek Text Support</h3>
              <div className="space-y-1">
                <p className="text-lg">Γεια σου! (Hello!)</p>
                <p>Καλημέρα - Good morning</p>
                <p>Ευχαριστώ - Thank you</p>
                <p>Παρακαλώ - Please/You're welcome</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
};
