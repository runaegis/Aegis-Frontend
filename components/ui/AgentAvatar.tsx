'use client';

import { getInitials } from '@/lib/utils';

interface AgentAvatarProps {
  name: string;
  size?: 'sm' | 'md';
}

const sizes = {
  sm: 'h-7 w-7 text-[10px]',
  md: 'h-9 w-9 text-xs',
};

export default function AgentAvatar({ name, size = 'md' }: AgentAvatarProps) {
  return (
    <div
      className={`flex items-center justify-center rounded-full bg-[#EFF6FF] font-semibold text-[#1D4ED8] ${sizes[size]}`}
    >
      {getInitials(name)}
    </div>
  );
}
