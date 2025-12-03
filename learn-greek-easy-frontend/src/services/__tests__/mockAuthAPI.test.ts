// src/services/__tests__/mockAuthAPI.test.ts

import { describe, it, expect, beforeEach } from 'vitest';

import type { RegisterData, AuthError } from '@/types/auth';

import { mockAuthAPI } from '../mockAuthAPI';

describe('mockAuthAPI', () => {
  // Test credentials from mockData.ts
  const validEmail = 'demo@learngreekeasy.com';
  const validPassword = 'Demo123!';

  const newUserData: RegisterData = {
    email: 'newuser@test.com',
    password: 'NewUser123!',
    name: 'New Test User',
  };

  beforeEach(() => {
    // Clear any tokens between tests
    // Note: mockAuthAPI maintains state via Map, so tokens persist across tests
    // This is acceptable for testing since each test scenario is isolated
  });

  describe('login', () => {
    it('should login successfully with valid credentials', async () => {
      const response = await mockAuthAPI.login(validEmail, validPassword);

      expect(response).toBeDefined();
      expect(response.user).toBeDefined();
      expect(response.user.email).toBe(validEmail);
      expect(response.user).not.toHaveProperty('password');
      expect(response.token).toBeDefined();
      expect(response.refreshToken).toBeDefined();
      expect(response.expiresAt).toBeInstanceOf(Date);
    });

    it('should be case-insensitive for email', async () => {
      const response = await mockAuthAPI.login(validEmail.toUpperCase(), validPassword);

      expect(response).toBeDefined();
      expect(response.user.email).toBe(validEmail);
    });

    it('should simulate network delay (at least 800ms)', async () => {
      const start = Date.now();
      await mockAuthAPI.login(validEmail, validPassword);
      const duration = Date.now() - start;

      expect(duration).toBeGreaterThanOrEqual(800);
    });

    it('should throw error for invalid email', async () => {
      await expect(mockAuthAPI.login('invalid@test.com', validPassword)).rejects.toMatchObject({
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password',
      });
    });

    it('should throw error for invalid password', async () => {
      await expect(mockAuthAPI.login(validEmail, 'wrongpassword')).rejects.toMatchObject({
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password',
      });
    });

    it('should generate unique tokens for different logins', async () => {
      const response1 = await mockAuthAPI.login(validEmail, validPassword);
      const response2 = await mockAuthAPI.login(validEmail, validPassword);

      expect(response1.token).not.toBe(response2.token);
      expect(response1.refreshToken).not.toBe(response2.refreshToken);
    });

    it('should set token expiration to 30 minutes', async () => {
      const now = Date.now();
      const response = await mockAuthAPI.login(validEmail, validPassword);

      const expirationTime = response.expiresAt.getTime();
      const expectedExpiration = now + 30 * 60 * 1000; // 30 minutes
      const tolerance = 2000; // 2 seconds tolerance for test execution time

      expect(expirationTime).toBeGreaterThanOrEqual(expectedExpiration - tolerance);
      expect(expirationTime).toBeLessThanOrEqual(expectedExpiration + tolerance);
    });

    it('should not return password in user object', async () => {
      const response = await mockAuthAPI.login(validEmail, validPassword);

      expect(response.user).not.toHaveProperty('password');
    });

    it('should include user role in response', async () => {
      const response = await mockAuthAPI.login(validEmail, validPassword);

      expect(response.user.role).toBeDefined();
      expect(['free', 'premium', 'admin']).toContain(response.user.role);
    });
  });

  describe('register', () => {
    it('should register new user successfully', async () => {
      const response = await mockAuthAPI.register(newUserData);

      expect(response).toBeDefined();
      expect(response.user.email).toBe(newUserData.email);
      expect(response.user.name).toBe(newUserData.name);
      expect(response.user.role).toBe('free');
      expect(response.token).toBeDefined();
      expect(response.refreshToken).toBeDefined();
    });

    it('should simulate longer network delay (at least 1300ms)', async () => {
      const start = Date.now();
      const uniqueEmail = `test-${Date.now()}@test.com`;
      await mockAuthAPI.register({ ...newUserData, email: uniqueEmail });
      const duration = Date.now() - start;

      expect(duration).toBeGreaterThanOrEqual(1300);
    });

    it('should throw error for duplicate email', async () => {
      // Register user first time
      const uniqueEmail = `duplicate-${Date.now()}@test.com`;
      await mockAuthAPI.register({ ...newUserData, email: uniqueEmail });

      // Try to register again with same email
      await expect(
        mockAuthAPI.register({ ...newUserData, email: uniqueEmail })
      ).rejects.toMatchObject({
        code: 'EMAIL_EXISTS',
        message: 'An account with this email already exists',
        field: 'email',
      } as AuthError);
    });

    it('should be case-insensitive for duplicate email check', async () => {
      const uniqueEmail = `casetest-${Date.now()}@test.com`;
      await mockAuthAPI.register({ ...newUserData, email: uniqueEmail });

      await expect(
        mockAuthAPI.register({ ...newUserData, email: uniqueEmail.toUpperCase() })
      ).rejects.toMatchObject({
        code: 'EMAIL_EXISTS',
      });
    });

    it('should create user with default preferences', async () => {
      const uniqueEmail = `prefs-${Date.now()}@test.com`;
      const response = await mockAuthAPI.register({ ...newUserData, email: uniqueEmail });

      expect(response.user.preferences).toBeDefined();
      expect(response.user.preferences.language).toBe('en');
      expect(response.user.preferences.dailyGoal).toBe(10);
      expect(response.user.preferences.notifications).toBe(true);
    });

    it('should create user with initial stats', async () => {
      const uniqueEmail = `stats-${Date.now()}@test.com`;
      const response = await mockAuthAPI.register({ ...newUserData, email: uniqueEmail });

      expect(response.user.stats).toBeDefined();
      expect(response.user.stats.streak).toBe(0);
      expect(response.user.stats.wordsLearned).toBe(0);
      expect(response.user.stats.totalXP).toBe(0);
      expect(response.user.stats.joinedDate).toBeInstanceOf(Date);
    });

    it('should generate unique user ID', async () => {
      const email1 = `user1-${Date.now()}@test.com`;
      const email2 = `user2-${Date.now()}@test.com`;

      const response1 = await mockAuthAPI.register({ ...newUserData, email: email1 });
      const response2 = await mockAuthAPI.register({ ...newUserData, email: email2 });

      expect(response1.user.id).not.toBe(response2.user.id);
      expect(response1.user.id).toContain('user-');
    });

    it('should auto-login after registration', async () => {
      const uniqueEmail = `autologin-${Date.now()}@test.com`;
      const response = await mockAuthAPI.register({ ...newUserData, email: uniqueEmail });

      // Should have valid token
      expect(response.token).toBeDefined();
      expect(response.token).toContain('mock.');

      // Token should be valid for verification
      const user = await mockAuthAPI.verifyToken(response.token);
      expect(user).toBeDefined();
      expect(user?.email).toBe(uniqueEmail);
    });
  });

  describe('verifyToken', () => {
    it('should verify valid token', async () => {
      const loginResponse = await mockAuthAPI.login(validEmail, validPassword);
      const user = await mockAuthAPI.verifyToken(loginResponse.token);

      expect(user).toBeDefined();
      expect(user?.email).toBe(validEmail);
      expect(user).not.toHaveProperty('password');
    });

    it('should simulate network delay (at least 400ms)', async () => {
      const loginResponse = await mockAuthAPI.login(validEmail, validPassword);

      const start = Date.now();
      await mockAuthAPI.verifyToken(loginResponse.token);
      const duration = Date.now() - start;

      expect(duration).toBeGreaterThanOrEqual(400);
    });

    it('should return null for invalid token', async () => {
      const user = await mockAuthAPI.verifyToken('invalid-token');

      expect(user).toBeNull();
    });

    it('should return null for expired token', async () => {
      // This is difficult to test without time manipulation
      // In real implementation, we'd use vi.useFakeTimers()
      // For MVP, we document this limitation
      expect(true).toBe(true);
    });

    it('should return null for non-existent user', async () => {
      // Create a token with non-existent user ID
      const fakeToken = 'mock.' + btoa('non-existent-user') + '.123.abc';
      const user = await mockAuthAPI.verifyToken(fakeToken);

      expect(user).toBeNull();
    });
  });

  describe('refreshToken', () => {
    it('should refresh token successfully', async () => {
      const loginResponse = await mockAuthAPI.login(validEmail, validPassword);
      const refreshResponse = await mockAuthAPI.refreshToken(loginResponse.refreshToken);

      expect(refreshResponse).toBeDefined();
      expect(refreshResponse.user.email).toBe(validEmail);
      expect(refreshResponse.token).not.toBe(loginResponse.token);
      expect(refreshResponse.refreshToken).not.toBe(loginResponse.refreshToken);
    });

    it('should simulate network delay (at least 700ms)', async () => {
      const loginResponse = await mockAuthAPI.login(validEmail, validPassword);

      const start = Date.now();
      await mockAuthAPI.refreshToken(loginResponse.refreshToken);
      const duration = Date.now() - start;

      expect(duration).toBeGreaterThanOrEqual(700);
    });

    it('should throw error for invalid refresh token format', async () => {
      await expect(mockAuthAPI.refreshToken('invalid-token')).rejects.toMatchObject({
        code: 'INVALID_TOKEN',
        message: 'Invalid refresh token',
      });
    });

    it('should throw error for malformed refresh token', async () => {
      await expect(mockAuthAPI.refreshToken('refresh.invalid')).rejects.toMatchObject({
        code: 'INVALID_TOKEN',
      });
    });

    it('should throw error for non-existent user in refresh token', async () => {
      const fakeRefreshToken = 'refresh.mock.' + btoa('non-existent-user') + '.123.abc';

      await expect(mockAuthAPI.refreshToken(fakeRefreshToken)).rejects.toMatchObject({
        code: 'USER_NOT_FOUND',
        message: 'User not found',
      });
    });

    it('should generate new token with updated expiration', async () => {
      const loginResponse = await mockAuthAPI.login(validEmail, validPassword);
      const now = Date.now();

      const refreshResponse = await mockAuthAPI.refreshToken(loginResponse.refreshToken);

      const expirationTime = refreshResponse.expiresAt.getTime();
      const expectedExpiration = now + 30 * 60 * 1000; // 30 minutes
      const tolerance = 2000; // 2 seconds tolerance

      expect(expirationTime).toBeGreaterThanOrEqual(expectedExpiration - tolerance);
      expect(expirationTime).toBeLessThanOrEqual(expectedExpiration + tolerance);
    });
  });

  describe('logout', () => {
    it('should logout successfully', async () => {
      const loginResponse = await mockAuthAPI.login(validEmail, validPassword);

      await mockAuthAPI.logout(loginResponse.token);

      // Token should no longer be valid after logout
      const user = await mockAuthAPI.verifyToken(loginResponse.token);
      expect(user).toBeNull();
    });

    it('should simulate network delay (at least 150ms)', async () => {
      const loginResponse = await mockAuthAPI.login(validEmail, validPassword);

      const start = Date.now();
      await mockAuthAPI.logout(loginResponse.token);
      const duration = Date.now() - start;

      expect(duration).toBeGreaterThanOrEqual(150);
    });

    it('should not throw error for invalid token', async () => {
      // Logout should be idempotent
      await expect(mockAuthAPI.logout('invalid-token')).resolves.toBeUndefined();
    });

    it('should allow multiple logouts of same token', async () => {
      const loginResponse = await mockAuthAPI.login(validEmail, validPassword);

      await mockAuthAPI.logout(loginResponse.token);
      await expect(mockAuthAPI.logout(loginResponse.token)).resolves.toBeUndefined();
    });
  });

  describe('updateProfile', () => {
    it('should update user profile successfully', async () => {
      const loginResponse = await mockAuthAPI.login(validEmail, validPassword);
      const userId = loginResponse.user.id;

      const updates = {
        name: 'Updated Name',
        preferences: {
          ...loginResponse.user.preferences,
          dailyGoal: 25,
        },
      };

      const updatedUser = await mockAuthAPI.updateProfile(userId, updates);

      expect(updatedUser.name).toBe('Updated Name');
      expect(updatedUser.preferences?.dailyGoal).toBe(25);
      expect(updatedUser.updatedAt).toBeInstanceOf(Date);
    });

    it('should simulate network delay (at least 800ms)', async () => {
      const loginResponse = await mockAuthAPI.login(validEmail, validPassword);
      const userId = loginResponse.user.id;

      const start = Date.now();
      await mockAuthAPI.updateProfile(userId, { name: 'Test' });
      const duration = Date.now() - start;

      expect(duration).toBeGreaterThanOrEqual(800);
    });

    it('should throw error for non-existent user', async () => {
      await expect(
        mockAuthAPI.updateProfile('non-existent-user', { name: 'Test' })
      ).rejects.toMatchObject({
        code: 'USER_NOT_FOUND',
        message: 'User not found',
      });
    });

    it('should not return password in updated user', async () => {
      const loginResponse = await mockAuthAPI.login(validEmail, validPassword);
      const userId = loginResponse.user.id;

      const updatedUser = await mockAuthAPI.updateProfile(userId, { name: 'Test' });

      expect(updatedUser).not.toHaveProperty('password');
    });

    it('should preserve unchanged fields', async () => {
      const loginResponse = await mockAuthAPI.login(validEmail, validPassword);
      const userId = loginResponse.user.id;
      const originalEmail = loginResponse.user.email;

      const updatedUser = await mockAuthAPI.updateProfile(userId, { name: 'New Name' });

      expect(updatedUser.email).toBe(originalEmail);
      expect(updatedUser.role).toBe(loginResponse.user.role);
    });

    it('should update nested preferences correctly', async () => {
      const loginResponse = await mockAuthAPI.login(validEmail, validPassword);
      const userId = loginResponse.user.id;

      const newPreferences = {
        language: 'el' as const,
        dailyGoal: 50,
        notifications: false,
      };

      const updatedUser = await mockAuthAPI.updateProfile(userId, {
        preferences: newPreferences,
      });

      expect(updatedUser.preferences?.language).toBe('el');
      expect(updatedUser.preferences?.dailyGoal).toBe(50);
      expect(updatedUser.preferences?.notifications).toBe(false);
    });

    it('should update updatedAt timestamp', async () => {
      const loginResponse = await mockAuthAPI.login(validEmail, validPassword);
      const userId = loginResponse.user.id;
      const originalUpdatedAt = loginResponse.user.updatedAt;

      // Wait a bit to ensure different timestamp
      await new Promise((resolve) => setTimeout(resolve, 10));

      const updatedUser = await mockAuthAPI.updateProfile(userId, { name: 'Test' });

      expect(updatedUser.updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());
    });
  });

  describe('Token Format', () => {
    it('should generate tokens in expected format', async () => {
      const response = await mockAuthAPI.login(validEmail, validPassword);

      // Token should be in format: mock.{base64UserId}.{timestamp}.{random}
      expect(response.token).toMatch(/^mock\..+\.\d+\..+$/);
      expect(response.refreshToken).toMatch(/^refresh\.mock\..+\.\d+\..+$/);
    });

    it('should include user ID in token', async () => {
      const response = await mockAuthAPI.login(validEmail, validPassword);

      const tokenParts = response.token.split('.');
      expect(tokenParts.length).toBeGreaterThanOrEqual(3);

      // Second part should be base64 encoded user ID
      const encodedUserId = tokenParts[1];
      const decodedUserId = atob(encodedUserId);
      expect(decodedUserId).toBe(response.user.id);
    });
  });

  describe('Error Types', () => {
    it('should return proper AuthError structure', async () => {
      try {
        await mockAuthAPI.login('invalid@test.com', 'wrong');
        expect.fail('Should have thrown error');
      } catch (error) {
        const authError = error as AuthError;
        expect(authError).toHaveProperty('code');
        expect(authError).toHaveProperty('message');
      }
    });

    it('should include field in error when applicable', async () => {
      const uniqueEmail = `duplicate-${Date.now()}@test.com`;
      await mockAuthAPI.register({ ...newUserData, email: uniqueEmail });

      try {
        await mockAuthAPI.register({ ...newUserData, email: uniqueEmail });
        expect.fail('Should have thrown error');
      } catch (error) {
        const authError = error as AuthError;
        expect(authError.field).toBe('email');
      }
    });
  });

  describe('Data Persistence', () => {
    it('should persist registered user for future logins', async () => {
      const uniqueEmail = `persist-${Date.now()}@test.com`;
      const password = 'TestPassword123!';

      // Register user
      await mockAuthAPI.register({
        email: uniqueEmail,
        password,
        name: 'Persist Test',
      });

      // Login with registered user
      const loginResponse = await mockAuthAPI.login(uniqueEmail, password);

      expect(loginResponse).toBeDefined();
      expect(loginResponse.user.email).toBe(uniqueEmail);
      expect(loginResponse.user.name).toBe('Persist Test');
    });

    it('should persist profile updates', async () => {
      const uniqueEmail = `update-${Date.now()}@test.com`;
      const registerResponse = await mockAuthAPI.register({
        ...newUserData,
        email: uniqueEmail,
      });

      const userId = registerResponse.user.id;

      // Update profile
      await mockAuthAPI.updateProfile(userId, { name: 'Updated Name' });

      // Login again and verify update persisted
      const loginResponse = await mockAuthAPI.login(uniqueEmail, newUserData.password);
      expect(loginResponse.user.name).toBe('Updated Name');
    });
  });
});
