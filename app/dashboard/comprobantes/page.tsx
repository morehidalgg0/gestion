'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { FileText, Printer, Search } from 'lucide-react';

type Venta = {
  id: string;
  fecha: string;
  tipoComprobante: string;
  puntoVenta: number;
  numeroComprobante: number;
  total: string;
  formaPago: string;
  estado: string;
  cae?: string | null;
  mensajeAfip?: string | null;
  cliente?: {
    razonSocial: string;
    tipoDoc: string;
    nroDoc: string;
  };
  items?: Array<{ id: string }>;
};

function formatMoney(value: string) {
  return Number(value).toLocaleString('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 2,
  });
}

function formatVoucherNumber(venta: Venta) {
  return `${venta.puntoVenta.toString().padStart(4, '0')}-${venta.numeroComprobante.toString().padStart(8, '0')}`;
}

function getEstadoBadge(estado: string) {
  if (estado === 'COMPLETADO') return 'badge-success';
  if (estado === 'DEMO') return 'badge-warning';
  if (estado === 'RECHAZADO_AFIP') return 'badge-danger';
  return 'badge-info';
}

export default function ComprobantesPage() {
  const [ventas, setVentas] = useState<Venta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [estado, setEstado] = useState('TODOS');

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setError('');

      try {
        const sessionRes = await fetch('/api/auth/session');
        const sessionData = await sessionRes.json();
        if (!sessionData.authenticated) {
          throw new Error('No se pudo validar la sesión.');
        }

        const ventasRes = await fetch('/api/tenant/ventas');
        if (!ventasRes.ok) {
          const data = await ventasRes.json().catch(() => ({}));
          throw new Error(data.error || 'No se pudo cargar el historial de comprobantes.');
        }

        const ventasData = await ventasRes.json();
        setVentas(Array.isArray(ventasData) ? ventasData : []);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  const filteredVentas = useMemo(() => {
    const term = search.trim().toLowerCase();

    return ventas.filter((venta) => {
      const matchesEstado = estado === 'TODOS' || venta.estado === estado;
      const voucherNumber = formatVoucherNumber(venta);
      const cliente = venta.cliente?.razonSocial || '';
      const documento = venta.cliente?.nroDoc || '';
      const matchesSearch =
        !term ||
        cliente.toLowerCase().includes(term) ||
        documento.toLowerCase().includes(term) ||
        venta.tipoComprobante.toLowerCase().includes(term) ||
        voucherNumber.includes(term);

      return matchesEstado && matchesSearch;
    });
  }, [estado, search, ventas]);

  const totals = useMemo(() => {
    return filteredVentas.reduce(
      (acc, venta) => {
        if (venta.estado !== 'RECHAZADO_AFIP') {
          acc.total += Number(venta.total);
        }
        acc.count += 1;
        return acc;
      },
      { count: 0, total: 0 }
    );
  }, [filteredVentas]);

  if (loading) {
    return <p style={{ color: 'var(--text-muted)' }}>Cargando historial de comprobantes...</p>;
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', marginBottom: '2rem' }}>
        <div>
          <h2 style={{ fontSize: '1.75rem', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <FileText size={26} style={{ color: 'var(--primary)' }} />
            <span>Historial de Comprobantes</span>
          </h2>
          <p style={{ color: 'var(--text-muted)' }}>
            Consultá, buscá e imprimí los comprobantes emitidos históricamente por el comercio.
          </p>
        </div>

        <Link href="/dashboard/ventas" className="btn btn-primary">
          Emitir Nuevo
        </Link>
      </div>

      {error && (
        <div style={{ padding: '1rem', backgroundColor: '#fee2e2', color: '#b91c1c', borderRadius: 'var(--radius-md)', marginBottom: '1.5rem' }}>
          {error}
        </div>
      )}

      <div className="grid-stats">
        <div className="card stat-card">
          <div className="stat-icon" style={{ backgroundColor: 'var(--primary-light)', color: 'var(--primary)' }}>
            <FileText size={24} />
          </div>
          <div className="stat-info">
            <span className="stat-label">Comprobantes</span>
            <span className="stat-value">{totals.count}</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Según filtros actuales</span>
          </div>
        </div>

        <div className="card stat-card">
          <div className="stat-icon" style={{ backgroundColor: 'var(--accent-light)', color: 'var(--secondary)' }}>
            <span style={{ fontWeight: 700 }}>$</span>
          </div>
          <div className="stat-info">
            <span className="stat-label">Total Facturado</span>
            <span className="stat-value">{formatMoney(String(totals.total))}</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>No incluye rechazados</span>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(240px, 1fr) 220px', gap: '1rem', alignItems: 'center' }}>
          <div style={{ position: 'relative' }}>
            <Search size={18} style={{ position: 'absolute', top: '50%', left: '0.9rem', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              className="form-input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por cliente, documento o número..."
              style={{ paddingLeft: '2.5rem' }}
            />
          </div>

          <select className="form-select" value={estado} onChange={(e) => setEstado(e.target.value)}>
            <option value="TODOS">Todos los estados</option>
            <option value="COMPLETADO">Completados</option>
            <option value="DEMO">Demo</option>
            <option value="RECHAZADO_AFIP">Rechazados AFIP</option>
          </select>
        </div>
      </div>

      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Comprobante</th>
              <th>Cliente</th>
              <th>Pago</th>
              <th>Estado</th>
              <th style={{ textAlign: 'right' }}>Total</th>
              <th style={{ textAlign: 'center' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filteredVentas.map((venta) => (
              <tr key={venta.id}>
                <td>{new Date(venta.fecha).toLocaleDateString('es-AR')}</td>
                <td>
                  <strong>{venta.tipoComprobante}</strong>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{formatVoucherNumber(venta)}</div>
                </td>
                <td>
                  <strong>{venta.cliente?.razonSocial || 'Consumidor Final'}</strong>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    {venta.cliente?.tipoDoc} {venta.cliente?.nroDoc}
                  </div>
                </td>
                <td>{venta.formaPago}</td>
                <td>
                  <span className={`badge ${getEstadoBadge(venta.estado)}`}>{venta.estado}</span>
                  {venta.mensajeAfip && (
                    <div style={{ maxWidth: '260px', marginTop: '0.35rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {venta.mensajeAfip}
                    </div>
                  )}
                </td>
                <td style={{ textAlign: 'right', fontWeight: 700 }}>{formatMoney(venta.total)}</td>
                <td style={{ textAlign: 'center' }}>
                  {venta.estado === 'RECHAZADO_AFIP' ? (
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Sin impresión</span>
                  ) : (
                    <a
                      href={`/dashboard/ventas/${venta.id}/print`}
                      target="_blank"
                      rel="noreferrer"
                      className="btn btn-secondary btn-sm"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                    >
                      <Printer size={14} />
                      Ver / Imprimir
                    </a>
                  )}
                </td>
              </tr>
            ))}

            {filteredVentas.length === 0 && (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                  No hay comprobantes para mostrar con los filtros actuales.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
