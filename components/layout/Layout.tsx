'use client';

import { ReactNode } from 'react';
import Sidebar from './Sidebar';

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[var(--bg-app)]">
      <Sidebar />
      {/* mobile top bar = 48px; desktop sidebar = 220px */}
      <main className="min-h-screen pt-12 lg:ml-[220px] lg:pt-0">
        {children}
      </main>
    </div>
  );
}
