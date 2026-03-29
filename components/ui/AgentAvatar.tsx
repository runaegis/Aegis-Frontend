'use client';

import { getInitials } from '@/lib/utils';

interface AgentAvatarProps {
  name: string;
  size?: 'sm' | 'md' | 'lg';
}

const sizes = {
  sm: 'h-7 w-7 text-[10px]',
  md: 'h-9 w-9 text-xs',
  lg: 'h-11 w-11 text-sm',
};

// Generate a consistent color based on the name
function getAvatarColor(name: string): { bg: string; text: string; ring: string } {
  const colors = [
    { bg: 'bg-primary/15', text: 'text-primary', ring: 'ring-primary/20' },
    { bg: 'bg-success/15', text: 'text-success', ring: 'ring-success/20' },
    { bg: 'bg-warning/15', text: 'text-warning', ring: 'ring-warning/20' },
    { bg: 'bg-info/15', text: 'text-info', ring: 'ring-info/20' },
  ];
  
  const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return colors[hash % colors.length];
}

export default function AgentAvatar({ name, size = 'md' }: AgentAvatarProps) {
  const colors = getAvatarColor(name);
  
  return (
    <div
      className={`flex items-center justify-center rounded-full font-semibold ring-1 ${sizes[size]} ${colors.bg} ${colors.text} ${colors.ring}`}
    >
      {getInitials(name)}
    </div>
  );
}
