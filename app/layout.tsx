import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from 'next/font/google';
import "./globals.css";

const inter = Inter({ 
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({ 
  subsets: ['latin'],
  variable: '--font-jetbrains',
  display: 'swap',
});

export const metadata: Metadata = {
  title: "Aegis - AI Agent Governance",
  description: "Monitor, control, and audit every AI agent action across your repositories.",
};

export const viewport: Viewport = {
  themeColor: '#0a0a0b',
  colorScheme: 'dark',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`h-full ${inter.variable} ${jetbrainsMono.variable}`} suppressHydrationWarning>
      <body className="min-h-full bg-background text-foreground font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
