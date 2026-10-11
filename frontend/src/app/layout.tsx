import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { AppShell } from '@/components/layout/AppShell';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Meeting Intelligence System (MIS) — Local-First AI Meeting Minutes',
  description: 'Convert recordings into verifiable transcripts, summaries, decisions, action items, and minutes 100% locally.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-[#FAF9F6] text-[#232529] antialiased min-h-screen`}>
        <AppShell>
          {children}
        </AppShell>
      </body>
    </html>
  );
}

