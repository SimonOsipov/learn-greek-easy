import type { User, RegisterData, AuthResponse, AuthError } from '@/types/auth';

import { mockUsers } from './mockData';

/**
 * Mock Authentication API for Development & Testing
 *
 * TEST MODE BEHAVIOR:
 * - When window.playwright is true or NODE_ENV is 'test', the API accepts
 *   properly formatted mock tokens without requiring them to be pre-registered.
 * - This allows E2E tests to use addInitScript() to inject auth state.
 * - Production builds never trigger test mode (window.playwright is undefined).
 *
 * PRODUCTION BEHAVIOR:
 * - This entire file is excluded from production builds via Vite tree-shaking.
 * - Production uses real backend API instead.
 */

declare global {
  interface Window {
    playwright?: boolean;
  }
}

class MockAuthAPI {
  private users = [...mockUsers];
  private tokens = new Map<string, { userId: string; expiresAt: Date }>();

  // Simulate network delay
  private async delay(ms: number = 1000): Promise<void> {
    // Skip delays in test mode for faster test execution
    if (this.isTestMode()) {
      return Promise.resolve();
    }
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Check if running in test mode (Playwright E2E tests)
   */
  private isTestMode(): boolean {
    return (
      typeof window !== 'undefined' &&
      (window.playwright === true ||
        process.env.NODE_ENV === 'test' ||
        import.meta.env.VITE_TEST_MODE === 'true')
    );
  }

  // Generate mock JWT token
  private generateToken(userId: string): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2);
    return `mock.${btoa(userId)}.${timestamp}.${random}`;
  }

  // Generate refresh token
  private generateRefreshToken(userId: string): string {
    return `refresh.${this.generateToken(userId)}`;
  }

  // Login method
  async login(email: string, password: string): Promise<AuthResponse> {
    await this.delay(1000);

    const user = this.users.find(
      (u) => u.email.toLowerCase() === email.toLowerCase() && u.password === password
    );

    if (!user) {
      throw {
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password',
      } as AuthError;
    }

    const token = this.generateToken(user.id);
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

    // Store token for validation
    this.tokens.set(token, { userId: user.id, expiresAt });

    // Return user without password
    const { password: _, ...userWithoutPassword } = user;

    return {
      user: userWithoutPassword as User,
      token,
      refreshToken: this.generateRefreshToken(user.id),
      expiresAt,
    };
  }

  // Register method
  async register(data: RegisterData): Promise<AuthResponse> {
    await this.delay(1500);

    // Check for duplicate email
    if (this.users.some((u) => u.email.toLowerCase() === data.email.toLowerCase())) {
      throw {
        code: 'EMAIL_EXISTS',
        message: 'An account with this email already exists',
        field: 'email',
      } as AuthError;
    }

    // Create new user with truly unique ID (timestamp + random suffix)
    const newUser: User & { password: string } = {
      id: `user-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
      email: data.email,
      password: data.password,
      name: data.name,
      role: 'free',
      avatar: undefined,
      preferences: {
        language: 'en',
        dailyGoal: 10,
        notifications: true,
      },
      stats: {
        streak: 0,
        wordsLearned: 0,
        totalXP: 0,
        joinedDate: new Date(),
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.users.push(newUser);

    // Auto-login after registration
    return this.login(data.email, data.password);
  }

  // Verify token
  async verifyToken(token: string): Promise<User | null> {
    await this.delay(500);

    // In test mode, trust properly formatted mock tokens
    if (this.isTestMode()) {
      try {
        // Token format: mock.{base64(userId)}.{timestamp}.{random}
        const parts = token.split('.');
        if (parts.length >= 4 && parts[0] === 'mock') {
          // Decode userId from token
          const userId = atob(parts[1]);
          const user = this.users.find((u) => u.id === userId);

          if (user) {
            const { password: _, ...userWithoutPassword } = user;
            return userWithoutPassword as User;
          }
        }
      } catch (e) {
        console.warn('[MockAuthAPI] Failed to verify test token:', e);
        // Fall through to normal validation
      }
    }

    // Normal token validation (existing code)
    const tokenData = this.tokens.get(token);
    if (!tokenData) {
      return null;
    }

    if (new Date() > tokenData.expiresAt) {
      this.tokens.delete(token);
      return null;
    }

    const user = this.users.find((u) => u.id === tokenData.userId);
    if (!user) {
      return null;
    }

    const { password: _, ...userWithoutPassword } = user;
    return userWithoutPassword as User;
  }

  // Refresh token
  async refreshToken(refreshToken: string): Promise<AuthResponse> {
    await this.delay(800);

    // Extract user ID from refresh token (mock implementation)
    // Refresh token format: refresh.mock.{base64UserId}.{timestamp}.{random}
    const parts = refreshToken.split('.');
    if (parts.length < 4 || !parts[2]) {
      throw {
        code: 'INVALID_TOKEN',
        message: 'Invalid refresh token',
      } as AuthError;
    }

    const userId = atob(parts[2]);
    const user = this.users.find((u) => u.id === userId);

    if (!user) {
      throw {
        code: 'USER_NOT_FOUND',
        message: 'User not found',
      } as AuthError;
    }

    const token = this.generateToken(user.id);
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

    this.tokens.set(token, { userId: user.id, expiresAt });

    const { password: _, ...userWithoutPassword } = user;

    return {
      user: userWithoutPassword as User,
      token,
      refreshToken: this.generateRefreshToken(user.id),
      expiresAt,
    };
  }

  // Logout (clear token)
  async logout(token: string): Promise<void> {
    await this.delay(200);
    this.tokens.delete(token);
  }

  // Update user profile
  async updateProfile(userId: string, updates: Partial<User>): Promise<User> {
    await this.delay(1000);

    const userIndex = this.users.findIndex((u) => u.id === userId);
    if (userIndex === -1) {
      throw {
        code: 'USER_NOT_FOUND',
        message: 'User not found',
      } as AuthError;
    }

    const user = this.users[userIndex];
    const updatedUser = {
      ...user,
      ...updates,
      updatedAt: new Date(),
    };

    this.users[userIndex] = updatedUser;

    const { password: _, ...userWithoutPassword } = updatedUser;
    return userWithoutPassword as User;
  }
}

export const mockAuthAPI = new MockAuthAPI();
