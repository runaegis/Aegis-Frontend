'use client';

import { ReactNode } from 'react';
import Sidebar from './Sidebar';

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      <Sidebar />
      <main className="ml-[220px]">{children}</main>
    </div>
  );
}
