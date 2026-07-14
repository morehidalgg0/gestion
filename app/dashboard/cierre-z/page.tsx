'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Banknote, CalendarDays, CheckCircle2, ClipboardCheck, Printer, Save } from 'lucide-react';

type CierreZData = {
  id: string;
  fecha: string;
  montoInicial: number;
  facturadoTotal: number;
  efectivoNeto: number;
  totalCaja: number;
  cerrado: boolean;
  cerradoAt?: string | null;
  concepto: string;
  porFormaPago: Record<string, number>;
  cantidadComprobantes: number;
  ventas: Array<{
    id: string;
    fecha: string;
    tipoComprobante: string;
    puntoVenta: number;
    numeroComprobante: number;
    formaPago: string;
    total: number;
    signedTotal: number;
    cliente: string;
  }>;
};

function todayArgentina() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' });
}

function formatMoney(value: number) {
  return value.toLocaleString('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 2,
  });
}

function formatVoucherNumber(venta: CierreZData['ventas'][number]) {
  return `${venta.puntoVenta.toString().padStart(4, '0')}-${venta.numeroComprobante.toString().padStart(8, '0')}`;
}

export default function CierreZPage() {
  const [fecha, setFecha] = useState(todayArgentina());
  const [data, setData] = useState<CierreZData | null>(null);
  const [montoInicial, setMontoInicial] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [closing, setClosing] = useState(false);
  const [error, setError] = useState('');

  const loadCierre = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch(`/api/tenant/cierre-z?fecha=${fecha}`);
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'No se pudo cargar el cierre Z.');
      }

      setData(result);
      setMontoInicial(String(result.montoInicial));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCierre();
  }, [fecha]);

  const handleSaveMontoInicial = async () => {
    setSaving(true);
    setError('');

    try {
      const response = await fetch('/api/tenant/cierre-z', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fecha, montoInicial }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'No se pudo actualizar el monto inicial.');
      }

      await loadCierre();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleEmitirCierre = async () => {
    const confirmed = window.confirm('Vas a emitir el comprobante de Cierre Z del día. Una vez emitido, quedará guardado, se imprimirá y no se podrán registrar más ventas en esta jornada. ¿Continuar?');
    if (!confirmed) return;

    setClosing(true);
    setError('');

    try {
      const response = await fetch('/api/tenant/cierre-z', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fecha }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'No se pudo emitir el cierre Z.');
      }
      setData(result);
      setMontoInicial(String(result.montoInicial));
      window.open(`/dashboard/cierre-z/${result.id}/print`, '_blank', 'noopener,noreferrer');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setClosing(false);
    }
  };

  return (
    <div>
      <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', marginBottom: '2rem' }}>
        <div>
          <h2 style={{ fontSize: '1.75rem', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ClipboardCheck size={26} style={{ color: 'var(--primary)' }} />
            <span>Cierre Z Diario</span>
          </h2>
          <p style={{ color: 'var(--text-muted)' }}>
            El Cierre Z se emite manualmente como comprobante de cierre diario y bloquea nuevas ventas para esta jornada.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button onClick={() => window.print()} className="btn btn-secondary">
            <Printer size={16} />
            <span>Imprimir</span>
          </button>
          {data?.cerrado && data?.id && (
            <a href={`/dashboard/cierre-z/${data.id}/print`} target="_blank" rel="noreferrer" className="btn btn-secondary">
              Ver Comprobante Z
            </a>
          )}
          <Link href="/dashboard/ventas" className="btn btn-primary">
            Volver a Caja
          </Link>
        </div>
      </div>

      {error && (
        <div style={{ padding: '1rem', backgroundColor: '#fee2e2', color: '#b91c1c', borderRadius: 'var(--radius-md)', marginBottom: '1.5rem' }}>
          {error}
        </div>
      )}

      <div className="card no-print" style={{ marginBottom: '1.5rem' }}>
        <div className="form-row" style={{ alignItems: 'end' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <CalendarDays size={14} />
              <span>Día de caja</span>
            </label>
            <input className="form-input" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <Banknote size={14} />
              <span>Fondo fijo inicial para cambio</span>
            </label>
            <input
              className="form-input"
              type="number"
              min="0"
              step="0.01"
              value={montoInicial}
              onChange={(e) => setMontoInicial(e.target.value)}
              disabled={loading || saving || !!data?.cerrado}
            />
          </div>
          <button onClick={handleSaveMontoInicial} className="btn btn-secondary" disabled={loading || saving || !!data?.cerrado}>
            <Save size={16} />
            <span>{saving ? 'Guardando...' : 'Guardar fondo'}</span>
          </button>
          <button onClick={handleEmitirCierre} className="btn btn-primary" disabled={loading || closing || !!data?.cerrado}>
            <CheckCircle2 size={16} />
            <span>{closing ? 'Emitiendo...' : 'Emitir Comprobante Z'}</span>
          </button>
        </div>
      </div>

      {loading || !data ? (
        <p style={{ color: 'var(--text-muted)' }}>Calculando cierre Z...</p>
      ) : (
        <div className="print-ticket">
          <div style={{ marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.25rem' }}>
              <h3 style={{ fontSize: '1.35rem' }}>Cierre Z - {new Date(`${data.fecha}T00:00:00-03:00`).toLocaleDateString('es-AR')}</h3>
              <span className={`badge ${data.cerrado ? 'badge-success' : 'badge-warning'}`}>
                {data.cerrado ? 'Cierre emitido' : 'Vista previa sin emitir'}
              </span>
            </div>
            <p style={{ color: 'var(--text-muted)' }}>{data.concepto}</p>
            {data.cerradoAt && (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.35rem' }}>
                Emitido manualmente el {new Date(data.cerradoAt).toLocaleString('es-AR')}.
              </p>
            )}
          </div>

          <div className="grid-stats">
            <div className="card stat-card">
              <div className="stat-icon" style={{ backgroundColor: 'var(--primary-light)', color: 'var(--primary)' }}>$</div>
              <div className="stat-info">
                <span className="stat-label">Facturado del día</span>
                <span className="stat-value">{formatMoney(data.facturadoTotal)}</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Todo lo vendido en el día, neto de notas de crédito</span>
              </div>
            </div>

            <div className="card stat-card">
              <div className="stat-icon" style={{ backgroundColor: 'var(--accent-light)', color: 'var(--secondary)' }}>$</div>
              <div className="stat-info">
                <span className="stat-label">Plata total en caja</span>
                <span className="stat-value">{formatMoney(data.totalCaja)}</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Fondo fijo + efectivo neto</span>
              </div>
            </div>

            <div className="card stat-card">
              <div className="stat-icon" style={{ backgroundColor: '#dbeafe', color: '#1d4ed8' }}>
                <ClipboardCheck size={22} />
              </div>
              <div className="stat-info">
                <span className="stat-label">Comprobantes</span>
                <span className="stat-value">{data.cantidadComprobantes}</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Emitidos en el día</span>
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
            <div className="card">
              <h3 style={{ marginBottom: '1rem' }}>Resumen de Caja</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Fondo fijo inicial</span>
                  <strong>{formatMoney(data.montoInicial)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Efectivo cobrado neto</span>
                  <strong>{formatMoney(data.efectivoNeto)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem', fontSize: '1.1rem' }}>
                  <span>Total físico esperado</span>
                  <strong style={{ color: 'var(--primary)' }}>{formatMoney(data.totalCaja)}</strong>
                </div>
              </div>
            </div>

            <div className="card">
              <h3 style={{ marginBottom: '1rem' }}>Discriminado por Forma de Pago</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {Object.entries(data.porFormaPago).map(([formaPago, total]) => (
                  <div key={formaPago} style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>{formaPago}</span>
                    <strong>{formatMoney(total)}</strong>
                  </div>
                ))}
                {Object.keys(data.porFormaPago).length === 0 && (
                  <p style={{ color: 'var(--text-muted)' }}>Todavía no hay comprobantes emitidos en este día.</p>
                )}
              </div>
            </div>
          </div>

          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Hora</th>
                  <th>Comprobante</th>
                  <th>Cliente</th>
                  <th>Pago</th>
                  <th style={{ textAlign: 'right' }}>Importe</th>
                </tr>
              </thead>
              <tbody>
                {data.ventas.map((venta) => (
                  <tr key={venta.id}>
                    <td>{new Date(venta.fecha).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</td>
                    <td>
                      <strong>{venta.tipoComprobante}</strong>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{formatVoucherNumber(venta)}</div>
                    </td>
                    <td>{venta.cliente}</td>
                    <td>{venta.formaPago}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700 }}>{formatMoney(venta.signedTotal)}</td>
                  </tr>
                ))}
                {data.ventas.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                      No hay movimientos de caja para este día.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <style jsx global>{`
        @media print {
          .no-print {
            display: none !important;
          }
          .print-ticket {
            padding: 0 !important;
          }
        }
      `}</style>
    </div>
  );
}
