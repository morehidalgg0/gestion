'use client';

import { useState, useEffect } from 'react';
import { Shield, HelpCircle, Activity } from 'lucide-react';

interface NavbarProps {
  title: string;
}

export default function Navbar({ title }: NavbarProps) {
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
        console.error('Error fetching session in navbar:', err);
      }
    }
    fetchSession();
  }, []);

  const renderAfipBadge = () => {
    if (!session || session.rol === 'SUPERADMIN') return null;

    const config = session.empresa?.configAfip;
    
    if (!config || !config.hasCert) {
      return (
        <span className="badge badge-warning" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
          <HelpCircle size={14} />
          <span>AFIP: NO CONFIGURADO (DEMO INTERNA)</span>
        </span>
      );
    }

    if (config.modo === 'demo') {
      return (
        <span className="badge badge-warning" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
          <HelpCircle size={14} />
          <span>AFIP: MODO DEMO</span>
        </span>
      );
    }

    if (config.modo === 'homologacion') {
      return (
        <span className="badge badge-info" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
          <Activity size={14} />
          <span>AFIP: HOMOLOGACIÓN (TESTING)</span>
        </span>
      );
    }

    if (config.modo === 'produccion') {
      return (
        <span className="badge badge-success" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
          <Activity size={14} />
          <span>AFIP: PRODUCCIÓN (REAL)</span>
        </span>
      );
    }

    return null;
  };

  return (
    <header className="navbar">
      <div className="navbar-title">{title}</div>
      <div className="navbar-actions">
        {session?.empresa?.nombre && (
          <span style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-muted)' }}>
            🏪 {session.empresa.nombre}
          </span>
        )}
        {renderAfipBadge()}
      </div>
    </header>
  );
}
