'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import SidebarTenant from '@/components/SidebarTenant';
import Navbar from '@/components/Navbar';
import Link from 'next/link';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState(false);
  const [session, setSession] = useState<any>(null);
  const router = useRouter();

  useEffect(() => {
    async function checkSession() {
      try {
        const res = await fetch('/api/auth/session');
        const data = await res.json();
        
        if (!data.authenticated) {
          router.push('/login');
          return;
        }

        const user = data.user;
        setSession(user);

        // Blocker: If company is not active, redirect to checkout/payment
        if (user.rol !== 'SUPERADMIN' && user.empresa?.estado !== 'ACTIVO') {
          router.push('/checkout');
          return;
        }

        setActive(true);
      } catch (err) {
        console.error('Error checking session in dashboard layout:', err);
        router.push('/login');
      } finally {
        setLoading(false);
      }
    }
    checkSession();
  }, [router]);

  if (loading) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-primary)' }}>
        <p style={{ fontSize: '1.25rem', color: 'var(--text-muted)' }}>Cargando panel de control...</p>
      </div>
    );
  }

  if (!active) return null;

  return (
    <div className="main-layout">
      {/* Sidebar navigation */}
      <SidebarTenant />

      {/* Main content viewport */}
      <div className="content-area">
        {/* We pass a placeholder title. Individual pages can use custom headers if needed. */}
        <Navbar title="Panel de Gestión" />
        
        <main className="container" style={{ flex: 1, overflowY: 'auto' }}>
          {children}
        </main>
      </div>
    </div>
  );
}
