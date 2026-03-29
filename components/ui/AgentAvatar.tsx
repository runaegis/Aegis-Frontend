'use client';

import { getInitials } from '@/lib/utils';

interface AgentAvatarProps {
  name: string;
  size?: 'sm' | 'md' | 'lg';
}

const sizes = {
  sm: 'h-6 w-6 text-[10px]',
  md: 'h-8 w-8 text-xs',
  lg: 'h-10 w-10 text-sm',
};

export default function AgentAvatar({ name, size = 'md' }: AgentAvatarProps) {
  return (
    <div className={`flex items-center justify-center rounded-full bg-muted font-medium text-muted-foreground ${sizes[size]}`}>
      {getInitials(name)}
    </div>
  );
}
