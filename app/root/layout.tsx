'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import SidebarRoot from '@/components/SidebarRoot';
import Navbar from '@/components/Navbar';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const router = useRouter();

  useEffect(() => {
    async function checkAuth() {
      try {
        const res = await fetch('/api/auth/session');
        const data = await res.json();

        if (!data.authenticated) {
          router.push('/login');
          return;
        }

        if (data.session?.rol !== 'ROOT') {
          router.push('/login');
          return;
        }

        setAuthorized(true);
      } catch (err) {
        console.error('Error validating root credentials:', err);
        router.push('/login');
      } finally {
        setLoading(false);
      }
    }
    checkAuth();
  }, [router]);

  if (loading) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-primary)' }}>
        <p style={{ fontSize: '1.25rem', color: 'var(--text-muted)' }}>Cargando panel raíz...</p>
      </div>
    );
  }

  if (!authorized) return null;

  return (
    <div className="main-layout" style={{ borderLeft: '4px solid #7c3aed' }}>
      <SidebarRoot />

      <div className="content-area">
        <Navbar title="Panel Raíz — Plataforma" />

        <main className="container" style={{ flex: 1, overflowY: 'auto' }}>
          {children}
        </main>
      </div>
    </div>
  );
}
