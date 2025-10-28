import React from 'react';

import { Button } from '@/components/ui/button';

interface WelcomeSectionProps {
  userName: string;
  dueCount: number;
  streak: number;
  onStartReview?: () => void;
}

export const WelcomeSection: React.FC<WelcomeSectionProps> = ({
  userName,
  dueCount,
  streak,
  onStartReview,
}) => {
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Καλημέρα'; // Good morning in Greek
    if (hour < 18) return 'Καλό απόγευμα'; // Good afternoon in Greek
    return 'Καλησπέρα'; // Good evening in Greek
  };

  const getEncouragement = () => {
    if (streak > 7) return `Incredible ${streak}-day streak! 🔥`;
    if (streak > 3) return `Great ${streak}-day streak going!`;
    if (streak > 0) return `${streak} day streak - keep it up!`;
    return 'Ready to start learning?';
  };

  return (
    <div className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between">
      <div>
        <h1 className="mb-2 text-2xl font-semibold text-text-primary md:text-3xl">
          {getGreeting()}, {userName}! 👋
        </h1>
        <p className="text-text-muted">
          You have <span className="font-semibold text-primary">{dueCount} cards</span> to review
          today. {getEncouragement()}
        </p>
      </div>
      <Button
        size="lg"
        className="mt-4 bg-gradient-to-br from-[#667eea] to-[#764ba2] transition-all hover:shadow-lg md:mt-0"
        onClick={onStartReview}
      >
        Start Review Session
      </Button>
    </div>
  );
};
