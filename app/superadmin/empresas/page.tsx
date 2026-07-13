'use client';

import { useState, useEffect } from 'react';
import { Shield, Settings, CheckCircle, Ban, Calendar, Award } from 'lucide-react';

export default function SuperadminPage() {
  const [empresas, setEmpresas] = useState<any[]>([]);
  const [planes, setPlanes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  
  // Modal Edit states
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedEmpresa, setSelectedEmpresa] = useState<any>(null);
  const [editEstado, setEditEstado] = useState('ACTIVO');
  const [editPlanId, setEditPlanId] = useState('');
  const [editVencimiento, setEditVencimiento] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadData = async () => {
    try {
      const [empRes, planRes] = await Promise.all([
        fetch('/api/superadmin/empresas'),
        fetch('/api/superadmin/planes'),
      ]);
      const empData = await empRes.json();
      const planData = await planRes.json();
      
      setEmpresas(Array.isArray(empData) ? empData : []);
      setPlanes(Array.isArray(planData) ? planData : []);
    } catch (err) {
      console.error('Failed to load superadmin data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openEditModal = (emp: any) => {
    setSelectedEmpresa(emp);
    setEditEstado(emp.estado);
    setEditPlanId(emp.suscripcion?.planId || '');
    
    if (emp.suscripcion?.fechaVencimiento) {
      const date = new Date(emp.suscripcion.fechaVencimiento);
      // Format as YYYY-MM-DD for date input
      setEditVencimiento(date.toISOString().split('T')[0]);
    } else {
      const date = new Date();
      date.setDate(date.getDate() + 30);
      setEditVencimiento(date.toISOString().split('T')[0]);
    }

    setShowEditModal(true);
  };

  const handleUpdateEmpresa = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg('');

    try {
      const res = await fetch('/api/superadmin/empresas', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedEmpresa.id,
          estado: editEstado,
          planId: editPlanId || undefined,
          fechaVencimiento: editVencimiento ? new Date(editVencimiento).toISOString() : undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'No se pudo actualizar el comercio.');
      }

      setShowEditModal(false);
      setSelectedEmpresa(null);
      loadData();
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.75rem', marginBottom: '0.25rem' }}>Control Global de Comercios</h2>
        <p style={{ color: 'var(--text-muted)' }}>Panel del dueño de la plataforma para administrar suscripciones, activar/suspender cuentas y ver métricas de uso.</p>
      </div>

      {loading ? (
        <p style={{ color: 'var(--text-muted)' }}>Cargando registros del SaaS...</p>
      ) : (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Comercio</th>
                <th>CUIT</th>
                <th>Usuarios</th>
                <th>Catálogo</th>
                <th>Ventas</th>
                <th>Plan Activo</th>
                <th>Suscripción</th>
                <th>Estado</th>
                <th style={{ textAlign: 'center' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {empresas.map((emp) => {
                const sub = emp.suscripcion;
                const isSuspended = emp.estado === 'INACTIVO';

                return (
                  <tr key={emp.id} style={{ opacity: isSuspended ? 0.65 : 1 }}>
                    <td style={{ fontWeight: 600 }}>{emp.nombre}</td>
                    <td><code>{emp.cuit}</code></td>
                    <td>{emp.usuarios?.length || 0} usuarios</td>
                    <td>{emp._count?.productos || 0} prod.</td>
                    <td>{emp._count?.ventas || 0} fact.</td>
                    <td>
                      {sub ? (
                        <span className="badge badge-success" style={{ backgroundColor: 'var(--primary-light)', color: 'var(--primary-hover)' }}>
                          {sub.plan.nombre}
                        </span>
                      ) : (
                        <span className="badge badge-warning">Sin Plan</span>
                      )}
                    </td>
                    <td style={{ fontSize: '0.85rem' }}>
                      {sub ? (
                        <>
                          <div style={{ fontWeight: 500, color: sub.estado === 'authorized' ? '#15803d' : '#d97706' }}>
                            {sub.estado.toUpperCase()}
                          </div>
                          <div style={{ color: 'var(--text-muted)' }}>
                            📅 Vence: {new Date(sub.fechaVencimiento).toLocaleDateString('es-AR')}
                          </div>
                        </>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>-</span>
                      )}
                    </td>
                    <td>
                      <span className={`badge ${emp.estado === 'ACTIVO' ? 'badge-success' : emp.estado === 'PENDIENTE_PAGO' ? 'badge-warning' : 'badge-danger'}`}>
                        {emp.estado}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button onClick={() => openEditModal(emp)} className="btn btn-secondary btn-sm" style={{ padding: '0.35rem 0.65rem' }}>
                        <Settings size={14} />
                        <span>Ajustar Cuenta</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
              {empresas.length === 0 && (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                    No hay comercios registrados en la plataforma.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* EDIT MODAL */}
      {showEditModal && selectedEmpresa && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header" style={{ backgroundColor: '#fee2e2' }}>
              <h3 style={{ color: '#b91c1c' }}>🛠️ Ajustar Estado del Comercio</h3>
              <button onClick={() => setShowEditModal(false)} className="btn btn-secondary btn-sm" style={{ padding: '0.25rem 0.5rem' }}>✕</button>
            </div>
            <form onSubmit={handleUpdateEmpresa}>
              <div className="modal-body">
                <p style={{ marginBottom: '1rem', fontSize: '0.95rem' }}>
                  Comercio: <strong>{selectedEmpresa.nombre}</strong> (CUIT: {selectedEmpresa.cuit})
                </p>

                {errorMsg && (
                  <div style={{ padding: '0.75rem', backgroundColor: '#fee2e2', color: '#b91c1c', borderRadius: 'var(--radius-sm)', marginBottom: '1rem', fontSize: '0.9rem' }}>
                    ⚠️ {errorMsg}
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label">Estado de la Cuenta</label>
                  <select
                    className="form-select"
                    value={editEstado}
                    onChange={(e) => setEditEstado(e.target.value)}
                    required
                  >
                    <option value="ACTIVO">ACTIVO (Acceso Total)</option>
                    <option value="PENDIENTE_PAGO">PENDIENTE PAGO (Redirigir a checkout)</option>
                    <option value="INACTIVO">SUSPENDIDO / INACTIVO (Bloqueo)</option>
                  </select>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Plan Comercial</label>
                    <select
                      className="form-select"
                      value={editPlanId}
                      onChange={(e) => setEditPlanId(e.target.value)}
                      required
                    >
                      <option value="">-- Seleccionar Plan --</option>
                      {planes.map((p) => (
                        <option key={p.id} value={p.id}>
                          Plan {p.nombre} (${parseFloat(p.precioMensual).toLocaleString('es-AR')}/mes)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Vencimiento Suscripción</label>
                    <input
                      type="date"
                      className="form-input"
                      value={editVencimiento}
                      onChange={(e) => setEditVencimiento(e.target.value)}
                      required
                    />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" onClick={() => setShowEditModal(false)} className="btn btn-secondary" disabled={submitting}>Cancelar</button>
                <button type="submit" className="btn btn-danger" disabled={submitting}>
                  {submitting ? 'Procesando...' : 'Aplicar Cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
