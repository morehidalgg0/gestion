'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { FileText, Printer, RotateCcw, Search, FilePlus2 } from 'lucide-react';

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
  ventaOrigenId?: string | null;
  cliente?: {
    razonSocial: string;
    tipoDoc: string;
    nroDoc: string;
    condicionIva?: string;
    direccion?: string;
    email?: string;
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
  const [session, setSession] = useState<any>(null);
  const [ventas, setVentas] = useState<Venta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [issuingCreditNoteId, setIssuingCreditNoteId] = useState('');
  const [search, setSearch] = useState('');
  const [estado, setEstado] = useState('TODOS');

  // Facturación a demanda (Ticket X -> Factura fiscal)
  const [facturarTicket, setFacturarTicket] = useState<Venta | null>(null);
  const [facturarTipo, setFacturarTipo] = useState('auto');
  const [facturarTipoDoc, setFacturarTipoDoc] = useState('CUIT');
  const [facturarNroDoc, setFacturarNroDoc] = useState('');
  const [facturarRazonSocial, setFacturarRazonSocial] = useState('');
  const [facturarCondicionIva, setFacturarCondicionIva] = useState('Responsable Inscripto');
  const [facturarDireccion, setFacturarDireccion] = useState('');
  const [facturarEmail, setFacturarEmail] = useState('');
  const [submittingFactura, setSubmittingFactura] = useState(false);

  const loadVentas = async () => {
    const ventasRes = await fetch('/api/tenant/ventas');
    if (!ventasRes.ok) {
      const data = await ventasRes.json().catch(() => ({}));
      throw new Error(data.error || 'No se pudo cargar el historial de comprobantes.');
    }

    const ventasData = await ventasRes.json();
    setVentas(Array.isArray(ventasData) ? ventasData : []);
  };

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
        setSession(sessionData.user);

        await loadVentas();
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  const creditNotesFor = (venta: Venta) => {
    return ventas.filter((item) =>
      item.tipoComprobante.startsWith('Nota de Crédito') &&
      item.mensajeAfip?.includes(`Comprobante original ID: ${venta.id}`)
    );
  };

  const creditedAmount = (venta: Venta) => {
    return creditNotesFor(venta).reduce((acc, item) => acc + Number(item.total), 0);
  };

  const remainingCreditAmount = (venta: Venta) => {
    return Math.max(0, Number(venta.total) - creditedAmount(venta));
  };

  const hasCreditNote = (venta: Venta) => creditNotesFor(venta).length > 0;

  const canIssueCreditNote = (venta: Venta) => {
    return (session?.rol === 'OWNER' || session?.rol === 'EMPLOYEE') &&
      venta.estado !== 'RECHAZADO_AFIP' &&
      venta.tipoComprobante.startsWith('Factura') &&
      remainingCreditAmount(venta) > 0.009;
  };

  const handleEmitCreditNote = async (venta: Venta) => {
    const remaining = remainingCreditAmount(venta);
    const input = window.prompt(
      `Monto de la nota de crédito para ${venta.tipoComprobante} ${formatVoucherNumber(venta)}. Máximo disponible: ${formatMoney(String(remaining))}`,
      remaining.toFixed(2)
    );

    if (input === null) return;

    const monto = Number(input.replace(',', '.'));
    if (!Number.isFinite(monto) || monto <= 0) {
      setError('El monto de la nota de crédito debe ser mayor a cero.');
      return;
    }

    if (monto - remaining > 0.009) {
      setError(`El monto supera el saldo disponible para acreditar (${formatMoney(String(remaining))}).`);
      return;
    }

    const confirmed = window.confirm(`Vas a emitir una nota de crédito por ${formatMoney(String(monto))}. ¿Continuar?`);
    if (!confirmed) return;

    setIssuingCreditNoteId(venta.id);
    setError('');

    try {
      const response = await fetch(`/api/tenant/ventas/${venta.id}/nota-credito`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ monto }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'No se pudo emitir la nota de crédito.');
      }

      await loadVentas();
      window.open(`/dashboard/ventas/${data.venta.id}/print`, '_blank', 'noopener,noreferrer');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIssuingCreditNoteId('');
    }
  };

  const facturaPara = (venta: Venta) => {
    return ventas.find((item) => item.ventaOrigenId === venta.id);
  };

  const canFacturarTicket = (venta: Venta) => {
    return (
      (session?.rol === 'OWNER' || session?.rol === 'EMPLOYEE') &&
      venta.tipoComprobante === 'Factura X' &&
      !facturaPara(venta)
    );
  };

  const openFacturarTicket = (venta: Venta) => {
    setFacturarTicket(venta);
    setFacturarTipo('auto');
    setFacturarTipoDoc(venta.cliente?.tipoDoc || 'CUIT');
    setFacturarNroDoc(venta.cliente?.nroDoc || '');
    setFacturarRazonSocial(venta.cliente?.razonSocial || '');
    setFacturarCondicionIva(venta.cliente?.condicionIva || 'Responsable Inscripto');
    setFacturarDireccion(venta.cliente?.direccion || '');
    setFacturarEmail(venta.cliente?.email || '');
    setError('');
  };

  const handleSubmitFacturar = async () => {
    if (!facturarTicket) return;

    if (!facturarNroDoc.trim() || !facturarRazonSocial.trim()) {
      setError('Completá documento y razón social del receptor para emitir la factura.');
      return;
    }

    setSubmittingFactura(true);
    setError('');

    try {
      const response = await fetch(`/api/tenant/ventas/${facturarTicket.id}/factura`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipoComprobante: facturarTipo === 'auto' ? undefined : facturarTipo,
          datosFacturacion: {
            tipoDoc: facturarTipoDoc,
            nroDoc: facturarNroDoc,
            razonSocial: facturarRazonSocial,
            condicionIva: facturarCondicionIva,
            direccion: facturarDireccion,
            email: facturarEmail,
          },
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'No se pudo emitir la factura.');
      }

      setFacturarTicket(null);
      await loadVentas();
      window.open(`/dashboard/ventas/${data.venta.id}/print`, '_blank', 'noopener,noreferrer');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido al facturar.');
    } finally {
      setSubmittingFactura(false);
    }
  };

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
          acc.total += venta.tipoComprobante.startsWith('Nota de Crédito') ? -Number(venta.total) : Number(venta.total);
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
                <td>
                  <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
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
                  {canFacturarTicket(venta) && (
                    <button
                      onClick={() => openFacturarTicket(venta)}
                      className="btn btn-primary btn-sm"
                      disabled={submittingFactura}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                    >
                      <FilePlus2 size={14} />
                      Facturar
                    </button>
                  )}
                  {facturaPara(venta) && (
                    <a
                      href={`/dashboard/ventas/${facturaPara(venta)!.id}/print`}
                      target="_blank"
                      rel="noreferrer"
                      className="badge badge-success"
                      style={{ textDecoration: 'none' }}
                    >
                      Facturado: {formatVoucherNumber(facturaPara(venta)!)}
                    </a>
                  )}
                  {canIssueCreditNote(venta) && (
                    <button
                      onClick={() => handleEmitCreditNote(venta)}
                      className="btn btn-outline btn-sm"
                      disabled={issuingCreditNoteId === venta.id}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                    >
                      <RotateCcw size={14} />
                      {issuingCreditNoteId === venta.id ? 'Emitiendo...' : 'Nota crédito'}
                    </button>
                  )}
                  {venta.tipoComprobante.startsWith('Factura') && hasCreditNote(venta) && (
                    <span className="badge badge-info">
                      {remainingCreditAmount(venta) > 0.009
                        ? `Acreditado ${formatMoney(String(creditedAmount(venta)))}`
                        : 'Acreditada total'}
                    </span>
                  )}
                  </div>
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

      {/* ON-DEMAND INVOICING MODAL (Ticket X -> Factura fiscal) */}
      {facturarTicket && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ borderColor: 'var(--primary)' }}>
            <div className="modal-header" style={{ backgroundColor: 'var(--primary-light)' }}>
              <h3 style={{ color: 'var(--primary-hover)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <FilePlus2 size={20} />
                <span>Facturar Ticket X</span>
              </h3>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <p style={{ fontSize: '0.9rem' }}>
                Vas a emitir la factura fiscal del ticket <strong>{formatVoucherNumber(facturarTicket)}</strong> por{' '}
                <strong>{formatMoney(facturarTicket.total)}</strong>. El stock ya fue descontado al momento del ticket
                original.
              </p>

              <div className="form-group">
                <label className="form-label">Tipo de Comprobante</label>
                <select
                  className="form-select"
                  value={facturarTipo}
                  onChange={(e) => setFacturarTipo(e.target.value)}
                >
                  <option value="auto">Automático (según condición IVA)</option>
                  <option value="Factura A">Factura A</option>
                  <option value="Factura B">Factura B</option>
                  <option value="Factura C">Factura C</option>
                </select>
              </div>

              <div style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '0.75rem', backgroundColor: 'var(--bg-secondary)' }}>
                <strong style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.65rem' }}>Datos fiscales del receptor</strong>
                <div style={{ display: 'grid', gridTemplateColumns: '0.8fr 1.2fr', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <select
                    className="form-select"
                    value={facturarTipoDoc}
                    onChange={(e) => setFacturarTipoDoc(e.target.value)}
                    disabled={facturarTipo === 'Factura A'}
                  >
                    <option value="CUIT">CUIT</option>
                    <option value="DNI">DNI</option>
                    <option value="99">Sin identificar</option>
                  </select>
                  <input
                    className="form-input"
                    placeholder={facturarTipoDoc === 'CUIT' ? 'CUIT sin guiones' : 'Número documento'}
                    value={facturarNroDoc}
                    onChange={(e) => setFacturarNroDoc(e.target.value)}
                  />
                </div>
                <input
                  className="form-input"
                  placeholder="Razón social / Nombre completo"
                  value={facturarRazonSocial}
                  onChange={(e) => setFacturarRazonSocial(e.target.value)}
                  style={{ marginBottom: '0.5rem' }}
                />
                <select
                  className="form-select"
                  value={facturarCondicionIva}
                  onChange={(e) => setFacturarCondicionIva(e.target.value)}
                  disabled={facturarTipo === 'Factura A'}
                  style={{ marginBottom: '0.5rem' }}
                >
                  <option value="Consumidor Final">Consumidor Final</option>
                  <option value="Responsable Inscripto">Responsable Inscripto</option>
                  <option value="Monotributista">Monotributista</option>
                  <option value="Exento">Exento</option>
                </select>
                <input
                  className="form-input"
                  placeholder="Dirección fiscal (opcional)"
                  value={facturarDireccion}
                  onChange={(e) => setFacturarDireccion(e.target.value)}
                  style={{ marginBottom: '0.5rem' }}
                />
                <input
                  className="form-input"
                  type="email"
                  placeholder="Email (opcional)"
                  value={facturarEmail}
                  onChange={(e) => setFacturarEmail(e.target.value)}
                />
              </div>

              {error && (
                <div style={{ padding: '1rem', backgroundColor: '#fee2e2', color: '#b91c1c', borderRadius: 'var(--radius-md)', fontSize: '0.9rem' }}>
                  {error}
                </div>
              )}
            </div>
            <div className="modal-footer" style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                onClick={() => setFacturarTicket(null)}
                className="btn btn-secondary"
                style={{ flex: 1 }}
                disabled={submittingFactura}
              >
                Cancelar
              </button>
              <button
                onClick={handleSubmitFacturar}
                className="btn btn-primary"
                style={{ flex: 1 }}
                disabled={submittingFactura}
              >
                {submittingFactura ? 'Emitiendo CAE AFIP...' : 'Emitir Factura Fiscal'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
