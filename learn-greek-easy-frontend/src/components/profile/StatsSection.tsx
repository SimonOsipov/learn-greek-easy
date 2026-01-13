import React from 'react';

import { Flame, BookOpen, Trophy, Calendar, Clock, TrendingUp, Award, Star } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import type { UserStats } from '@/types/auth';

interface StatsSectionProps {
  stats: UserStats;
}

export const StatsSection: React.FC<StatsSectionProps> = ({ stats }) => {
  // Calculate level from XP (1000 XP per level)
  const level = Math.floor(stats.totalXP / 1000) || 1;
  const currentLevelXP = stats.totalXP % 1000;
  const nextLevelXP = 1000;
  const progressPercent = (currentLevelXP / nextLevelXP) * 100;

  // Motivational messages based on streak
  const getStreakMessage = (streak: number): string => {
    if (streak >= 30) return "Incredible! You're on fire! 🔥";
    if (streak >= 14) return 'Amazing streak! Keep it up! 💪';
    if (streak >= 7) return 'Great job! One week strong! 🌟';
    if (streak >= 3) return 'Nice start! Keep going! 👍';
    return 'Start your learning streak today! 🚀';
  };

  // Format date for display
  const formatDate = (date: Date): string => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  // Calculate days since joining
  const daysSinceJoining = Math.floor(
    (new Date().getTime() - new Date(stats.joinedDate).getTime()) / (1000 * 60 * 60 * 24)
  );

  // Calculate average words per day
  const avgWordsPerDay =
    daysSinceJoining > 0 ? Math.round(stats.wordsLearned / daysSinceJoining) : 0;

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-foreground">Learning Statistics</h2>
        <p className="text-sm text-muted-foreground">
          Track your progress and celebrate your achievements
        </p>
      </div>

      <Separator className="mb-6" />

      {/* Main Stats Grid */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* Streak Card */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Current Streak
              </CardTitle>
              <Flame className="h-5 w-5 text-orange-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">
              {stats.streak}
              <span className="ml-1 text-lg font-normal text-muted-foreground">
                {stats.streak === 1 ? 'day' : 'days'}
              </span>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">{getStreakMessage(stats.streak)}</p>
          </CardContent>
        </Card>

        {/* Words Learned Card */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Words Learned
              </CardTitle>
              <BookOpen className="h-5 w-5 text-blue-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">
              {stats.wordsLearned.toLocaleString()}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              ~{avgWordsPerDay} words per day average
            </p>
          </CardContent>
        </Card>

        {/* Total XP Card */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total XP</CardTitle>
              <Trophy className="h-5 w-5 text-yellow-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">
              {stats.totalXP.toLocaleString()}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Level {level} • {Math.round(progressPercent)}% to next level
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Level Progress Section */}
      <Card className="mb-8">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Star className="h-5 w-5 text-yellow-500" />
                Level {level}
              </CardTitle>
              <CardDescription>
                {currentLevelXP.toLocaleString()} / {nextLevelXP.toLocaleString()} XP
              </CardDescription>
            </div>
            <Badge variant="secondary" className="text-lg">
              {nextLevelXP - currentLevelXP} XP to Level {level + 1}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <Progress value={progressPercent} className="h-3" />
          <p className="mt-3 text-sm text-muted-foreground">
            Keep learning to earn more XP and level up! Each lesson, quiz, and review session
            contributes to your progress.
          </p>
        </CardContent>
      </Card>

      {/* Activity Timeline */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-muted-foreground" />
            Activity Timeline
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
              <Calendar className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <div className="flex-1">
              <p className="font-medium text-foreground">Joined Learn Greek Easy</p>
              <p className="text-sm text-muted-foreground">{formatDate(stats.joinedDate)}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {daysSinceJoining} {daysSinceJoining === 1 ? 'day' : 'days'} ago
              </p>
            </div>
          </div>

          {stats.lastActivity && (
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30">
                <TrendingUp className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-foreground">Last Active</p>
                <p className="text-sm text-muted-foreground">{formatDate(stats.lastActivity)}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {Math.floor(
                    (new Date().getTime() - new Date(stats.lastActivity).getTime()) /
                      (1000 * 60 * 60 * 24)
                  )}{' '}
                  days ago
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Achievements Section (Placeholder) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="h-5 w-5 text-purple-600" />
            Achievements
          </CardTitle>
          <CardDescription>
            Unlock badges by completing challenges and reaching milestones
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {/* Achievement Badges - Placeholders */}
            {[
              { name: 'First Steps', icon: '👣', unlocked: stats.wordsLearned >= 10 },
              { name: 'Week Warrior', icon: '⚔️', unlocked: stats.streak >= 7 },
              { name: 'Century Club', icon: '💯', unlocked: stats.wordsLearned >= 100 },
              { name: 'Fire Keeper', icon: '🔥', unlocked: stats.streak >= 30 },
            ].map((achievement, index) => (
              <div
                key={index}
                className={`flex flex-col items-center rounded-lg border-2 p-4 text-center transition-all ${
                  achievement.unlocked
                    ? 'border-purple-300 bg-purple-50 dark:border-purple-700 dark:bg-purple-900/20'
                    : 'border-border bg-muted/50 opacity-60'
                }`}
              >
                <div className="mb-2 text-3xl">{achievement.icon}</div>
                <p className="text-xs font-medium text-foreground">{achievement.name}</p>
                {achievement.unlocked ? (
                  <Badge
                    variant="secondary"
                    className="mt-2 bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300"
                  >
                    Unlocked
                  </Badge>
                ) : (
                  <Badge variant="outline" className="mt-2 text-muted-foreground">
                    Locked
                  </Badge>
                )}
              </div>
            ))}
          </div>
          <p className="mt-6 text-center text-sm text-muted-foreground">
            More achievements coming soon! Keep learning to unlock special badges.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};
