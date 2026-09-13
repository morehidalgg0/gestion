'use client';

import { useState, useEffect } from 'react';
import { Save } from 'lucide-react';

export default function RootPlanesPage() {
  const [planes, setPlanes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  const loadData = async () => {
    try {
      const res = await fetch('/api/root/planes');
      const data = await res.json();
      setPlanes(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load planes:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const updateField = (id: string, field: string, value: string) => {
    setPlanes((prev) => prev.map((p) => (p.id === id ? { ...p, [field]: value } : p)));
  };

  const handleSave = async (plan: any) => {
    setSavingId(plan.id);
    setErrorMsg('');
    try {
      const res = await fetch('/api/root/planes', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: plan.id,
          nombre: plan.nombre,
          precioMensual: parseFloat(plan.precioMensual),
          limiteVentasMensuales: parseInt(plan.limiteVentasMensuales, 10),
          limiteUsuarios: parseInt(plan.limiteUsuarios, 10),
          limiteSucursales: parseInt(plan.limiteSucursales, 10),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'No se pudo guardar el plan.');
      await loadData();
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div>
      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.75rem', marginBottom: '0.25rem' }}>Planes y Límites</h2>
        <p style={{ color: 'var(--text-muted)' }}>
          Ajustá cuánto puede crecer cada cliente según su plan (usuarios, ventas mensuales y sucursales) sin
          tocar código. Usá 0 para indicar "sin límite" donde aplique.
        </p>
      </div>

      {errorMsg && (
        <div style={{ padding: '0.75rem', backgroundColor: '#fee2e2', color: '#b91c1c', borderRadius: 'var(--radius-sm)', marginBottom: '1rem', fontSize: '0.9rem' }}>
          ⚠️ {errorMsg}
        </div>
      )}

      {loading ? (
        <p style={{ color: 'var(--text-muted)' }}>Cargando planes...</p>
      ) : (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Plan</th>
                <th>Precio Mensual ($)</th>
                <th>Límite Usuarios</th>
                <th>Límite Ventas/Mes</th>
                <th>Límite Sucursales</th>
                <th style={{ textAlign: 'center' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {planes.map((plan) => (
                <tr key={plan.id}>
                  <td>
                    <input
                      type="text"
                      className="form-input"
                      value={plan.nombre}
                      onChange={(e) => updateField(plan.id, 'nombre', e.target.value)}
                      style={{ minWidth: '110px' }}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      step="0.01"
                      className="form-input"
                      value={plan.precioMensual}
                      onChange={(e) => updateField(plan.id, 'precioMensual', e.target.value)}
                      style={{ minWidth: '110px' }}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      className="form-input"
                      value={plan.limiteUsuarios}
                      onChange={(e) => updateField(plan.id, 'limiteUsuarios', e.target.value)}
                      style={{ minWidth: '90px' }}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      className="form-input"
                      value={plan.limiteVentasMensuales}
                      onChange={(e) => updateField(plan.id, 'limiteVentasMensuales', e.target.value)}
                      style={{ minWidth: '90px' }}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      className="form-input"
                      value={plan.limiteSucursales}
                      onChange={(e) => updateField(plan.id, 'limiteSucursales', e.target.value)}
                      style={{ minWidth: '90px' }}
                    />
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <button
                      onClick={() => handleSave(plan)}
                      className="btn btn-primary btn-sm"
                      disabled={savingId === plan.id}
                      style={{ padding: '0.35rem 0.65rem' }}
                    >
                      <Save size={14} />
                      <span>{savingId === plan.id ? 'Guardando...' : 'Guardar'}</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
