'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { KeyRound, Building2, SlidersHorizontal, LogOut } from 'lucide-react';

const links = [
  { href: '/root/empresas', label: 'Empresas y Sucursales', icon: Building2 },
  { href: '/root/planes', label: 'Planes y Límites', icon: SlidersHorizontal },
];

export default function SidebarRoot() {
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
        console.error('Error fetching session in root sidebar:', err);
      }
    }
    fetchSession();
  }, []);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  };

  return (
    <aside className="sidebar" style={{ borderRight: '2px solid #7c3aed' }}>
      <div className="sidebar-logo" style={{ color: '#7c3aed' }}>
        <KeyRound size={18} style={{ marginRight: '0.4rem' }} />
        Kontia Root
      </div>

      <nav className="sidebar-nav">
        {links.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={`sidebar-link ${pathname === href ? 'active' : ''}`}
            style={{
              backgroundColor: pathname === href ? '#7c3aed' : undefined,
              color: pathname === href ? '#ffffff' : undefined,
            }}
          >
            <Icon size={18} />
            <span>{label}</span>
          </Link>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="user-profile-summary">
          <span className="user-profile-name">{session?.nombre || 'Root'}</span>
          <span className="user-profile-role" style={{ color: '#7c3aed' }}>
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
