'use client';

import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { usePathname } from 'next/navigation';

export default function Navbar() {
  const { user } = useAuth();
  const pathname = usePathname();

  // Hide this navbar when we're in the parts section
  if (pathname?.startsWith('/parts')) {
    return null;
  }

  return (
    <nav className="fixed w-full top-0 z-50 bg-white/70 dark:bg-slate-900/70 backdrop-blur-lg border-b border-slate-100 dark:border-slate-800">
      <div className="container mx-auto px-6">
        <div className="flex items-center justify-between h-20">
          {/* Logo */}
          <Link 
            href="/" 
            className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-transparent hover:from-blue-700 hover:to-blue-900 transition-all"
          >
            Gander Parts
          </Link>

          {/* Navigation Links */}
          <div className="flex items-center gap-6">
            {user ? (
              <Link
                href="/parts"
                className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-medium rounded-full shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30 transition-all duration-200"
              >
                Manage Orders
              </Link>
            ) : (
              <Link
                href="/login"
                className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-medium rounded-full shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30 transition-all duration-200"
              >
                Login
              </Link>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
} 