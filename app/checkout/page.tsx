'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function CheckoutPage() {
  const [session, setSession] = useState<any>(null);
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  useEffect(() => {
    async function loadData() {
      try {
        // Load Session
        const sessionRes = await fetch('/api/auth/session');
        const sessionData = await sessionRes.json();
        
        if (!sessionData.authenticated) {
          router.push('/login');
          return;
        }

        setSession(sessionData.user);

        // If they already have an active subscription, redirect to dashboard
        if (sessionData.user?.empresa?.estado === 'ACTIVO') {
          router.push('/dashboard');
          return;
        }

        // Load Plans
        const plansRes = await fetch('/api/planes');
        const plansData = await plansRes.json();
        setPlans(Array.isArray(plansData) ? plansData : []);
      } catch (err: any) {
        setError('Error al cargar planes. Intentá recargar la página.');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [router]);

  const handleSelectPlan = async (planId: string) => {
    setSubmitting(true);
    setError('');

    try {
      const response = await fetch('/api/checkout/create-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'No se pudo iniciar el proceso de suscripción.');
      }

      // Redirect to checkout URL (Mercado Pago or local mock demo page)
      window.location.href = data.checkoutUrl;
    } catch (err: any) {
      setError(err.message);
      setSubmitting(false);
    }
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-primary)' }}>
        <p style={{ fontSize: '1.25rem', color: 'var(--text-muted)' }}>Cargando planes de suscripción...</p>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg-primary)', display: 'flex', flexDirection: 'column' }}>
      {/* Top Navbar */}
      <header className="navbar" style={{ padding: '0 3rem' }}>
        <div className="sidebar-logo" style={{ marginBottom: 0, borderBottom: 'none', paddingBottom: 0 }}>
          🌿 DietéticaSaaS
        </div>
        <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
          <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
            Empresa: <strong>{session?.empresa?.nombre}</strong> ({session?.nombre})
          </span>
          <button onClick={handleLogout} className="btn btn-secondary btn-sm">
            Cerrar Sesión
          </button>
        </div>
      </header>

      {/* Main content */}
      <main style={{ flex: 1, padding: '3rem 2rem' }}>
        <div className="container" style={{ maxWidth: '900px' }}>
          <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
            <h1 style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>Elegí tu Plan de Suscripción</h1>
            <p style={{ fontSize: '1.1rem', color: 'var(--text-muted)' }}>
              Para activar tu cuenta y acceder a las herramientas de venta y facturación, por favor suscribite a uno de nuestros planes comerciales.
            </p>
          </div>

          {error && (
            <div style={{
              padding: '1rem',
              backgroundColor: '#fee2e2',
              color: '#b91c1c',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.95rem',
              fontWeight: 500,
              marginBottom: '2rem',
              borderLeft: '4px solid #ef4444'
            }}>
              ⚠️ {error}
            </div>
          )}

          {/* Plans grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '2rem' }}>
            {plans.map((plan: any) => {
              const isFree = parseFloat(plan.precioMensual) === 0;
              const isBasic = plan.nombre === 'Básico';

              return (
                <div
                  key={plan.id}
                  className="card"
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    padding: '2rem',
                    border: isBasic ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                    position: 'relative'
                  }}
                >
                  {isBasic && (
                    <span className="badge badge-success" style={{ position: 'absolute', top: '1rem', right: '1rem' }}>
                      Recomendado
                    </span>
                  )}
                  <h3 style={{ fontSize: '1.35rem', marginBottom: '0.5rem' }}>Plan {plan.nombre}</h3>
                  <div style={{ margin: '1rem 0' }}>
                    <span style={{ fontSize: '2rem', fontWeight: 700 }}>
                      ${parseFloat(plan.precioMensual).toLocaleString('es-AR')}
                    </span>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                      {isFree ? ' / 14 días gratis' : ' / mes'}
                    </span>
                  </div>
                  
                  <ul style={{
                    listStyle: 'none',
                    padding: 0,
                    margin: '1.5rem 0 2rem 0',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.6rem',
                    fontSize: '0.95rem'
                  }}>
                    <li>
                      ✔️ {plan.limiteVentasMensuales > 0 ? (
                        <><strong>{plan.limiteVentasMensuales} ventas</strong> al mes</>
                      ) : (
                        <strong>Ventas ilimitadas</strong>
                      )}
                    </li>
                    <li>
                      ✔️ Hasta <strong>{plan.limiteUsuarios} usuarios</strong> de personal
                    </li>
                    <li>
                      ✔️ Facturación Electrónica AFIP
                    </li>
                    <li>
                      ✔️ Cuentas corrientes (fiado)
                    </li>
                    <li>
                      ✔️ Control de stock y alertas
                    </li>
                  </ul>

                  <button
                    onClick={() => handleSelectPlan(plan.id)}
                    className={`btn ${isBasic ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ marginTop: 'auto', width: '100%' }}
                    disabled={submitting}
                  >
                    {submitting ? 'Cargando pasarela...' : isFree ? 'Iniciar Prueba' : 'Suscribirme'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </main>

      <footer style={{ padding: '2rem', textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-muted)', borderTop: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)' }}>
        Plataforma SaaS Dietética. Pagos procesados de forma segura mediante Mercado Pago.
      </footer>
    </div>
  );
}
