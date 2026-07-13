'use client';

import { useState, useEffect } from 'react';
import { BarChart3, ShoppingBag, CreditCard, ShieldAlert, Award } from 'lucide-react';

export default function ReportesPage() {
  const [periodo, setPeriodo] = useState('mes');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadReportData = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/tenant/reportes?periodo=${periodo}`);
      if (!res.ok) {
        throw new Error('Error al cargar datos del reporte.');
      }
      const reportData = await res.json();
      setData(reportData);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReportData();
  }, [periodo]);

  if (loading) {
    return <p style={{ color: 'var(--text-muted)' }}>Cargando analíticas comerciales...</p>;
  }

  // Find max payment method value to calculate percentage width
  const maxPaymentMethodValue = data?.paymentMethods?.reduce((max: number, curr: any) => Math.max(max, curr.total), 0) || 1;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h2 style={{ fontSize: '1.75rem', marginBottom: '0.25rem' }}>Reportes Estadísticos</h2>
          <p style={{ color: 'var(--text-muted)' }}>Analizá la facturación, los productos estrella y los saldos adeudados.</p>
        </div>
        
        {/* Period Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Período:</span>
          <select
            className="form-select"
            style={{ width: '180px', padding: '0.5rem 0.75rem' }}
            value={periodo}
            onChange={(e) => setPeriodo(e.target.value)}
          >
            <option value="dia">Hoy</option>
            <option value="semana">Últimos 7 días</option>
            <option value="mes">Últimos 30 días</option>
            <option value="todos">Historial Completo</option>
          </select>
        </div>
      </div>

      {error && (
        <div style={{ padding: '1rem', backgroundColor: '#fee2e2', color: '#b91c1c', borderRadius: 'var(--radius-md)', marginBottom: '1.5rem' }}>
          ⚠️ {error}
        </div>
      )}

      {/* Main KPI Stats row */}
      <div className="grid-stats">
        <div className="card stat-card">
          <div className="stat-icon" style={{ backgroundColor: 'var(--primary-light)', color: 'var(--primary)' }}>
            <BarChart3 size={24} />
          </div>
          <div className="stat-info">
            <span className="stat-label">Total Ventas</span>
            <span className="stat-value">${data?.stats?.totalVentas.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>IVA Incluido</span>
          </div>
        </div>

        <div className="card stat-card">
          <div className="stat-icon" style={{ backgroundColor: '#ecfdf5', color: '#059669' }}>
            <ShoppingBag size={24} />
          </div>
          <div className="stat-info">
            <span className="stat-label">Comprobantes</span>
            <span className="stat-value">{data?.stats?.cantidadVentas || 0}</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Emitidos y Aprobados</span>
          </div>
        </div>

        <div className="card stat-card">
          <div className="stat-icon" style={{ backgroundColor: 'var(--accent-light)', color: 'var(--secondary)' }}>
            <CreditCard size={24} />
          </div>
          <div className="stat-info">
            <span className="stat-label">IVA Recaudado</span>
            <span className="stat-value">${data?.stats?.totalIva.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Desglose fiscal</span>
          </div>
        </div>
      </div>

      {/* Analytics details */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginTop: '2rem' }}>
        
        {/* BEST SELLING PRODUCTS */}
        <div className="card">
          <h3 style={{ marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Award size={20} style={{ color: 'var(--primary)' }} />
            <span>Productos Más Vendidos</span>
          </h3>

          <div className="table-container" style={{ border: 'none', boxShadow: 'none', margin: 0 }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th style={{ textAlign: 'right' }}>Cantidad</th>
                  <th style={{ textAlign: 'right' }}>Facturado</th>
                </tr>
              </thead>
              <tbody>
                {data?.bestSellers.map((prod: any) => (
                  <tr key={prod.id}>
                    <td style={{ fontWeight: 600 }}>{prod.nombre}</td>
                    <td style={{ textAlign: 'right' }}>{prod.cantidad}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--primary)' }}>
                      ${prod.total.toLocaleString('es-AR')}
                    </td>
                  </tr>
                ))}
                {data?.bestSellers.length === 0 && (
                  <tr>
                    <td colSpan={3} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                      No hay ventas en este período para clasificar.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* PAYMENT METHODS DISTRIBUTION */}
        <div className="card">
          <h3 style={{ marginBottom: '1.25rem' }}>Distribución de Formas de Pago</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', padding: '0.5rem 0' }}>
            {data?.paymentMethods.map((pm: any) => {
              const pct = (pm.total / maxPaymentMethodValue) * 100;
              return (
                <div key={pm.metodo}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem', fontSize: '0.95rem' }}>
                    <span style={{ fontWeight: 500 }}>{pm.metodo}</span>
                    <strong>${pm.total.toLocaleString('es-AR')}</strong>
                  </div>
                  {/* CSS Visual Bar */}
                  <div style={{ width: '100%', height: '12px', backgroundColor: 'var(--bg-tertiary)', borderRadius: '99px', overflow: 'hidden' }}>
                    <div style={{
                      width: `${pct}%`,
                      height: '100%',
                      backgroundColor: pm.metodo === 'Cuenta Corriente' ? '#ef4444' : 'var(--primary)',
                      borderRadius: '99px'
                    }} />
                  </div>
                </div>
              );
            })}
            {data?.paymentMethods.length === 0 && (
              <p style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                No se registran transacciones cobradas en este período.
              </p>
            )}
          </div>
        </div>

        {/* DEBTOR CLIENTS LIST */}
        <div className="card" style={{ gridColumn: '1 / -1' }}>
          <h3 style={{ marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ShieldAlert size={20} style={{ color: '#ef4444' }} />
            <span>Clientes con Mayor Saldo Deudor (Cuentas Corrientes)</span>
          </h3>

          <div className="table-container" style={{ border: 'none', boxShadow: 'none', margin: 0 }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Identificación</th>
                  <th style={{ textAlign: 'right' }}>Deuda Pendiente</th>
                  <th style={{ textAlign: 'center' }}>Acción</th>
                </tr>
              </thead>
              <tbody>
                {data?.debtors.map((c: any) => (
                  <tr key={c.id}>
                    <td style={{ fontWeight: 600 }}>{c.razonSocial}</td>
                    <td><code>{c.nroDoc}</code></td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: '#ef4444' }}>
                      ${c.saldo.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <a href={`/dashboard/cuentas-corrientes?clienteId=${c.id}`} className="btn btn-secondary btn-sm" style={{ padding: '0.35rem 0.65rem' }}>
                        Ver Cuenta
                      </a>
                    </td>
                  </tr>
                ))}
                {data?.debtors.length === 0 && (
                  <tr>
                    <td colSpan={4} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                      🎉 ¡Perfecto! No tenés clientes con saldo deudor actualmente.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
