'use client';

import { useState, useEffect } from 'react';
import { Building2, MapPin, Plus, Trash2, Power } from 'lucide-react';

export default function RootEmpresasPage() {
  const [empresas, setEmpresas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [showModal, setShowModal] = useState(false);
  const [selectedEmpresa, setSelectedEmpresa] = useState<any>(null);
  const [nuevoNombre, setNuevoNombre] = useState('');
  const [nuevaDireccion, setNuevaDireccion] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadData = async () => {
    try {
      const res = await fetch('/api/root/empresas');
      const data = await res.json();
      setEmpresas(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load empresas:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openModal = (emp: any) => {
    setSelectedEmpresa(emp);
    setNuevoNombre('');
    setNuevaDireccion('');
    setErrorMsg('');
    setShowModal(true);
  };

  const refreshSelected = async () => {
    const res = await fetch('/api/root/empresas');
    const data = await res.json();
    const list = Array.isArray(data) ? data : [];
    setEmpresas(list);
    if (selectedEmpresa) {
      setSelectedEmpresa(list.find((e: any) => e.id === selectedEmpresa.id) || null);
    }
  };

  const handleCreateSucursal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmpresa) return;
    setSubmitting(true);
    setErrorMsg('');

    try {
      const res = await fetch('/api/root/sucursales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          empresaId: selectedEmpresa.id,
          nombre: nuevoNombre,
          direccion: nuevaDireccion,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'No se pudo crear la sucursal.');

      setNuevoNombre('');
      setNuevaDireccion('');
      await refreshSelected();
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActiva = async (sucursal: any) => {
    await fetch('/api/root/sucursales', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: sucursal.id, activa: !sucursal.activa }),
    });
    await refreshSelected();
  };

  const handleDeleteSucursal = async (sucursal: any) => {
    if (!confirm(`¿Eliminar la sucursal "${sucursal.nombre}"? Esta acción no se puede deshacer.`)) return;
    await fetch(`/api/root/sucursales?id=${sucursal.id}`, { method: 'DELETE' });
    await refreshSelected();
  };

  return (
    <div>
      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.75rem', marginBottom: '0.25rem' }}>Empresas y Sucursales</h2>
        <p style={{ color: 'var(--text-muted)' }}>
          Abrí o cerrá sucursales para cada comercio cliente. El máximo permitido depende del plan contratado
          (ajustable en <strong>Planes y Límites</strong>).
        </p>
      </div>

      {loading ? (
        <p style={{ color: 'var(--text-muted)' }}>Cargando comercios...</p>
      ) : (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Comercio</th>
                <th>CUIT</th>
                <th>Plan</th>
                <th>Sucursales</th>
                <th style={{ textAlign: 'center' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {empresas.map((emp) => {
                const limite = emp.suscripcion?.plan?.limiteSucursales ?? 1;
                const cantidad = emp.sucursales?.length || 0;
                const limiteTexto = limite === 0 ? 'sin límite' : `de ${limite}`;

                return (
                  <tr key={emp.id}>
                    <td style={{ fontWeight: 600 }}>{emp.nombre}</td>
                    <td><code>{emp.cuit}</code></td>
                    <td>
                      {emp.suscripcion ? (
                        <span className="badge badge-success" style={{ backgroundColor: 'var(--primary-light)', color: 'var(--primary-hover)' }}>
                          {emp.suscripcion.plan.nombre}
                        </span>
                      ) : (
                        <span className="badge badge-warning">Sin Plan</span>
                      )}
                    </td>
                    <td>
                      {cantidad} {limiteTexto}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button onClick={() => openModal(emp)} className="btn btn-secondary btn-sm" style={{ padding: '0.35rem 0.65rem' }}>
                        <Building2 size={14} />
                        <span>Gestionar Sucursales</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
              {empresas.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                    No hay comercios registrados en la plataforma.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {showModal && selectedEmpresa && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header" style={{ backgroundColor: '#ede9fe' }}>
              <h3 style={{ color: '#5b21b6' }}>
                <MapPin size={18} style={{ verticalAlign: 'middle', marginRight: '0.4rem' }} />
                Sucursales de {selectedEmpresa.nombre}
              </h3>
              <button onClick={() => setShowModal(false)} className="btn btn-secondary btn-sm" style={{ padding: '0.25rem 0.5rem' }}>✕</button>
            </div>

            <div className="modal-body">
              {(() => {
                const limite = selectedEmpresa.suscripcion?.plan?.limiteSucursales ?? 1;
                const cantidad = selectedEmpresa.sucursales?.length || 0;
                const atLimit = limite !== 0 && cantidad >= limite;

                return (
                  <>
                    {selectedEmpresa.sucursales?.length > 0 ? (
                      <div style={{ marginBottom: '1.5rem' }}>
                        {selectedEmpresa.sucursales.map((suc: any) => (
                          <div
                            key={suc.id}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '0.6rem 0.8rem',
                              borderRadius: 'var(--radius-sm)',
                              backgroundColor: 'var(--bg-secondary)',
                              marginBottom: '0.5rem',
                              opacity: suc.activa ? 1 : 0.55,
                            }}
                          >
                            <div>
                              <div style={{ fontWeight: 600 }}>{suc.nombre}</div>
                              {suc.direccion && (
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{suc.direccion}</div>
                              )}
                            </div>
                            <div style={{ display: 'flex', gap: '0.4rem' }}>
                              <button
                                onClick={() => handleToggleActiva(suc)}
                                className="btn btn-secondary btn-sm"
                                title={suc.activa ? 'Desactivar' : 'Activar'}
                                style={{ padding: '0.3rem 0.5rem' }}
                              >
                                <Power size={14} />
                              </button>
                              <button
                                onClick={() => handleDeleteSucursal(suc)}
                                className="btn btn-danger btn-sm"
                                title="Eliminar"
                                style={{ padding: '0.3rem 0.5rem' }}
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>Todavía no tiene sucursales cargadas.</p>
                    )}

                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                      {cantidad} {limite === 0 ? 'sucursales (sin límite de plan)' : `de ${limite} sucursales permitidas por el plan`}
                    </p>

                    {errorMsg && (
                      <div style={{ padding: '0.75rem', backgroundColor: '#fee2e2', color: '#b91c1c', borderRadius: 'var(--radius-sm)', marginBottom: '1rem', fontSize: '0.9rem' }}>
                        ⚠️ {errorMsg}
                      </div>
                    )}

                    {atLimit ? (
                      <div style={{ padding: '0.75rem', backgroundColor: '#fef3c7', color: '#92400e', borderRadius: 'var(--radius-sm)', fontSize: '0.9rem' }}>
                        Este comercio llegó al límite de sucursales de su plan. Subí el límite desde <strong>Planes y Límites</strong> para agregar más.
                      </div>
                    ) : (
                      <form onSubmit={handleCreateSucursal} style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="Nombre de la sucursal"
                          value={nuevoNombre}
                          onChange={(e) => setNuevoNombre(e.target.value)}
                          required
                          style={{ flex: '1 1 180px' }}
                        />
                        <input
                          type="text"
                          className="form-input"
                          placeholder="Dirección (opcional)"
                          value={nuevaDireccion}
                          onChange={(e) => setNuevaDireccion(e.target.value)}
                          style={{ flex: '1 1 220px' }}
                        />
                        <button type="submit" className="btn btn-primary" disabled={submitting}>
                          <Plus size={14} />
                          <span>{submitting ? 'Creando...' : 'Agregar'}</span>
                        </button>
                      </form>
                    )}
                  </>
                );
              })()}
            </div>

            <div className="modal-footer">
              <button type="button" onClick={() => setShowModal(false)} className="btn btn-secondary">Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
