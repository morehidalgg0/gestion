'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function DemoCheckoutContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const empresaId = searchParams.get('empresaId') || '';
  const email = searchParams.get('email') || '';
  const planNombre = searchParams.get('plan') || '';
  const precio = searchParams.get('precio') || '0';

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [plans, setPlans] = useState<any[]>([]);

  useEffect(() => {
    async function fetchPlans() {
      try {
        const res = await fetch('/api/planes');
        const data = await res.json();
        setPlans(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error('Error fetching plans in demo checkout:', err);
      }
    }
    fetchPlans();
  }, []);

  const handleSimulatePayment = async () => {
    setLoading(true);
    setError('');

    try {
      // Find the corresponding planId from name
      const matchingPlan = plans.find((p) => p.nombre === planNombre);
      if (!matchingPlan) {
        throw new Error(`Plan "${planNombre}" no encontrado en la base de datos.`);
      }

      // Call our webhook simulator endpoint
      const response = await fetch('/api/webhooks/mercadopago', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          isDemoTrigger: true,
          empresaId,
          planId: matchingPlan.id,
          status: 'authorized',
          preapprovalId: `demo-preapproval-${Math.floor(100000 + Math.random() * 900000)}`,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error al simular el webhook de pago.');
      }

      setSuccess(true);
      
      // Redirect to dashboard after 2.5 seconds
      setTimeout(() => {
        router.push('/dashboard');
      }, 2500);
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '500px', width: '100%' }}>
      {success ? (
        <div className="card" style={{ textAlign: 'center', padding: '3rem', borderColor: 'var(--primary)' }}>
          <div style={{ fontSize: '4rem', marginBottom: '1.5rem' }}>✅</div>
          <h2 style={{ color: 'var(--primary)', marginBottom: '1rem' }}>¡Pago Aprobado con Éxito!</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
            Hemos procesado tu suscripción ficticia para el Plan <strong>{planNombre}</strong>.
          </p>
          <p style={{ fontWeight: 500, fontSize: '0.9rem' }}>Redirigiéndote a tu panel de control...</p>
        </div>
      ) : (
        <div className="card" style={{ padding: '2.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
            <h2 style={{ fontSize: '1.25rem' }}>💳 Mercado Pago <span style={{ color: 'var(--primary)', fontWeight: 600 }}>Demo</span></h2>
            <span className="badge badge-warning">Modo Simulación</span>
          </div>

          <div style={{
            backgroundColor: 'var(--bg-tertiary)',
            padding: '1.25rem',
            borderRadius: 'var(--radius-md)',
            marginBottom: '1.5rem',
            fontSize: '0.95rem'
          }}>
            <p style={{ marginBottom: '0.5rem' }}>Concepto: <strong>Suscripción mensual - Plan {planNombre}</strong></p>
            <p style={{ marginBottom: '0.5rem' }}>Comercio: <strong>Dietética ID: {empresaId.substring(0, 8)}...</strong></p>
            <p style={{ marginBottom: '0.5rem' }}>Email del Pagador: <strong>{email}</strong></p>
            <p style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-main)', marginTop: '0.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '0.5rem' }}>
              Total: ${parseFloat(precio).toLocaleString('es-AR')} ARS
            </p>
          </div>

          {error && (
            <div style={{
              padding: '0.85rem',
              backgroundColor: '#fee2e2',
              color: '#b91c1c',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.9rem',
              fontWeight: 500,
              marginBottom: '1.5rem'
            }}>
              ⚠️ {error}
            </div>
          )}

          <div style={{
            fontSize: '0.85rem',
            color: 'var(--text-muted)',
            backgroundColor: 'var(--accent-light)',
            padding: '1rem',
            borderRadius: 'var(--radius-md)',
            marginBottom: '2rem',
            borderLeft: '4px solid var(--accent)'
          }}>
            ℹ️ Estás visualizando la pasarela de Mercado Pago simulada porque la plataforma está configurada con la variable de entorno <code>DEMO_MODE=true</code>.
          </div>

          <button
            onClick={handleSimulatePayment}
            className="btn btn-primary btn-lg"
            style={{ width: '100%', padding: '1rem' }}
            disabled={loading}
          >
            {loading ? 'Procesando simulación...' : 'Simular Pago Exitoso ($)'}
          </button>
        </div>
      )}
    </div>
  );
}

export default function DemoCheckoutPage() {
  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#f1efe9',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem'
    }}>
      <Suspense fallback={
        <div className="card" style={{ padding: '2rem', textAlign: 'center' }}>
          <p>Cargando simulación de pago...</p>
        </div>
      }>
        <DemoCheckoutContent />
      </Suspense>
    </div>
  );
}
