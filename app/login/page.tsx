'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Algo salió mal al intentar iniciar sesión.');
      }

      const user = data.user;
      
      // Role redirection
      if (user.rol === 'SUPERADMIN') {
        router.push('/superadmin');
      } else {
        // For merchants, check payment status
        if (user.empresa?.estado === 'PENDIENTE_PAGO') {
          router.push('/checkout');
        } else {
          router.push('/dashboard');
        }
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      {/* Visual panel */}
      <div className="auth-sidebar">
        <h1 className="auth-sidebar-title">Gestión Inteligente para tu Comercio</h1>
        <p className="auth-sidebar-desc">
          Entrá al panel de control de tu comercio para facturar en segundos, ajustar stock, emitir comprobantes y controlar la caja diaria.
        </p>
      </div>

      {/* Form panel */}
      <div className="auth-content">
        <div className="auth-box">
          <div style={{ marginBottom: '2.5rem' }}>
            <h2 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>Iniciar Sesión</h2>
            <p style={{ color: 'var(--text-muted)' }}>Ingresá las credenciales para acceder al sistema.</p>
          </div>

          {error && (
            <div style={{
              padding: '1rem',
              backgroundColor: '#fee2e2',
              color: '#b91c1c',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.9rem',
              fontWeight: 500,
              marginBottom: '1.5rem',
              borderLeft: '4px solid #ef4444'
            }}>
              ⚠️ {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label" htmlFor="email">Correo Electrónico</label>
              <input
                id="email"
                type="email"
                className="form-input"
                placeholder="usuario@tucomercio.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
              />
            </div>

            <div className="form-group" style={{ marginBottom: '2rem' }}>
              <label className="form-label" htmlFor="password">Contraseña</label>
              <input
                id="password"
                type="password"
                className="form-input"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-lg"
              style={{ width: '100%', marginBottom: '1.5rem' }}
              disabled={loading}
            >
              {loading ? 'Validando...' : 'Entrar al Sistema'}
            </button>
          </form>

          <div style={{ textAlign: 'center', fontSize: '0.9rem' }}>
            <span style={{ color: 'var(--text-muted)' }}>¿No tenés una cuenta registrada? </span>
            <Link href="/registro" style={{ fontWeight: 600, color: 'var(--primary)' }}>
              Registrar mi Comercio
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
