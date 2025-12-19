import React, { useState } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { Camera, Lock, Loader2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { useAuthStore } from '@/stores/authStore';
import type { User } from '@/types/auth';

import type { TFunction } from 'i18next';

interface PersonalInfoSectionProps {
  user: User;
}

// Factory function to create schema with translations
const createProfileSchema = (t: TFunction) =>
  z.object({
    name: z
      .string()
      .min(2, t('personalInfo.validation.nameMin'))
      .max(50, t('personalInfo.validation.nameMax'))
      .regex(/^[a-zA-Z\s'-]+$/, t('personalInfo.validation.nameFormat')),
  });

type ProfileFormData = z.infer<ReturnType<typeof createProfileSchema>>;

export const PersonalInfoSection: React.FC<PersonalInfoSectionProps> = ({ user }) => {
  const { t } = useTranslation('profile');
  const updateProfile = useAuthStore((state) => state.updateProfile);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const profileSchema = createProfileSchema(t);

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
    reset,
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: user.name,
    },
  });

  const onSubmit = async (data: ProfileFormData) => {
    setIsLoading(true);
    try {
      await updateProfile({ name: data.name });
      toast({
        title: t('personalInfo.success'),
        description: t('personalInfo.successDescription'),
      });
      reset(data); // Reset form with new values to clear isDirty
    } catch (error) {
      toast({
        title: t('personalInfo.error'),
        description: t('personalInfo.errorDescription'),
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAvatarUpload = () => {
    toast({
      title: t('personalInfo.comingSoon'),
      description: t('personalInfo.avatarComingSoon'),
    });
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-900">{t('personalInfo.title')}</h2>
        <p className="text-sm text-gray-600">{t('personalInfo.subtitle')}</p>
      </div>

      <Separator className="mb-6" />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Avatar Upload */}
        <div>
          <Label className="mb-2 block text-sm font-medium text-gray-700">
            {t('personalInfo.profilePicture')}
          </Label>
          <div className="flex items-center gap-4">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-blue-600 text-2xl font-bold text-white">
              {user.name
                .split(' ')
                .map((n) => n[0])
                .join('')
                .toUpperCase()
                .slice(0, 2)}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAvatarUpload}
              className="flex items-center gap-2"
            >
              <Camera className="h-4 w-4" />
              {t('personalInfo.uploadPhoto')}
            </Button>
          </div>
          <p className="mt-2 text-xs text-gray-500">{t('personalInfo.photoHint')}</p>
        </div>

        {/* Name Input */}
        <div>
          <Label htmlFor="name" className="mb-2 block text-sm font-medium text-gray-700">
            {t('personalInfo.fullName')}
          </Label>
          <Input
            id="name"
            type="text"
            {...register('name')}
            placeholder={t('personalInfo.fullNamePlaceholder')}
            className={errors.name ? 'border-red-500' : ''}
          />
          {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>}
        </div>

        {/* Email (Read-only) */}
        <div>
          <Label htmlFor="email" className="mb-2 block text-sm font-medium text-gray-700">
            {t('personalInfo.email')}
          </Label>
          <div className="relative">
            <Input
              id="email"
              type="email"
              value={user.email}
              readOnly
              disabled
              className="pr-10 text-gray-500"
            />
            <Lock className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          </div>
          <p className="mt-1 text-xs text-gray-500">{t('personalInfo.emailCannotChange')}</p>
        </div>

        {/* Submit Button */}
        <div className="flex justify-end gap-3 border-t border-gray-200 pt-6">
          <Button
            type="button"
            variant="outline"
            onClick={() => reset()}
            disabled={!isDirty || isLoading}
          >
            {t('personalInfo.cancel')}
          </Button>
          <Button type="submit" disabled={!isDirty || isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t('personalInfo.saving')}
              </>
            ) : (
              t('personalInfo.saveChanges')
            )}
          </Button>
        </div>
      </form>
    </div>
  );
};
