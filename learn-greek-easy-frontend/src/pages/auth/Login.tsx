import React from 'react';

import { LoginForm } from '@/components/auth/LoginForm';

/**
 * Login Page Component
 *
 * Uses Supabase authentication.
 * The LoginForm handles the login UI with email/password and Google OAuth.
 */
export const Login: React.FC = () => {
  return <LoginForm />;
};
