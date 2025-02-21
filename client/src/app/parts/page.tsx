'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function PartsPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to the parts catalog by default
    router.push('/parts/inventory');
  }, [router]);

  return null;
} 