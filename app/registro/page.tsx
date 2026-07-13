'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function RegisterPage() {
  const [razonSocial, setRazonSocial] = useState('');
  const [cuit, setCuit] = useState('');
  const [condicionIva, setCondicionIva] = useState('Responsable Inscripto');
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // Basic validation
    const cleanCuit = cuit.replace(/\D/g, '');
    if (cleanCuit.length !== 11) {
      setError('El CUIT debe contener exactamente 11 dígitos.');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cuit: cleanCuit,
          razonSocial,
          condicionIva,
          nombre,
          email,
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Ocurrió un error al procesar tu registro.');
      }

      // Automatically logged in by route handler setting cookie.
      // Redirect directly to plan selection and checkout
      router.push('/checkout');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      {/* Visual sidebar */}
      <div className="auth-sidebar">
        <h1 className="auth-sidebar-title">Digitalizá tu Mostrador Hoy Mismo</h1>
        <p className="auth-sidebar-desc">
          Unite a los cientos de comercios en Argentina que optimizan sus ventas, controlan sus cuentas corrientes de clientes y emiten facturas oficiales sin perder tiempo.
        </p>
      </div>

      {/* Form panel */}
      <div className="auth-content" style={{ padding: '2rem' }}>
        <div className="auth-box" style={{ maxWidth: '500px' }}>
          <div style={{ marginBottom: '2rem' }}>
            <h2 style={{ fontSize: '1.75rem', marginBottom: '0.25rem' }}>Registrar Comercio</h2>
            <p style={{ color: 'var(--text-muted)' }}>Creá tu cuenta de plataforma en 1 minuto.</p>
          </div>

          {error && (
            <div style={{
              padding: '0.85rem',
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
            <h3 style={{ fontSize: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', marginBottom: '1rem', color: 'var(--primary)' }}>
              1. Datos Fiscales de la Empresa
            </h3>
            
            <div className="form-group">
              <label className="form-label" htmlFor="razonSocial">Razón Social o Nombre Fantasía</label>
              <input
                id="razonSocial"
                type="text"
                className="form-input"
                placeholder="Dietética La Semilla S.H."
                value={razonSocial}
                onChange={(e) => setRazonSocial(e.target.value)}
                required
                disabled={loading}
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label" htmlFor="cuit">CUIT (sin guiones)</label>
                <input
                  id="cuit"
                  type="text"
                  className="form-input"
                  placeholder="20123456789"
                  maxLength={11}
                  value={cuit}
                  onChange={(e) => setCuit(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="condicionIva">Condición frente al IVA</label>
                <select
                  id="condicionIva"
                  className="form-select"
                  value={condicionIva}
                  onChange={(e) => setCondicionIva(e.target.value)}
                  disabled={loading}
                >
                  <option value="Responsable Inscripto">Responsable Inscripto</option>
                  <option value="Monotributista">Monotributista</option>
                </select>
              </div>
            </div>

            <h3 style={{ fontSize: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', marginBottom: '1rem', marginTop: '1.5rem', color: 'var(--primary)' }}>
              2. Datos del Administrador / Dueño
            </h3>

            <div className="form-group">
              <label className="form-label" htmlFor="nombre">Nombre Completo</label>
              <input
                id="nombre"
                type="text"
                className="form-input"
                placeholder="Juan Pérez"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                required
                disabled={loading}
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label" htmlFor="email">Correo Electrónico</label>
                <input
                  id="email"
                  type="email"
                  className="form-input"
                  placeholder="juan@dietetica.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="password">Contraseña</label>
                <input
                  id="password"
                  type="password"
                  className="form-input"
                  placeholder="Mínimo 6 caracteres"
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-lg"
              style={{ width: '100%', marginTop: '1.5rem', marginBottom: '1rem' }}
              disabled={loading}
            >
              {loading ? 'Creando comercio...' : 'Registrar y Continuar'}
            </button>
          </form>

          <div style={{ textAlign: 'center', fontSize: '0.9rem' }}>
            <span style={{ color: 'var(--text-muted)' }}>¿Ya tenés una cuenta? </span>
            <Link href="/login" style={{ fontWeight: 600, color: 'var(--primary)' }}>
              Iniciar Sesión
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
