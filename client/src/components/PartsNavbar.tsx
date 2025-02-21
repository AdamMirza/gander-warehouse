'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

export default function PartsNavbar() {
  const pathname = usePathname();
  const { logout } = useAuth();

  const isActive = (path: string) => pathname === path;

  const navLinks = [
    { href: '/parts/requisition', label: 'Submit Requisition' },
    { href: '/parts/inventory', label: 'Parts Catalog' },
  ];

  return (
    <nav className="fixed w-full top-0 z-50 bg-white/70 dark:bg-slate-900/70 backdrop-blur-lg border-b border-slate-200 dark:border-slate-800">
      <div className="container mx-auto px-6">
        <div className="flex items-center h-20">
          {/* Logo */}
          <Link 
            href="/" 
            className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-transparent hover:from-blue-700 hover:to-blue-900 transition-all mr-12"
          >
            Gander Parts
          </Link>

          {/* Main Navigation */}
          <div className="flex items-center gap-8">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`relative py-2 text-sm font-medium transition-colors ${
                  isActive(link.href)
                    ? 'text-blue-600 dark:text-blue-400'
                    : 'text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400'
                }`}
              >
                {link.label}
                {isActive(link.href) && (
                  <span className="absolute inset-x-0 bottom-0 h-0.5 bg-blue-600" />
                )}
              </Link>
            ))}
          </div>

          {/* Right side - Account/Logout */}
          <div className="ml-auto flex items-center gap-6">
            <Link
              href="/"
              onClick={() => logout()}
              className="text-sm text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 font-medium transition-colors"
            >
              Sign Out
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
} 