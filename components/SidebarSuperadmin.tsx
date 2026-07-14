'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Shield, LayoutDashboard, LogOut } from 'lucide-react';

export default function SidebarSuperadmin() {
  const pathname = usePathname();
  const router = useRouter();
  const [session, setSession] = useState<any>(null);

  useEffect(() => {
    async function fetchSession() {
      try {
        const res = await fetch('/api/auth/session');
        const data = await res.json();
        if (data.authenticated) {
          setSession(data.user);
        }
      } catch (err) {
        console.error('Error fetching session in superadmin sidebar:', err);
      }
    }
    fetchSession();
  }, []);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  };

  return (
    <aside className="sidebar" style={{ borderRight: '2px solid #ef4444' }}>
      <div className="sidebar-logo" style={{ color: '#ef4444' }}>
        ◼ ComercioPro Admin
      </div>

      <nav className="sidebar-nav">
        <Link
          href="/superadmin/empresas"
          className={`sidebar-link ${pathname === '/superadmin/empresas' ? 'active' : ''}`}
          style={{
            backgroundColor: pathname === '/superadmin/empresas' ? '#ef4444' : undefined,
            color: pathname === '/superadmin/empresas' ? '#ffffff' : undefined,
          }}
        >
          <LayoutDashboard size={18} />
          <span>Empresas / SaaS</span>
        </Link>
      </nav>

      <div className="sidebar-footer">
        <div className="user-profile-summary">
          <span className="user-profile-name">{session?.nombre || 'Superadmin'}</span>
          <span className="user-profile-role" style={{ color: '#ef4444' }}>
            {session?.rol}
          </span>
        </div>
        <button
          onClick={handleLogout}
          className="btn btn-secondary btn-sm"
          style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
        >
          <LogOut size={14} />
          <span>Cerrar Sesión</span>
        </button>
      </div>
    </aside>
  );
}
