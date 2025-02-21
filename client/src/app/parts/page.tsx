'use client';

import { useAuth } from '@/context/AuthContext';

export default function PartsPage() {
  return (
    <div className="min-h-screen pt-24 px-6">
      <div className="container mx-auto">
        <h1 className="text-3xl font-bold mb-6">Parts Management</h1>
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-6">
          <p className="text-slate-600 dark:text-slate-300">
            Welcome to the parts management dashboard. Select an option from the navigation above to get started.
          </p>
        </div>
      </div>
    </div>
  );
} 