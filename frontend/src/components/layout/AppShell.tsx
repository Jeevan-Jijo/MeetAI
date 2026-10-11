'use client';

import React, { useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { 
  LayoutDashboard, 
  FolderKanban, 
  PlusCircle, 
  Settings, 
  Menu, 
  X, 
  ShieldCheck, 
  Cpu, 
  Sparkles,
  ArrowRight
} from 'lucide-react';
import { cn } from '@/lib/utils';

export const AppShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // If this is the landing page, render cleanly without dashboard frame
  if (pathname === '/') {
    return <>{children}</>;
  }

  const navItems = [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/meetings', label: 'All Meetings', icon: FolderKanban },
    { href: '/meetings/new', label: 'Analyze Meeting', icon: PlusCircle },
    { href: '/settings', label: 'System Health', icon: Settings },
  ];

  return (
    <div className="flex h-screen overflow-hidden bg-[#FAF9F6] text-[#232529]">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 border-r border-[#E5E4DE] bg-white flex-col justify-between shrink-0 select-none z-20">
        <div>
          {/* Brand Header */}
          <div className="h-16 flex items-center px-6 border-b border-[#E5E4DE] gap-3">
            <Link href="/" className="flex items-center gap-2.5 group">
              <div className="w-8 h-8 rounded-lg bg-[#4E6B56] text-white flex items-center justify-center font-bold text-sm shadow-subtle group-hover:bg-[#415B49] transition">
                M
              </div>
              <div>
                <span className="font-semibold text-[#18191B] tracking-tight text-sm block leading-none">
                  MIS Intelligence
                </span>
                <span className="text-[10px] text-[#666870] font-medium tracking-wide">
                  Local-First System
                </span>
              </div>
            </Link>
          </div>

          {/* Navigation Links */}
          <nav className="p-3 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = item.href === '/dashboard'
                ? pathname === '/dashboard'
                : pathname.startsWith(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs font-medium transition-all',
                    isActive
                      ? 'bg-[#EBF1EC] text-[#34483A] font-semibold border border-[#D0DDD4]'
                      : 'text-[#666870] hover:bg-[#F5F4EE] hover:text-[#18191B]'
                  )}
                >
                  <Icon className={cn('w-4 h-4 shrink-0', isActive ? 'text-[#4E6B56]' : 'text-[#8C8E96]')} />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Local Security & Engine Card */}
        <div className="p-4 m-3 rounded-xl border border-[#E5E4DE] bg-[#F9F8F5] space-y-2.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-[#34483A] flex items-center gap-1.5 text-[11px]">
              <ShieldCheck className="w-3.5 h-3.5 text-[#4E6B56]" />
              100% Offline Privacy
            </span>
            <span className="w-2 h-2 rounded-full bg-[#4E6B56]" />
          </div>
          <p className="text-[11px] text-[#666870] leading-relaxed">
            All audio, transcripts, and LLM reasoning remain completely on your local workstation.
          </p>
          <div className="pt-1 border-t border-[#E5E4DE]/60 flex items-center justify-between text-[10px] text-[#8C8E96]">
            <span>Local Engine</span>
            <span className="font-mono text-[#484B52]">RTX 4060 + Ollama</span>
          </div>
        </div>
      </aside>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-50 bg-black/30 backdrop-blur-xs flex">
          <div className="w-72 bg-white h-full border-r border-[#E5E4DE] p-4 flex flex-col justify-between shadow-panel animate-fade-in">
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-[#E5E4DE]">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-[#4E6B56] text-white flex items-center justify-center font-bold text-xs">
                    M
                  </div>
                  <span className="font-semibold text-sm text-[#18191B]">MIS Intelligence</span>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-1 rounded-md text-[#666870] hover:bg-[#F5F4EE]"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <nav className="space-y-1">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = pathname.startsWith(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={cn(
                        'flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium',
                        isActive
                          ? 'bg-[#EBF1EC] text-[#34483A] font-semibold'
                          : 'text-[#666870] hover:bg-[#F5F4EE]'
                      )}
                    >
                      <Icon className="w-4 h-4 shrink-0 text-[#4E6B56]" />
                      {item.label}
                    </Link>
                  );
                })}
              </nav>
            </div>

            <div className="p-3 rounded-lg bg-[#F9F8F5] border border-[#E5E4DE] text-[11px] text-[#666870]">
              <span className="font-semibold text-[#18191B] block">100% Local Inference</span>
              Zero cloud API dependencies.
            </div>
          </div>
          <div className="flex-1" onClick={() => setMobileMenuOpen(false)} />
        </div>
      )}

      {/* Main Content Viewport */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header Bar */}
        <header className="h-16 border-b border-[#E5E4DE] bg-white/90 backdrop-blur-md px-4 sm:px-8 flex items-center justify-between z-10 sticky top-0 shrink-0">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden p-2 rounded-lg text-[#666870] hover:bg-[#F5F4EE]"
              aria-label="Toggle Navigation"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="hidden sm:flex items-center gap-2 text-xs text-[#8C8E96]">
              <Link href="/" className="hover:text-[#18191B] transition">Home</Link>
              <span>/</span>
              <span className="text-[#18191B] font-medium capitalize">
                {pathname.split('/')[1] || 'Dashboard'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#EBF1EC] text-[#34483A] text-[11px] font-semibold border border-[#D0DDD4]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#4E6B56]" />
              Local Engine Online
            </span>
          </div>
        </header>

        {/* Scrollable Page Body */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 bg-[#FAF9F6]">
          {children}
        </main>
      </div>
    </div>
  );
};
