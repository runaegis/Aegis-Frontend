'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {api} from '@/lib/api';
import {
  LayoutDashboard,
  Activity,
  Layers,
  Users,
  Bell,
  BookOpen,
  FileText,
  Clock,
  Coins,
  Plug,
  Settings,
  LogOut,
  Menu,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useUser } from '@/lib/hooks';
import { getInitials } from '@/lib/utils';
import { AegisLogo } from '@/components/ui/AegisLogo';
import { useRouter } from 'next/navigation';

type NavItem = {
  name: string;
  href: string;
  icon: LucideIcon;
  badge?: { value: number | string; tone: 'urgent' | 'neutral' };
};

type NavGroup = {
  label: string;
  items: NavItem[];
};

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Workspace',
    items: [
      { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
      { name: 'Runs', href: '/dashboard/runs', icon: Activity },
      { name: 'Sessions', href: '/dashboard/sessions', icon: Layers },
      { name: 'Rooms', href: '/dashboard/rooms', icon: Users },
    ],
  },
  {
    label: 'Governance',
    items: [
      { name: 'Approvals', href: '/dashboard/approvals', icon: Bell },
      { name: 'Policies', href: '/dashboard/policies', icon: BookOpen },
      { name: 'Audit Trail', href: '/dashboard/audit', icon: FileText },
      { name: 'Freeze Windows', href: '/dashboard/freeze-window', icon: Clock },
    ],
  },
  {
    label: 'Insights',
    items: [
      { name: 'Token Spenditure', href: '/dashboard/token-spenditure', icon: Coins },
    ],
  },
];

const BOTTOM_ITEMS: NavItem[] = [
  { name: 'Integrations', href: '/dashboard/integrations', icon: Plug },
  { name: 'Settings', href: '/dashboard/settings', icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { user } = useUser();
  const [mobileOpen, setMobileOpen] = useState(false);
  const router = useRouter();

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard';
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  const handleLogout = async () => {
    await api.logOut();
    router.replace('/auth');
  }; 

  const renderNavLink = (item: NavItem) => {
    const active = isActive(item.href);
    const Icon = item.icon;
    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={() => setMobileOpen(false)}
        className={[
          'group relative flex h-8 items-center gap-2 rounded-[7px] px-2 text-[13px] font-medium tracking-[-0.01em] transition-colors',
          active
            ? 'bg-[var(--primary-alpha-10)] text-[var(--primary-base)]'
            : 'text-[var(--neutral-sub-600)] hover:bg-[var(--neutral-weak-50)]',
        ].join(' ')}
        style={active ? { backgroundColor: 'rgba(250, 115, 25, 0.10)' } : undefined}
      >
        <Icon
          className="h-3.5 w-3.5 shrink-0"
          strokeWidth={active ? 2.25 : 2}
        />
        <span className="flex-1 truncate">{item.name}</span>
        {item.badge && (
          <span
            className={[
              'inline-flex h-[17px] min-w-[17px] items-center justify-center rounded-[5px] px-[5px] text-[10.5px] font-bold tabular-nums',
              item.badge.tone === 'urgent'
                ? 'bg-[var(--error)] text-white'
                : 'bg-[var(--neutral-soft-200)] text-[var(--neutral-sub-600)]',
            ].join(' ')}
          >
            {item.badge.value}
          </span>
        )}
      </Link>
    );
  };

  const NavContent = () => (
    <>
      {/* Logo row */}
      <div className="flex h-[56px] items-center justify-between border-b border-[var(--stroke-soft-200)] px-4">
        <Link
          href="/dashboard"
          className="inline-flex items-center text-[var(--neutral-strong-950)] transition-opacity hover:opacity-80"
          aria-label="Aegis — Home"
        >
          <AegisLogo style={{ height: 22, width: 'auto' }} />
        </Link>
        <button
          className="text-[var(--neutral-soft-400)] hover:text-[var(--neutral-strong-950)] lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-label="Close menu"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Nav groups */}
      <nav className="flex-1 overflow-y-auto px-2 pb-3">
        {NAV_GROUPS.map((group) => (
          <div key={group.label}>
            <div className="px-2 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-[0.07em] text-[var(--neutral-soft-400)]">
              {group.label}
            </div>
            <div className="space-y-0.5">
              {group.items.map((item) => renderNavLink(item))}
            </div>
          </div>
        ))}

        <div>
          <div className="px-2 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-[0.07em] text-[var(--neutral-soft-400)]">
            Admin
          </div>
          <div className="space-y-0.5">
            {BOTTOM_ITEMS.map((item) => renderNavLink(item))}
          </div>
        </div>
      </nav>

      {/* Bottom user row */}
      <div className="border-t border-[var(--stroke-soft-200)] px-2 py-[10px]">
        <div className="flex items-center gap-2.5 px-2 py-1.5">
          <div
            className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full text-[11px] font-semibold"
            style={{
              backgroundColor: 'rgba(250, 115, 25, 0.10)',
              color: 'var(--primary-base)',
            }}
          >
            {user ? getInitials(user.username) : '?'}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[12.5px] font-medium text-[var(--neutral-strong-950)]">
              {user?.username || 'Not connected'}
            </p>
            <p className="truncate text-[11px] text-[var(--neutral-soft-400)]">
              {user?.email || 'Sign in to continue'}
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="rounded-md p-1 text-[var(--neutral-soft-400)] hover:bg-[var(--neutral-weak-50)] hover:text-[var(--error)]"
            aria-label="Log out"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile top bar */}
      <div className="fixed left-0 right-0 top-0 z-40 flex h-12 items-center justify-between border-b border-[var(--stroke-soft-200)] bg-white px-4 lg:hidden">
        <Link
          href="/dashboard"
          className="inline-flex items-center text-[var(--neutral-strong-950)]"
          aria-label="Aegis — Home"
        >
          <AegisLogo style={{ height: 22, width: 'auto' }} />
        </Link>
        <button
          onClick={() => setMobileOpen(true)}
          className="text-[var(--neutral-soft-400)] hover:text-[var(--neutral-strong-950)]"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <aside
        className={[
          'fixed left-0 top-0 z-50 flex h-screen w-[220px] flex-col bg-white transition-transform duration-200 lg:hidden',
          'border-r border-[var(--stroke-soft-200)]',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        ].join(' ')}
      >
        <NavContent />
      </aside>

      {/* Desktop sidebar */}
      <aside className="fixed left-0 top-0 z-30 hidden h-screen w-[220px] flex-col border-r border-[var(--stroke-soft-200)] bg-white lg:flex">
        <NavContent />
      </aside>
    </>
  );
}
