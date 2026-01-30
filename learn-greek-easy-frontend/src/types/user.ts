// User type definitions

export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  initials: string;
  createdAt: Date;
  lastLogin?: Date;
}

export interface UserProfile extends User {
  settings: UserSettings;
  subscription?: Subscription;
}

export interface UserSettings {
  language: 'en' | 'ru';
  dailyGoal: number;
  notificationsEnabled: boolean;
  soundEnabled: boolean;
  theme?: 'light' | 'dark' | 'system';
}

export interface Subscription {
  plan: 'free' | 'premium';
  expiresAt?: Date;
  status: 'active' | 'expired' | 'cancelled';
}
