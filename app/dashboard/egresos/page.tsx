'use client';

import { useEffect, useState } from 'react';
import { CalendarDays, HandCoins, Plus } from 'lucide-react';

type Egreso = {
  id: string;
  fecha: string;
  proveedor: string;
  categoria: string;
  concepto: string;
  formaPago: string;
  monto: number;
  observacion?: string | null;
  usuario?: {
    nombre: string;
    email: string;
  };
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

export default function EgresosPage() {
  const [periodo, setPeriodo] = useState('mes');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [egresos, setEgresos] = useState<Egreso[]>([]);
  const [proveedor, setProveedor] = useState('');
  const [categoria, setCategoria] = useState('Costo de mercadería');
  const [concepto, setConcepto] = useState('');
  const [formaPago, setFormaPago] = useState('Efectivo');
  const [monto, setMonto] = useState('');
  const [observacion, setObservacion] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const loadEgresos = async () => {
    setLoading(true);
    setError('');

    try {
      let url = `/api/tenant/egresos?periodo=${periodo}`;
      if (periodo === 'personalizado' && desde && hasta) {
        url = `/api/tenant/egresos?periodo=personalizado&desde=${desde}&hasta=${hasta}`;
      }
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'No se pudieron cargar los egresos.');
      }
      setEgresos(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEgresos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodo]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    try {
      const fecha = todayArgentina();
      const res = await fetch('/api/tenant/egresos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fecha, proveedor, categoria, concepto, formaPago, monto, observacion }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'No se pudo registrar el egreso.');
      }

      setProveedor('');
      setCategoria('Costo de mercadería');
      setConcepto('');
      setFormaPago('Efectivo');
      setMonto('');
      setObservacion('');
      await loadEgresos();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const total = egresos.reduce((acc, egreso) => acc + egreso.monto, 0);
  const totalEfectivo = egresos.filter((egreso) => egreso.formaPago === 'Efectivo').reduce((acc, egreso) => acc + egreso.monto, 0);
  const totalTarjeta = egresos.filter((egreso) => egreso.formaPago === 'Tarjeta').reduce((acc, egreso) => acc + egreso.monto, 0);
  const totalTransferencia = egresos.filter((egreso) => egreso.formaPago === 'Transferencia').reduce((acc, egreso) => acc + egreso.monto, 0);

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap', marginBottom: '2rem' }}>
        <div>
          <h2 style={{ fontSize: '1.75rem', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <HandCoins size={26} style={{ color: 'var(--primary)' }} />
            <span>Historial de Egresos</span>
          </h2>
          <p style={{ color: 'var(--text-muted)' }}>Registrá pagos, sueldos, alquiler y gastos. El historial se acumula para calcular la ganancia real.</p>
        </div>
        <div className="card" style={{ padding: '1rem', minWidth: '220px' }}>
          <span className="stat-label">Egresos del período</span>
          <div className="stat-value">{formatMoney(total)}</div>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
            Efectivo: {formatMoney(totalEfectivo)} · Tarjeta: {formatMoney(totalTarjeta)} · Transf.: {formatMoney(totalTransferencia)}
          </span>
        </div>
      </div>

      {error && (
        <div style={{ padding: '1rem', backgroundColor: '#fee2e2', color: '#b91c1c', borderRadius: 'var(--radius-md)', marginBottom: '1.5rem' }}>
          {error}
        </div>
      )}

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Proveedor / Destino</label>
              <input className="form-input" value={proveedor} onChange={(e) => setProveedor(e.target.value)} placeholder="Ej: Distribuidora Norte" required />
            </div>
            <div className="form-group">
              <label className="form-label">Categoría</label>
              <select className="form-select" value={categoria} onChange={(e) => setCategoria(e.target.value)}>
                <option value="Costo de mercadería">Costo de mercadería</option>
                <option value="Proveedor">Proveedor</option>
                <option value="Sueldos">Sueldos / Personal</option>
                <option value="Alquiler">Alquiler</option>
                <option value="Servicios">Servicios</option>
                <option value="Impuestos">Impuestos</option>
                <option value="Seguros">Seguros</option>
                <option value="Publicidad">Publicidad</option>
                <option value="Retiro">Retiro de caja</option>
                <option value="Otro">Otro</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Forma de pago</label>
              <select className="form-select" value={formaPago} onChange={(e) => setFormaPago(e.target.value)}>
                <option value="Efectivo">Efectivo</option>
                <option value="Transferencia">Transferencia</option>
                <option value="Tarjeta">Tarjeta / Débito</option>
                <option value="Cuenta Corriente">Cuenta Corriente</option>
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Concepto</label>
              <input className="form-input" value={concepto} onChange={(e) => setConcepto(e.target.value)} placeholder="Ej: Pago mercadería" required />
            </div>
            <div className="form-group">
              <label className="form-label">Monto</label>
              <input className="form-input" type="number" min="0" step="0.01" value={monto} onChange={(e) => setMonto(e.target.value)} placeholder="0.00" required />
            </div>
            <div className="form-group">
              <label className="form-label">Observación</label>
              <input className="form-input" value={observacion} onChange={(e) => setObservacion(e.target.value)} placeholder="Detalle opcional" />
            </div>
          </div>

          <button className="btn btn-primary" type="submit" disabled={saving}>
            <Plus size={16} />
            <span>{saving ? 'Registrando...' : 'Registrar egreso'}</span>
          </button>
        </form>
      </div>

      {/* Period filter */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <CalendarDays size={14} /> Período
          </label>
          <select className="form-select" style={{ width: '220px' }} value={periodo} onChange={(e) => setPeriodo(e.target.value)}>
            <option value="hoy">Hoy</option>
            <option value="semana">Últimos 7 días</option>
            <option value="mes">Últimos 30 días</option>
            <option value="todos">Todo el historial</option>
            <option value="personalizado">Rango personalizado...</option>
          </select>
        </div>
        {periodo === 'personalizado' && (
          <>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Desde</label>
              <input className="form-input" type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Hasta</label>
              <input className="form-input" type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
            </div>
            <button className="btn btn-primary" disabled={!desde || !hasta} onClick={loadEgresos}>
              Filtrar
            </button>
          </>
        )}
      </div>

      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Proveedor</th>
              <th>Categoría</th>
              <th>Concepto</th>
              <th>Pago</th>
              <th>Usuario</th>
              <th style={{ textAlign: 'right' }}>Monto</th>
            </tr>
          </thead>
          <tbody>
            {egresos.map((egreso) => (
              <tr key={egreso.id}>
                <td style={{ whiteSpace: 'nowrap' }}>{formatDate(egreso.fecha)}</td>
                <td style={{ fontWeight: 700 }}>{egreso.proveedor}</td>
                <td><span className="badge badge-info">{egreso.categoria}</span></td>
                <td>
                  <strong>{egreso.concepto}</strong>
                  {egreso.observacion && <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{egreso.observacion}</div>}
                </td>
                <td>{egreso.formaPago}</td>
                <td>{egreso.usuario?.nombre || '-'}</td>
                <td style={{ textAlign: 'right', fontWeight: 800, color: '#b91c1c' }}>{formatMoney(egreso.monto)}</td>
              </tr>
            ))}
            {!loading && egresos.length === 0 && (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                  No hay egresos registrados en este período.
                </td>
              </tr>
            )}
            {loading && (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                  Cargando egresos...
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
