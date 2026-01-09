import React from 'react';

import { Auth0RegisterForm } from '@/components/auth/Auth0RegisterForm';

/**
 * Registration Page Component
 *
 * Uses Auth0 for user registration.
 * The Auth0RegisterForm handles the registration UI with email/password
 * and Google sign-up options.
 */
export const Register: React.FC = () => {
  return <Auth0RegisterForm />;
};
