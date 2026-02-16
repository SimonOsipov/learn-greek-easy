import React from 'react';

import { RegisterForm } from '@/components/auth/RegisterForm';

/**
 * Registration Page Component
 *
 * Uses Supabase for user registration.
 * The RegisterForm handles the registration UI with email/password
 * and Google sign-up options.
 */
export const Register: React.FC = () => {
  return <RegisterForm />;
};
