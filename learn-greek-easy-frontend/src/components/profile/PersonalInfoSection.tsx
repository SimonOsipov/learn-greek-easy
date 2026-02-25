import React, { useState, useRef } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { Camera, Lock, Loader2, Trash2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';

import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import log from '@/lib/logger';
import { authAPI } from '@/services/authAPI';
import { useAuthStore } from '@/stores/authStore';
import type { User } from '@/types/auth';

import type { TFunction } from 'i18next';

// Avatar upload constants
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
const MAX_SIZE_MB = MAX_SIZE_BYTES / (1024 * 1024);

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
      .regex(/^[\p{L}\p{M}\s'-]+$/u, t('personalInfo.validation.nameFormat')),
  });

type ProfileFormData = z.infer<ReturnType<typeof createProfileSchema>>;

// Helper function to get user initials
const getInitials = (name: string): string => {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
};

export const PersonalInfoSection: React.FC<PersonalInfoSectionProps> = ({ user }) => {
  const { t } = useTranslation('profile');
  const updateProfile = useAuthStore((state) => state.updateProfile);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isRemovingAvatar, setIsRemovingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
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

  // File validation function
  const validateFile = (file: File): string | null => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      return t('personalInfo.avatarInvalidType');
    }
    if (file.size > MAX_SIZE_BYTES) {
      return t('personalInfo.avatarTooLarge', { maxSize: MAX_SIZE_MB });
    }
    return null;
  };

  // Handle avatar upload
  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Reset input for re-upload of same file
    event.target.value = '';

    // Validate file
    const validationError = validateFile(file);
    if (validationError) {
      toast({
        title: t('personalInfo.uploadError'),
        description: validationError,
        variant: 'destructive',
      });
      return;
    }

    setIsUploadingAvatar(true);

    try {
      // 1. Get presigned URL
      const { upload_url, avatar_key } = await authAPI.getAvatarUploadUrl({
        content_type: file.type,
        file_size: file.size,
      });

      // 2. Upload to S3
      await authAPI.uploadToS3(upload_url, file);

      // 3. Update profile with new avatar key
      await updateProfile({ avatar: avatar_key });

      toast({
        title: t('personalInfo.avatarSuccess'),
        description: t('personalInfo.avatarSuccessDescription'),
      });
    } catch (error) {
      log.error('Avatar upload failed:', { error });
      toast({
        title: t('personalInfo.uploadError'),
        description: t('personalInfo.avatarUploadFailed'),
        variant: 'destructive',
      });
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  // Handle avatar removal
  const handleRemoveAvatar = async () => {
    if (!user.avatar) return;

    setIsRemovingAvatar(true);

    try {
      await authAPI.removeAvatar();
      // Update user state directly instead of calling checkAuth to avoid triggering full-page loader
      useAuthStore.setState((state) => ({
        user: state.user ? { ...state.user, avatar: undefined } : null,
      }));

      toast({
        title: t('personalInfo.avatarRemoved'),
        description: t('personalInfo.avatarRemovedDescription'),
      });
    } catch (error) {
      log.error('Avatar removal failed:', { error });
      toast({
        title: t('personalInfo.error'),
        description: t('personalInfo.avatarRemoveFailed'),
        variant: 'destructive',
      });
    } finally {
      setIsRemovingAvatar(false);
    }
  };

  // Trigger file input click
  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-foreground">{t('personalInfo.title')}</h2>
        <p className="text-sm text-muted-foreground">{t('personalInfo.subtitle')}</p>
      </div>

      <Separator className="mb-6" />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Avatar Upload */}
        <div>
          <Label className="mb-2 block text-sm font-medium text-foreground">
            {t('personalInfo.profilePicture')}
          </Label>
          <div className="flex items-center gap-4">
            <div className="relative">
              <Avatar className="h-20 w-20">
                {user.avatar ? <AvatarImage src={user.avatar} alt={user.name} /> : null}
                <AvatarFallback className="bg-gradient-to-br from-blue-500 to-blue-600 text-2xl font-bold text-white">
                  {getInitials(user.name)}
                </AvatarFallback>
              </Avatar>
              {(isUploadingAvatar || isRemovingAvatar) && (
                <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50">
                  <Loader2 className="h-6 w-6 animate-spin text-white" />
                </div>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleAvatarUpload}
                className="hidden"
                disabled={isUploadingAvatar || isRemovingAvatar}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={triggerFileInput}
                disabled={isUploadingAvatar || isRemovingAvatar}
                className="flex items-center gap-2"
              >
                <Camera className="h-4 w-4" />
                {user.avatar ? t('personalInfo.changePhoto') : t('personalInfo.uploadPhoto')}
              </Button>
              {user.avatar && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleRemoveAvatar}
                  disabled={isUploadingAvatar || isRemovingAvatar}
                  className="flex items-center gap-2 text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                  {t('personalInfo.removePhoto')}
                </Button>
              )}
            </div>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {t('personalInfo.photoHintWithSpecs', { maxSize: MAX_SIZE_MB })}
          </p>
        </div>

        {/* Name Input */}
        <div>
          <Label htmlFor="name" className="mb-2 block text-sm font-medium text-foreground">
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
          <Label htmlFor="email" className="mb-2 block text-sm font-medium text-foreground">
            {t('personalInfo.email')}
          </Label>
          <div className="relative">
            <Input
              id="email"
              type="email"
              value={user.email}
              readOnly
              className="cursor-default pr-10 text-muted-foreground"
            />
            <Lock className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {t('personalInfo.emailCannotChange')}
          </p>
        </div>

        {/* Submit Button */}
        <div className="flex justify-end gap-3 pt-6">
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
