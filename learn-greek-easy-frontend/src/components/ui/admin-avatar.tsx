import * as React from 'react';

import { cn } from '@/lib/utils';

export type AdminAvatarTone = 'default' | 'primary' | 'blue' | 'green';
export type AdminAvatarSize = 'md' | 'sm';

export interface AdminAvatarProps extends React.HTMLAttributes<HTMLSpanElement> {
  initials: string;
  tone?: AdminAvatarTone;
  size?: AdminAvatarSize;
}

const AdminAvatar = React.forwardRef<HTMLSpanElement, AdminAvatarProps>(
  ({ initials, tone = 'default', size = 'md', className, ...rest }, ref) => (
    <span
      ref={ref}
      className={cn('avatar', `avatar-${tone}`, size === 'sm' && 'avatar-sm', className)}
      {...rest}
    >
      {initials}
    </span>
  )
);
AdminAvatar.displayName = 'AdminAvatar';

export { AdminAvatar };
