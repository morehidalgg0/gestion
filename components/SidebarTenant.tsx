'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ShoppingCart, Package, Users, DollarSign, Settings, BarChart2, LogOut, ShieldAlert, ReceiptText, ClipboardCheck, KeyRound } from 'lucide-react';

export default function SidebarTenant() {
  const pathname = usePathname();
  const router = useRouter();
  const [session, setSession] = useState<any>(null);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

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

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');
    setChangingPassword(true);

    try {
      const res = await fetch('/api/tenant/password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'No se pudo cambiar la contraseña.');
      }
      setCurrentPassword('');
      setNewPassword('');
      setPasswordSuccess('Contraseña actualizada correctamente.');
    } catch (err: any) {
      setPasswordError(err.message);
    } finally {
      setChangingPassword(false);
    }
  };

  const navItems = [
    { name: 'Punto de Venta (POS)', href: '/dashboard/ventas', icon: ShoppingCart },
    { name: 'Comprobantes', href: '/dashboard/comprobantes', icon: ReceiptText },
    { name: 'Cierre Z', href: '/dashboard/cierre-z', icon: ClipboardCheck },
    { name: 'Productos / Stock', href: '/dashboard/productos', icon: Package },
    { name: 'Clientes', href: '/dashboard/clientes', icon: Users, ownerOnly: true },
    { name: 'Cuentas Corrientes', href: '/dashboard/cuentas-corrientes', icon: DollarSign, ownerOnly: true },
    { name: 'Configuración AFIP', href: '/dashboard/config-afip', icon: Settings, ownerOnly: true },
    { name: 'Reportes', href: '/dashboard/reportes', icon: BarChart2, ownerOnly: true },
    { name: 'Personal / Caja', href: '/dashboard/usuarios', icon: ShieldAlert, ownerOnly: true },
  ];

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        ◼ ComercioPro
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
          onClick={() => setShowPasswordModal(true)}
          className="btn btn-secondary btn-sm"
          style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}
        >
          <KeyRound size={14} />
          <span>Cambiar Contraseña</span>
        </button>
        <button
          onClick={handleLogout}
          className="btn btn-secondary btn-sm"
          style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
        >
          <LogOut size={14} />
          <span>Cerrar Sesión</span>
        </button>
      </div>
      {showPasswordModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Cambiar Contraseña</h3>
              <button onClick={() => setShowPasswordModal(false)} className="btn btn-secondary btn-sm" style={{ padding: '0.25rem 0.5rem' }}>X</button>
            </div>
            <form onSubmit={handleChangePassword}>
              <div className="modal-body">
                {passwordError && <div style={{ padding: '0.75rem', backgroundColor: '#fee2e2', color: '#b91c1c', borderRadius: 'var(--radius-sm)', marginBottom: '1rem' }}>{passwordError}</div>}
                {passwordSuccess && <div style={{ padding: '0.75rem', backgroundColor: '#dcfce7', color: '#15803d', borderRadius: 'var(--radius-sm)', marginBottom: '1rem' }}>{passwordSuccess}</div>}
                <div className="form-group">
                  <label className="form-label">Contraseña actual</label>
                  <input type="password" className="form-input" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required disabled={changingPassword} />
                </div>
                <div className="form-group">
                  <label className="form-label">Nueva contraseña</label>
                  <input type="password" className="form-input" minLength={6} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required disabled={changingPassword} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" onClick={() => setShowPasswordModal(false)} className="btn btn-secondary" disabled={changingPassword}>Cerrar</button>
                <button type="submit" className="btn btn-primary" disabled={changingPassword}>{changingPassword ? 'Guardando...' : 'Guardar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </aside>
  );
}
