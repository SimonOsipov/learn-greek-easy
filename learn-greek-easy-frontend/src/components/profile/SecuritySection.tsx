import React, { useState } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { Shield, Lock, Key, Trash2, AlertTriangle, Smartphone, Loader2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';

import type { TFunction } from 'i18next';

// Factory function to create schema with translations
const createPasswordSchema = (t: TFunction) =>
  z
    .object({
      currentPassword: z.string().min(1, t('security.validation.currentPasswordRequired')),
      newPassword: z
        .string()
        .min(8, t('security.validation.passwordMinLength'))
        .regex(/[A-Z]/, t('security.validation.passwordUppercase'))
        .regex(/[a-z]/, t('security.validation.passwordLowercase'))
        .regex(/[0-9]/, t('security.validation.passwordNumber')),
      confirmPassword: z.string(),
    })
    .refine((data) => data.newPassword === data.confirmPassword, {
      message: t('security.validation.passwordsDoNotMatch'),
      path: ['confirmPassword'],
    });

type PasswordFormData = z.infer<ReturnType<typeof createPasswordSchema>>;

export const SecuritySection: React.FC = () => {
  const { t } = useTranslation('profile');
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');

  const passwordSchema = createPasswordSchema(t);

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
    reset,
  } = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  });

  const onPasswordSubmit = async (_data: PasswordFormData) => {
    setIsLoading(true);
    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1500));
      toast({
        title: t('security.changePassword.comingSoon'),
        description: t('security.changePassword.comingSoonDescription'),
      });
      reset();
    } catch (error) {
      toast({
        title: t('security.changePassword.error'),
        description: t('security.changePassword.errorDescription'),
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAccountDeletion = async () => {
    if (deleteConfirmation.toLowerCase() !== 'delete') {
      toast({
        title: t('security.dangerZone.invalidConfirmation'),
        description: t('security.dangerZone.pleaseTypeDelete'),
        variant: 'destructive',
      });
      return;
    }

    toast({
      title: t('security.dangerZone.comingSoon'),
      description: t('security.dangerZone.contactSupport'),
    });
    setIsDeleteDialogOpen(false);
    setDeleteConfirmation('');
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-900">{t('security.title')}</h2>
        <p className="text-sm text-gray-600">{t('security.subtitle')}</p>
      </div>

      <Separator className="mb-6" />

      <div className="space-y-6">
        {/* Change Password */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Key className="h-5 w-5 text-blue-600" />
              {t('security.changePassword.title')}
            </CardTitle>
            <CardDescription>{t('security.changePassword.description')}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onPasswordSubmit)} className="space-y-4">
              {/* Current Password */}
              <div>
                <Label htmlFor="currentPassword" className="mb-2 block text-sm font-medium">
                  {t('security.changePassword.currentPassword')}
                </Label>
                <Input
                  id="currentPassword"
                  type="password"
                  {...register('currentPassword')}
                  placeholder={t('security.changePassword.currentPasswordPlaceholder')}
                  className={errors.currentPassword ? 'border-red-500' : ''}
                />
                {errors.currentPassword && (
                  <p className="mt-1 text-sm text-red-600">{errors.currentPassword.message}</p>
                )}
              </div>

              {/* New Password */}
              <div>
                <Label htmlFor="newPassword" className="mb-2 block text-sm font-medium">
                  {t('security.changePassword.newPassword')}
                </Label>
                <Input
                  id="newPassword"
                  type="password"
                  {...register('newPassword')}
                  placeholder={t('security.changePassword.newPasswordPlaceholder')}
                  className={errors.newPassword ? 'border-red-500' : ''}
                />
                {errors.newPassword && (
                  <p className="mt-1 text-sm text-red-600">{errors.newPassword.message}</p>
                )}
              </div>

              {/* Confirm Password */}
              <div>
                <Label htmlFor="confirmPassword" className="mb-2 block text-sm font-medium">
                  {t('security.changePassword.confirmPassword')}
                </Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  {...register('confirmPassword')}
                  placeholder={t('security.changePassword.confirmPasswordPlaceholder')}
                  className={errors.confirmPassword ? 'border-red-500' : ''}
                />
                {errors.confirmPassword && (
                  <p className="mt-1 text-sm text-red-600">{errors.confirmPassword.message}</p>
                )}
              </div>

              {/* Password Requirements */}
              <div className="rounded-lg bg-blue-50 p-4">
                <p className="mb-2 text-sm font-medium text-blue-900">
                  {t('security.changePassword.requirements')}
                </p>
                <ul className="space-y-1 text-sm text-blue-700">
                  <li>• {t('security.changePassword.requirementLength')}</li>
                  <li>• {t('security.changePassword.requirementCase')}</li>
                  <li>• {t('security.changePassword.requirementNumber')}</li>
                </ul>
              </div>

              {/* Submit Button */}
              <div className="flex justify-end gap-3 border-t border-gray-200 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => reset()}
                  disabled={!isDirty || isLoading}
                >
                  {t('security.changePassword.cancel')}
                </Button>
                <Button type="submit" disabled={!isDirty || isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {t('security.changePassword.updating')}
                    </>
                  ) : (
                    t('security.changePassword.update')
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Two-Factor Authentication (Coming Soon) */}
        <Card className="opacity-60">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Smartphone className="h-5 w-5 text-green-600" />
              {t('security.twoFactor.title')}
              <span className="ml-auto rounded-full bg-gray-200 px-2 py-1 text-xs font-medium text-gray-700">
                {t('security.twoFactor.comingSoon')}
              </span>
            </CardTitle>
            <CardDescription>{t('security.twoFactor.description')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border border-gray-200 p-4 opacity-50">
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100">
                  <Shield className="h-5 w-5 text-gray-600" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-gray-900">{t('security.twoFactor.enable2FA')}</p>
                  <p className="mt-1 text-sm text-gray-600">
                    {t('security.twoFactor.enable2FADescription')}
                  </p>
                </div>
                <Button disabled variant="outline" size="sm">
                  {t('security.twoFactor.enable')}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Active Sessions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Lock className="h-5 w-5 text-purple-600" />
              {t('security.sessions.title')}
            </CardTitle>
            <CardDescription>{t('security.sessions.description')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-start justify-between rounded-lg border border-gray-200 p-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-gray-900">
                      {t('security.sessions.currentDevice')}
                    </p>
                    <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                      {t('security.sessions.activeNow')}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-gray-600">
                    {navigator.userAgent.includes('Mac') ? 'macOS' : 'Unknown'} •{' '}
                    {navigator.userAgent.includes('Chrome') ? 'Chrome' : 'Unknown Browser'}
                  </p>
                  <p className="text-sm text-gray-500">
                    {t('security.sessions.lastActive')} {new Date().toLocaleString()}
                  </p>
                </div>
              </div>
              <p className="text-sm text-gray-600">
                {t('security.sessions.comingSoonDescription')}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Danger Zone - Account Deletion */}
        <Card className="border-red-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base text-red-700">
              <AlertTriangle className="h-5 w-5" />
              {t('security.dangerZone.title')}
            </CardTitle>
            <CardDescription>{t('security.dangerZone.description')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border border-red-200 bg-red-50 p-4">
              <div className="mb-4">
                <h4 className="mb-1 font-medium text-red-900">
                  {t('security.dangerZone.deleteAccount')}
                </h4>
                <p className="text-sm text-red-700">{t('security.dangerZone.deleteDescription')}</p>
              </div>

              <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="destructive" size="sm" className="flex items-center gap-2">
                    <Trash2 className="h-4 w-4" />
                    {t('security.dangerZone.deleteAccount')}
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-red-700">
                      <AlertTriangle className="h-5 w-5" />
                      {t('security.dangerZone.deleteDialogTitle')}
                    </DialogTitle>
                    <DialogDescription>
                      {t('security.dangerZone.deleteDialogDescription')}
                    </DialogDescription>
                  </DialogHeader>
                  <div className="my-4">
                    <ul className="space-y-2 text-sm text-gray-700">
                      <li className="flex items-start gap-2">
                        <span className="text-red-600">•</span>
                        <span>{t('security.dangerZone.deleteItems.profile')}</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-red-600">•</span>
                        <span>{t('security.dangerZone.deleteItems.progress')}</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-red-600">•</span>
                        <span>{t('security.dangerZone.deleteItems.achievements')}</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-red-600">•</span>
                        <span>{t('security.dangerZone.deleteItems.favorites')}</span>
                      </li>
                    </ul>
                    <div className="mt-4">
                      <Label
                        htmlFor="deleteConfirmation"
                        className="mb-2 block text-sm font-medium"
                      >
                        {t('security.dangerZone.typeToConfirm')}
                      </Label>
                      <Input
                        id="deleteConfirmation"
                        type="text"
                        value={deleteConfirmation}
                        onChange={(e) => setDeleteConfirmation(e.target.value)}
                        placeholder="DELETE"
                        className="font-mono"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setIsDeleteDialogOpen(false);
                        setDeleteConfirmation('');
                      }}
                    >
                      {t('security.dangerZone.cancel')}
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={handleAccountDeletion}
                      disabled={deleteConfirmation.toLowerCase() !== 'delete'}
                    >
                      {t('security.dangerZone.deleteMyAccount')}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
