'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { DollarSign, ArrowUpRight, ArrowDownLeft, Plus, Users } from 'lucide-react';

function CcContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const initialClienteId = searchParams.get('clienteId') || '';

  const [movimientos, setMovimientos] = useState<any[]>([]);
  const [clientes, setClientes] = useState<any[]>([]);
  
  // Filter and Modal state
  const [filterClienteId, setFilterClienteId] = useState(initialClienteId);
  const [showPayModal, setShowPayModal] = useState(false);
  const [loading, setLoading] = useState(true);

  // Form state
  const [selectedClienteId, setSelectedClienteId] = useState('');
  const [importe, setImporte] = useState('');
  const [concepto, setConcepto] = useState('Cobro en efectivo - Recibo interno');
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadData = async () => {
    try {
      const cliRes = await fetch('/api/tenant/clientes');
      const cliData = await cliRes.json();
      const clientsList = Array.isArray(cliData) ? cliData : [];
      setClientes(clientsList);

      if (clientsList.length > 0 && !selectedClienteId) {
        setSelectedClienteId(clientsList[0].id);
      }

      // Fetch movements
      const url = filterClienteId
        ? `/api/tenant/cuentas-corrientes?clienteId=${filterClienteId}`
        : '/api/tenant/cuentas-corrientes';
      
      const movRes = await fetch(url);
      const movData = await movRes.json();
      setMovimientos(Array.isArray(movData) ? movData : []);
    } catch (err) {
      console.error('Failed to load CC data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [filterClienteId]);

  // Synchronize filter client when search parameter changes
  useEffect(() => {
    setFilterClienteId(initialClienteId);
  }, [initialClienteId]);

  const handleFilterChange = (id: string) => {
    setFilterClienteId(id);
    
    // Update browser URL query params
    const params = new URLSearchParams();
    if (id) {
      params.set('clienteId', id);
      router.push(`/dashboard/cuentas-corrientes?${params.toString()}`);
    } else {
      router.push('/dashboard/cuentas-corrientes');
    }
  };

  const handleRegisterPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError('');
    setSubmitting(true);

    try {
      const res = await fetch('/api/tenant/cuentas-corrientes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clienteId: selectedClienteId,
          importe: parseFloat(importe),
          concepto,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'No se pudo guardar el pago.');
      }

      setImporte('');
      setConcepto('Cobro en efectivo - Recibo interno');
      setShowPayModal(false);
      loadData();
    } catch (err: any) {
      setSubmitError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Find active customer info if filtered
  const activeClient = clientes.find((c) => c.id === filterClienteId);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h2 style={{ fontSize: '1.75rem', marginBottom: '0.25rem' }}>Control de Cuentas Corrientes</h2>
          <p style={{ color: 'var(--text-muted)' }}>Listado de cargos y entregas de dinero de clientes fiados.</p>
        </div>
        <button onClick={() => setShowPayModal(true)} className="btn btn-primary">
          <Plus size={16} />
          <span>Registrar Cobro (Haber)</span>
        </button>
      </div>

      {/* Filter and Client Card */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '1.5rem', marginBottom: '1.5rem', alignItems: 'start' }}>
        {/* Filter dropdown */}
        <div className="card" style={{ padding: '1.25rem' }}>
          <label className="form-label">Filtrar por Cliente</label>
          <select
            className="form-select"
            value={filterClienteId}
            onChange={(e) => handleFilterChange(e.target.value)}
          >
            <option value="">-- Todos los Clientes (General) --</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.razonSocial} (DNI/CUIT: {c.nroDoc})
              </option>
            ))}
          </select>
        </div>

        {/* Client details if selected */}
        {activeClient && (
          <div className="card" style={{ backgroundColor: 'var(--accent-light)', borderColor: 'var(--accent)' }}>
            <h3 style={{ fontSize: '1.05rem', color: 'var(--secondary)', marginBottom: '0.5rem' }}>Resumen del Cliente</h3>
            <strong style={{ fontSize: '1.2rem', display: 'block' }}>{activeClient.razonSocial}</strong>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{activeClient.tipoDoc}: {activeClient.nroDoc}</span>
            
            <div style={{ marginTop: '1rem', borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block' }}>Saldo Pendiente (Deuda):</span>
              <strong style={{ fontSize: '1.5rem', color: '#ef4444' }}>
                ${parseFloat(activeClient.saldoCuentaCorriente).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
              </strong>
              {activeClient.limiteCredito && (
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginTop: '0.25rem' }}>
                  Límite de crédito: ${parseFloat(activeClient.limiteCredito).toLocaleString('es-AR')}
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Movements Table */}
      {loading ? (
        <p style={{ color: 'var(--text-muted)' }}>Cargando registros...</p>
      ) : (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Cliente</th>
                <th>Concepto / Detalle</th>
                <th>Tipo</th>
                <th style={{ textAlign: 'right' }}>Importe</th>
                <th style={{ textAlign: 'right' }}>Saldo Resultante</th>
              </tr>
            </thead>
            <tbody>
              {movimientos.map((mov) => {
                const isDebe = mov.tipo === 'DEBE'; // Debe = charge (+ debt), Haber = payment (- debt)
                return (
                  <tr key={mov.id}>
                    <td style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      {new Date(mov.fecha).toLocaleString('es-AR')}
                    </td>
                    <td style={{ fontWeight: 500 }}>{mov.cliente.razonSocial}</td>
                    <td>{mov.concepto}</td>
                    <td>
                      {isDebe ? (
                        <span className="badge badge-warning" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}>
                          <ArrowUpRight size={12} />
                          <span>DEBE (Cargo)</span>
                        </span>
                      ) : (
                        <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}>
                          <ArrowDownLeft size={12} />
                          <span>HABER (Pago)</span>
                        </span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 600, color: isDebe ? '#d97706' : '#15803d' }}>
                      {isDebe ? '+' : '-'}${parseFloat(mov.importe).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>
                      ${parseFloat(mov.saldoResultante).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                );
              })}
              {movimientos.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                    No se registran movimientos en la cuenta corriente.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* REGISTER PAYMENT MODAL */}
      {showPayModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>💵 Registrar Cobro / Entrega a Cuenta</h3>
              <button onClick={() => setShowPayModal(false)} className="btn btn-secondary btn-sm" style={{ padding: '0.25rem 0.5rem' }}>✕</button>
            </div>
            <form onSubmit={handleRegisterPayment}>
              <div className="modal-body">
                {submitError && (
                  <div style={{ padding: '0.75rem', backgroundColor: '#fee2e2', color: '#b91c1c', borderRadius: 'var(--radius-sm)', marginBottom: '1rem', fontSize: '0.9rem' }}>
                    ⚠️ {submitError}
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label">Seleccionar Cliente</label>
                  <select
                    className="form-select"
                    value={selectedClienteId}
                    onChange={(e) => setSelectedClienteId(e.target.value)}
                    required
                  >
                    {clientes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.razonSocial} (Deuda: ${parseFloat(c.saldoCuentaCorriente).toLocaleString('es-AR')})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Monto Recibido ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    className="form-input"
                    placeholder="0.00"
                    value={importe}
                    onChange={(e) => setImporte(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Concepto de Cobro</label>
                  <input
                    type="text"
                    className="form-input"
                    value={concepto}
                    onChange={(e) => setConcepto(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" onClick={() => setShowPayModal(false)} className="btn btn-secondary" disabled={submitting}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Procesando...' : 'Registrar Pago'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function CcPage() {
  return (
    <Suspense fallback={
      <div className="card" style={{ padding: '2rem', textAlign: 'center' }}>
        <p>Cargando modulo de Cuentas Corrientes...</p>
      </div>
    }>
      <CcContent />
    </Suspense>
  );
}
