import type { Notification } from '@/types';

export const mockNotifications: Notification[] = [
  {
    id: '1',
    type: 'streak_milestone',
    title: '7-Day Streak!',
    message: 'You have maintained your study streak for 7 consecutive days!',
    timestamp: new Date(Date.now() - 1000 * 60 * 30), // 30 min ago
    read: false,
  },
  {
    id: '2',
    type: 'cards_due',
    title: '15 Cards Due',
    message: 'You have cards ready for review in A1 Basics',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2), // 2 hours ago
    read: false,
    href: '/decks',
  },
  {
    id: '3',
    type: 'deck_completed',
    title: 'Deck Mastered!',
    message: 'Congratulations! You mastered all cards in A2 Vocabulary',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24), // 1 day ago
    read: true,
  },
  {
    id: '4',
    type: 'achievement',
    title: '100 Cards Reviewed',
    message: 'You have reviewed 100 flashcards this week!',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 48), // 2 days ago
    read: true,
  },
  {
    id: '5',
    type: 'system',
    title: 'New Feature Available',
    message: 'Check out the new Statistics page for detailed analytics!',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 72), // 3 days ago
    read: true,
    href: '/statistics',
  },
];
