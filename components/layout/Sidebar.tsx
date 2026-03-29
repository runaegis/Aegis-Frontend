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
  ChevronRight,
} from 'lucide-react';
import { useUser } from '@/lib/hooks';
import { getInitials } from '@/lib/utils';

const nav = [
  { name: 'Runs', href: '/dashboard', icon: Activity, description: 'Real-time activity' },
  { name: 'Sessions', href: '/dashboard/sessions', icon: Layers, description: 'Agent sessions' },
  { name: 'Approvals', href: '/dashboard/approvals', icon: Bell, description: 'Pending reviews' },
  { name: 'Policies', href: '/dashboard/policies', icon: BookOpen, description: 'Security rules' },
  { name: 'Audit Trail', href: '/dashboard/audit', icon: FileText, description: 'Event history' },
];

const bottomNav = [
  { name: 'Settings', href: '/dashboard/settings', icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { user } = useUser();

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard';
    return pathname.startsWith(href);
  };

  return (
    <aside className="fixed left-0 top-0 z-30 flex h-screen w-[240px] flex-col border-r border-border bg-sidebar">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
          <Shield className="h-5 w-5 text-primary" strokeWidth={2} />
        </div>
        <div className="flex flex-col">
          <span className="text-base font-semibold tracking-tight text-foreground">Aegis</span>
          <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
            Governance
          </span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        <div className="mb-2 px-3">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Overview
          </span>
        </div>
        
        {nav.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
                active
                  ? 'bg-sidebar-active text-sidebar-active-foreground'
                  : 'text-sidebar-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              {active && (
                <div className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-primary" />
              )}
              <item.icon className={`h-4 w-4 shrink-0 ${active ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'}`} />
              <span className="flex-1">{item.name}</span>
              {active && (
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
              )}
            </Link>
          );
        })}

        <div className="my-4 border-t border-border" />

        <div className="mb-2 px-3">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Account
          </span>
        </div>

        {bottomNav.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
                active
                  ? 'bg-sidebar-active text-sidebar-active-foreground'
                  : 'text-sidebar-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              <item.icon className={`h-4 w-4 shrink-0 ${active ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'}`} />
              <span>{item.name}</span>
            </Link>
          );
        })}
      </nav>

      {/* User Section */}
      <div className="border-t border-border p-4">
        <div className="flex items-center gap-3 rounded-lg bg-muted/50 px-3 py-2.5">
          <div className="relative">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-primary/5 text-xs font-semibold text-primary ring-1 ring-primary/20">
              {user ? getInitials(user.username) : '?'}
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-sidebar bg-success" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">
              {user?.username || 'Not connected'}
            </p>
            <p className="text-xs text-muted-foreground">Active</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
