import React from 'react';

import { Auth0LoginForm } from '@/components/auth/Auth0LoginForm';

/**
 * Login Page Component
 *
 * Uses Auth0 Universal Login for authentication.
 * The Auth0LoginForm handles the login UI and redirects to Auth0.
 */
export const Login: React.FC = () => {
  return <Auth0LoginForm />;
};
