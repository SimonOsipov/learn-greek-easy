import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Lock } from 'lucide-react';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export const ForgotPassword: React.FC = () => {
  return (
    <AuthLayout>
      <Card className="shadow-xl">
        <CardHeader className="space-y-1 text-center">
          <div className="mb-4 mx-auto">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-100 to-purple-100 rounded-full flex items-center justify-center">
              <Lock className="w-8 h-8 text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold">Password Reset</CardTitle>
          <CardDescription>This feature is coming in Phase 2</CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="text-center space-y-2">
            <p className="text-muted-foreground">
              Password reset functionality will be available soon.
            </p>
            <p className="text-sm text-muted-foreground">
              In the meantime, please contact support if you need help accessing
              your account.
            </p>
          </div>

          <div className="pt-4">
            <Button asChild variant="outline" className="w-full">
              <Link to="/login">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Login
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </AuthLayout>
  );
};
