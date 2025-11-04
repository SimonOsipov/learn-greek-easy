import React, { useState } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { Camera, Lock, Loader2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { useAuthStore } from '@/stores/authStore';
import type { User } from '@/types/auth';

interface PersonalInfoSectionProps {
  user: User;
}

const profileSchema = z.object({
  name: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(50, 'Name must be less than 50 characters')
    .regex(/^[a-zA-Z\s'-]+$/, 'Name can only contain letters, spaces, hyphens and apostrophes'),
});

type ProfileFormData = z.infer<typeof profileSchema>;

export const PersonalInfoSection: React.FC<PersonalInfoSectionProps> = ({ user }) => {
  const updateProfile = useAuthStore((state) => state.updateProfile);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

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
        title: 'Success!',
        description: 'Your profile has been updated successfully.',
      });
      reset(data); // Reset form with new values to clear isDirty
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update profile. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAvatarUpload = () => {
    toast({
      title: 'Coming Soon',
      description: 'Avatar upload feature will be available soon!',
    });
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-900">Personal Information</h2>
        <p className="text-sm text-gray-600">Update your personal details and profile picture</p>
      </div>

      <Separator className="mb-6" />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Avatar Upload */}
        <div>
          <Label className="mb-2 block text-sm font-medium text-gray-700">Profile Picture</Label>
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
              Upload Photo
            </Button>
          </div>
          <p className="mt-2 text-xs text-gray-500">
            JPG, PNG or GIF. Max size 2MB. Recommended 400x400px.
          </p>
        </div>

        {/* Name Input */}
        <div>
          <Label htmlFor="name" className="mb-2 block text-sm font-medium text-gray-700">
            Full Name
          </Label>
          <Input
            id="name"
            type="text"
            {...register('name')}
            placeholder="Enter your full name"
            className={errors.name ? 'border-red-500' : ''}
          />
          {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>}
        </div>

        {/* Email (Read-only) */}
        <div>
          <Label htmlFor="email" className="mb-2 block text-sm font-medium text-gray-700">
            Email Address
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
          <p className="mt-1 text-xs text-gray-500">
            Email address cannot be changed. Contact support if you need assistance.
          </p>
        </div>

        {/* Account ID (Read-only) */}
        <div>
          <Label htmlFor="userId" className="mb-2 block text-sm font-medium text-gray-700">
            Account ID
          </Label>
          <Input
            id="userId"
            type="text"
            value={user.id}
            readOnly
            disabled
            className="text-gray-500"
          />
          <p className="mt-1 text-xs text-gray-500">
            Your unique account identifier for support purposes.
          </p>
        </div>

        {/* Submit Button */}
        <div className="flex justify-end gap-3 border-t border-gray-200 pt-6">
          <Button
            type="button"
            variant="outline"
            onClick={() => reset()}
            disabled={!isDirty || isLoading}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={!isDirty || isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Changes'
            )}
          </Button>
        </div>
      </form>
    </div>
  );
};
