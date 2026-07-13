'use client';

import { useState, useEffect } from 'react';
import { Users, Plus, DollarSign, ExternalLink } from 'lucide-react';
import Link from 'next/link';

export default function ClientesPage() {
  const [clientes, setClientes] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);

  // Form states
  const [tipoDoc, setTipoDoc] = useState('DNI');
  const [nroDoc, setNroDoc] = useState('');
  const [razonSocial, setRazonSocial] = useState('');
  const [condicionIva, setCondicionIva] = useState('Consumidor Final');
  const [direccion, setDireccion] = useState('');
  const [telefono, setTelefono] = useState('');
  const [email, setEmail] = useState('');
  const [limiteCredito, setLimiteCredito] = useState('');
  const [addError, setAddError] = useState('');

  const loadClients = async () => {
    try {
      const res = await fetch('/api/tenant/clientes');
      const data = await res.json();
      setClientes(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load clients:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadClients();
  }, []);

  const handleAddClient = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError('');

    try {
      const cleanDoc = tipoDoc === '99' ? '0' : nroDoc.replace(/\D/g, '');
      const res = await fetch('/api/tenant/clientes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipoDoc,
          nroDoc: cleanDoc,
          razonSocial,
          condicionIva,
          direccion,
          telefono,
          email,
          limiteCredito: limiteCredito ? parseFloat(limiteCredito) : null,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'No se pudo crear el cliente.');
      }

      // Reset
      setTipoDoc('DNI');
      setNroDoc('');
      setRazonSocial('');
      setCondicionIva('Consumidor Final');
      setDireccion('');
      setTelefono('');
      setEmail('');
      setLimiteCredito('');
      
      setShowAddModal(false);
      loadClients();
    } catch (err: any) {
      setAddError(err.message);
    }
  };

  const filtered = clientes.filter((c) => {
    const term = search.toLowerCase();
    return (
      c.razonSocial.toLowerCase().includes(term) ||
      c.nroDoc.includes(term)
    );
  });

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h2 style={{ fontSize: '1.75rem', marginBottom: '0.25rem' }}>Gestión de Clientes</h2>
          <p style={{ color: 'var(--text-muted)' }}>Mantené al día la ficha fiscal y el saldo a cuenta corriente de tus compradores.</p>
        </div>
        <button onClick={() => setShowAddModal(true)} className="btn btn-primary">
          <Plus size={16} />
          <span>Nuevo Cliente</span>
        </button>
      </div>

      {/* Filter panel */}
      <div className="card" style={{ marginBottom: '1.5rem', padding: '1rem' }}>
        <input
          type="text"
          className="form-input"
          placeholder="🔍 Buscar por nombre, razón social, DNI o CUIT..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Table */}
      {loading ? (
        <p style={{ color: 'var(--text-muted)' }}>Cargando clientes...</p>
      ) : (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Documento</th>
                <th>Nombre / Razón Social</th>
                <th>Condición IVA</th>
                <th>Contacto</th>
                <th>Límite Crédito</th>
                <th>Saldo deudor</th>
                <th style={{ textAlign: 'center' }}>Cuenta corriente</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((client) => {
                const debt = parseFloat(client.saldoCuentaCorriente);
                const limit = client.limiteCredito ? parseFloat(client.limiteCredito) : null;
                const hasDebt = debt > 0;

                return (
                  <tr key={client.id} style={{ backgroundColor: hasDebt ? '#fdfcf7' : undefined }}>
                    <td>
                      <span className="badge badge-secondary" style={{ backgroundColor: 'var(--bg-tertiary)' }}>{client.tipoDoc}</span>
                      <code style={{ marginLeft: '0.5rem' }}>{client.nroDoc}</code>
                    </td>
                    <td style={{ fontWeight: 600 }}>{client.razonSocial}</td>
                    <td>{client.condicionIva}</td>
                    <td style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      <div>📞 {client.telefono || '-'}</div>
                      <div>✉️ {client.email || '-'}</div>
                    </td>
                    <td>{limit ? `$${limit.toLocaleString('es-AR')}` : 'Sin Límite'}</td>
                    <td style={{ fontWeight: 600, color: hasDebt ? '#ef4444' : 'inherit' }}>
                      ${debt.toLocaleString('es-AR')}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <Link href={`/dashboard/cuentas-corrientes?clienteId=${client.id}`} className="btn btn-secondary btn-sm" style={{ padding: '0.35rem 0.65rem' }}>
                        <span>Movimientos</span>
                        <ExternalLink size={12} />
                      </Link>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                    No se encontraron clientes registrados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ADD CLIENT MODAL */}
      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h3>👤 Registrar Nuevo Cliente</h3>
              <button onClick={() => setShowAddModal(false)} className="btn btn-secondary btn-sm" style={{ padding: '0.25rem 0.5rem' }}>✕</button>
            </div>
            <form onSubmit={handleAddClient}>
              <div className="modal-body">
                {addError && (
                  <div style={{ padding: '0.75rem', backgroundColor: '#fee2e2', color: '#b91c1c', borderRadius: 'var(--radius-sm)', marginBottom: '1rem', fontSize: '0.9rem' }}>
                    ⚠️ {addError}
                  </div>
                )}

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Tipo Documento</label>
                    <select className="form-select" value={tipoDoc} onChange={(e) => setTipoDoc(e.target.value)}>
                      <option value="DNI">DNI (Persona Física)</option>
                      <option value="CUIT">CUIT (Empresa / Monotributista)</option>
                      <option value="99">Sin Identificar (Venta al paso)</option>
                    </select>
                  </div>
                  
                  {tipoDoc !== '99' && (
                    <div className="form-group">
                      <label className="form-label">Número de Documento</label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="Ej: 20401234568 o 35123456"
                        value={nroDoc}
                        onChange={(e) => setNroDoc(e.target.value)}
                        required
                      />
                    </div>
                  )}
                </div>

                <div className="form-group">
                  <label className="form-label">Nombre Completo o Razón Social</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Ej: Carlos Gómez o Panificadora Estela S.R.L."
                    value={razonSocial}
                    onChange={(e) => setRazonSocial(e.target.value)}
                    required
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Condición IVA</label>
                    <select className="form-select" value={condicionIva} onChange={(e) => setCondicionIva(e.target.value)}>
                      <option value="Consumidor Final">Consumidor Final</option>
                      <option value="Responsable Inscripto">Responsable Inscripto</option>
                      <option value="Monotributista">Monotributista</option>
                      <option value="Exento">Sujeto Exento</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Límite de Crédito Cuenta Corriente ($)</label>
                    <input
                      type="number"
                      step="0.01"
                      className="form-input"
                      placeholder="Dejar vacío para ilimitado"
                      value={limiteCredito}
                      onChange={(e) => setLimiteCredito(e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Dirección Particular / Comercial</label>
                  <input type="text" className="form-input" placeholder="Av. Corrientes 1234, CABA" value={direccion} onChange={(e) => setDireccion(e.target.value)} />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Teléfono de Contacto</label>
                    <input type="text" className="form-input" placeholder="011 15-1234-5678" value={telefono} onChange={(e) => setTelefono(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Correo Electrónico</label>
                    <input type="email" className="form-input" placeholder="cliente@correo.com" value={email} onChange={(e) => setEmail(e.target.value)} />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" onClick={() => setShowAddModal(false)} className="btn btn-secondary">Cancelar</button>
                <button type="submit" className="btn btn-primary">Registrar Cliente</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
