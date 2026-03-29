'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Shield,
  Activity,
  Layers,
  Bell,
  BookOpen,
  FileText,
  Settings,
} from 'lucide-react';
import { useUser } from '@/lib/hooks';
import { getInitials } from '@/lib/utils';

const nav = [
  { name: 'Runs', href: '/dashboard', icon: Activity },
  { name: 'Sessions', href: '/dashboard/sessions', icon: Layers },
  { name: 'Approvals', href: '/dashboard/approvals', icon: Bell },
  { name: 'Policies', href: '/dashboard/policies', icon: BookOpen },
  { name: 'Audit Trail', href: '/dashboard/audit', icon: FileText },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { user } = useUser();

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard';
    return pathname.startsWith(href);
  };

  return (
    <aside className="fixed left-0 top-0 z-30 flex h-screen w-56 flex-col border-r border-border bg-background">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 py-5">
        <Shield className="h-5 w-5 text-foreground" />
        <span className="text-sm font-semibold text-foreground">Aegis</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-2">
        {nav.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors ${
                active
                  ? 'bg-muted text-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              <item.icon className="h-4 w-4" />
              {item.name}
            </Link>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="border-t border-border p-2">
        <Link
          href="/dashboard/settings"
          className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors ${
            pathname === '/dashboard/settings'
              ? 'bg-muted text-foreground'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
          }`}
        >
          <Settings className="h-4 w-4" />
          Settings
        </Link>
        
        <div className="mt-2 flex items-center gap-2.5 px-3 py-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-xs font-medium text-foreground">
            {user ? getInitials(user.username) : '?'}
          </div>
          <span className="truncate text-sm text-muted-foreground">
            {user?.username || 'Not connected'}
          </span>
        </div>
      </div>
    </aside>
  );
}
