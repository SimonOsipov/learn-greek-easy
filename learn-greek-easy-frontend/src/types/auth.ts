// User role types
export type UserRole = 'free' | 'premium' | 'admin';

// User preferences
export interface UserPreferences {
  language: 'en' | 'el' | 'ru';
  dailyGoal: number; // minutes
  notifications: boolean;
  theme?: 'light' | 'dark';
}

// User statistics
export interface UserStats {
  streak: number;
  wordsLearned: number;
  totalXP: number;
  lastActivity?: Date;
  joinedDate: Date;
}

// Main User interface
export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  role: UserRole;
  preferences: UserPreferences;
  stats: UserStats;
  createdAt: Date;
  updatedAt: Date;
}

// Registration data
export interface RegisterData {
  name: string;
  email: string;
  password: string;
  agreeToTerms: boolean;
  ageConfirmation: boolean;
}

// Login response
export interface AuthResponse {
  user: User;
  token: string;
  refreshToken?: string;
  expiresAt: Date;
}

// Auth error types
export interface AuthError {
  code: string;
  message: string;
  field?: string;
}

// Location state for route redirects
export interface LocationState {
  from?: string;
  requiredRole?: UserRole;
}
