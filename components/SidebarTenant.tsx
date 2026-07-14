'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ShoppingCart, Package, Users, DollarSign, Settings, BarChart2, LogOut, ShieldAlert, ReceiptText } from 'lucide-react';

export default function SidebarTenant() {
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
        console.error('Error fetching session in sidebar:', err);
      }
    }
    fetchSession();
  }, []);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  };

  const navItems = [
    { name: 'Punto de Venta (POS)', href: '/dashboard/ventas', icon: ShoppingCart },
    { name: 'Comprobantes', href: '/dashboard/comprobantes', icon: ReceiptText },
    { name: 'Productos / Stock', href: '/dashboard/productos', icon: Package, ownerOnly: true },
    { name: 'Clientes', href: '/dashboard/clientes', icon: Users, ownerOnly: true },
    { name: 'Cuentas Corrientes', href: '/dashboard/cuentas-corrientes', icon: DollarSign, ownerOnly: true },
    { name: 'Configuración AFIP', href: '/dashboard/config-afip', icon: Settings, ownerOnly: true },
    { name: 'Reportes', href: '/dashboard/reportes', icon: BarChart2, ownerOnly: true },
    { name: 'Personal / Caja', href: '/dashboard/usuarios', icon: ShieldAlert, ownerOnly: true },
  ];

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        🌿 DietéticaSaaS
      </div>

      <nav className="sidebar-nav">
        {navItems.filter((item) => !item.ownerOnly || session?.rol === 'OWNER').map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`sidebar-link ${isActive ? 'active' : ''}`}
            >
              <Icon size={18} />
              <span>{item.name}</span>
            </Link>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        <div className="user-profile-summary">
          <span className="user-profile-name">{session?.nombre || 'Cargando...'}</span>
          <span className="user-profile-role">{session?.rol}</span>
          {session?.empresa?.suscripcion && (
            <span style={{ fontSize: '0.7rem', color: 'var(--primary)', fontWeight: 600 }}>
              Plan: {session.empresa.suscripcion.plan}
            </span>
          )}
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
