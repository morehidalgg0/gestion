'use client';

import { useState, useEffect } from 'react';
import { Wallet, TrendingUp, TrendingDown, Percent, PiggyBank, Banknote, Landmark, HandCoins, RefreshCw } from 'lucide-react';

function formatMoney(value: number) {
  return value.toLocaleString('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 2,
  });
}

// Category color mapping
const CATEGORY_COLORS: Record<string, string> = {
  'Costo de mercadería': '#2563eb',
  'Sueldos': '#8b5cf6',
  'Alquiler': '#ef4444',
  'Servicios': '#f59e0b',
  'Impuestos': '#dc2626',
  'Proveedor': '#0891b2',
  'Retiro de caja': '#f97316',
  'Seguros': '#10b981',
  'Publicidad': '#ec4899',
  'Otro': '#64748b',
};

const DEFAULT_COLOR = '#64748b';

export default function RentabilidadPage() {
  const [periodo, setPeriodo] = useState('mes');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Custom range
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      let url = `/api/tenant/rentabilidad?periodo=${periodo}`;
      if (periodo === 'personalizado' && desde && hasta) {
        url = `/api/tenant/rentabilidad?periodo=personalizado&desde=${desde}&hasta=${hasta}`;
      }
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error('Error al calcular la rentabilidad.');
      }
      const d = await res.json();
      setData(d);
    } catch (err: any) {
      setError(err.message || 'Ocurrió un error.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodo]);

  const isPositive = (data?.gananciaReal ?? 0) >= 0;

  const formatDateRange = (rango?: any) => {
    if (!rango) return '';
    const desdeVal = new Date(rango.desde).toLocaleDateString('es-AR');
    const hastaVal = new Date(rango.hasta).toLocaleDateString('es-AR');
    if (desdeVal === hastaVal) return desdeVal;
    return `${desdeVal} — ${hastaVal}`;
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap', marginBottom: '2rem' }}>
        <div>
          <h2 style={{ fontSize: '1.75rem', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Wallet size={26} style={{ color: 'var(--primary)' }} />
            <span>Ganancia Real</span>
          </h2>
          <p style={{ color: 'var(--text-muted)' }}>
            Ingresos por ventas menos <strong>todos</strong> los gastos (sueldos, alquiler, mercadería, servicios, impuestos) para saber si tu negocio es rentable.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <select
            className="form-select"
            style={{ width: '190px', padding: '0.5rem 0.75rem' }}
            value={periodo}
            onChange={(e) => setPeriodo(e.target.value)}
          >
            <option value="hoy">Hoy</option>
            <option value="semana">Últimos 7 días</option>
            <option value="mes">Últimos 30 días</option>
            <option value="trimestre">Últimos 90 días</option>
            <option value="todos">Historial Completo</option>
            <option value="personalizado">Personalizado...</option>
          </select>
          <button onClick={loadData} className="btn btn-secondary btn-sm" title="Actualizar">
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      {periodo === 'personalizado' && (
        <div className="card" style={{ marginBottom: '1.5rem', padding: '1rem', display: 'flex', alignItems: 'flex-end', gap: '1rem', flexWrap: 'wrap' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Desde</label>
            <input className="form-input" type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Hasta</label>
            <input className="form-input" type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
          </div>
          <button className="btn btn-primary" disabled={!desde || !hasta} onClick={loadData}>
            Calcular
          </button>
        </div>
      )}

      {error && (
        <div style={{ padding: '1rem', backgroundColor: '#fee2e2', color: '#b91c1c', borderRadius: 'var(--radius-md)', marginBottom: '1.5rem' }}>
          ⚠️ {error}
        </div>
      )}

      {loading ? (
        <p style={{ color: 'var(--text-muted)' }}>Calculando rentabilidad...</p>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid-stats">
            <div className="card stat-card">
              <div className="stat-icon" style={{ backgroundColor: '#dcfce7', color: '#15803d' }}>
                <TrendingUp size={24} />
              </div>
              <div className="stat-info">
                <span className="stat-label">Ingresos por ventas</span>
                <span className="stat-value" style={{ color: '#15803d' }}>{formatMoney(data?.ingresos ?? 0)}</span>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>{formatDateRange(data?.rango)}</span>
              </div>
            </div>

            <div className="card stat-card">
              <div className="stat-icon" style={{ backgroundColor: '#fee2e2', color: '#b91c1c' }}>
                <TrendingDown size={24} />
              </div>
              <div className="stat-info">
                <span className="stat-label">Total gastos</span>
                <span className="stat-value" style={{ color: '#b91c1c' }}>-{formatMoney(data?.egresos?.total ?? 0)}</span>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                  Fijos: {formatMoney(data?.egresos?.fijos ?? 0)} · Variados: {formatMoney(data?.egresos?.variados ?? 0)}
                </span>
              </div>
            </div>

            <div className="card stat-card">
              <div className="stat-icon" style={{ backgroundColor: isPositive ? '#dcfce7' : '#fee2e2', color: isPositive ? '#15803d' : '#b91c1c' }}>
                <PiggyBank size={24} />
              </div>
              <div className="stat-info">
                <span className="stat-label">Ganancia Real</span>
                <span className="stat-value" style={{ color: isPositive ? '#15803d' : '#b91c1c' }}>
                  {formatMoney(data?.gananciaReal ?? 0)}
                </span>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                  {isPositive ? 'Negocio rentable' : 'Pérdida en este período'}
                </span>
              </div>
            </div>

            <div className="card stat-card">
              <div className="stat-icon" style={{ backgroundColor: '#eff6ff', color: '#2563eb' }}>
                <Percent size={24} />
              </div>
              <div className="stat-info">
                <span className="stat-label">Margen de ganancia</span>
                <span className="stat-value" style={{ color: isPositive ? '#2563eb' : '#b91c1c' }}>
                  {(data?.margen ?? 0).toFixed(1)}%
                </span>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                  {data?.ingresos > 0 ? 'sobre ingresos' : 'sin ingresos'}
                </span>
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '1.5rem', alignItems: 'start' }} className="rentabilidad-grid">
            {/* Breakdown by category */}
            <div className="card">
              <div className="card-header">
                <h3 style={{ fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <HandCoins size={18} style={{ color: 'var(--primary)' }} />
                  Gastos por categoría
                </h3>
              </div>
              {(data?.desgloseEgresos?.length ?? 0) === 0 ? (
                <p style={{ color: 'var(--text-muted)', padding: '1rem 0' }}>No hay gastos registrados en este período.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                  {data.desgloseEgresos.map((item: any) => {
                    const color = CATEGORY_COLORS[item.categoria] || DEFAULT_COLOR;
                    const max = data.desgloseEgresos[0].monto;
                    return (
                      <div key={item.categoria}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem', fontSize: '0.9rem' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <span style={{ width: '10px', height: '10px', borderRadius: '2px', backgroundColor: color, display: 'inline-block' }} />
                            <strong>{item.categoria}</strong>
                          </span>
                          <span>
                            {formatMoney(item.monto)}
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}> ({item.porcentaje.toFixed(1)}%)</span>
                          </span>
                        </div>
                        <div style={{ height: '8px', backgroundColor: 'var(--bg-tertiary)', borderRadius: '4px', overflow: 'hidden' }}>
                          <div style={{ width: `${Math.max(2, (item.monto / max) * 100)}%`, height: '100%', backgroundColor: color, borderRadius: '4px' }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Ingresos por forma de pago */}
            <div className="card">
              <div className="card-header">
                <h3 style={{ fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Banknote size={18} style={{ color: 'var(--primary)' }} />
                  Ingresos por forma de pago
                </h3>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', fontSize: '0.95rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>💵 Efectivo</span>
                  <strong>{formatMoney(data?.ventas?.efectivo ?? 0)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>💳 Tarjeta</span>
                  <strong>{formatMoney(data?.ventas?.tarjeta ?? 0)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>📱 Transferencia</span>
                  <strong>{formatMoney(data?.ventas?.transferencia ?? 0)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>⚖️ Cuenta Corriente</span>
                  <strong>{formatMoney(data?.ventas?.cuentaCorriente ?? 0)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-color)', paddingTop: '0.6rem', marginTop: '0.4rem' }}>
                  <strong>Total ingresos</strong>
                  <strong style={{ color: '#15803d', fontSize: '1.05rem' }}>{formatMoney(data?.ingresos ?? 0)}</strong>
                </div>
              </div>
            </div>
          </div>

          {/* Summary note */}
          <div className="card" style={{ marginTop: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem', borderLeft: '4px solid var(--primary)' }}>
            <Landmark size={20} style={{ color: 'var(--primary)', flex: '0 0 auto' }} />
            <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
              <strong style={{ color: 'var(--text-main)' }}>¿Cómo se calcula?</strong> Ganancia Real = Ingresos por ventas − Total de egresos (sueldos, alquiler, mercadería, servicios, impuestos y demás gastos registrados en la sección <strong>Egresos</strong>). Registrá todos tus gastos allí para que este número sea preciso.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
