'use client';

import { useState, useEffect } from 'react';
import { Building2, MapPin, Plus, Trash2, Power, Settings, MessageSquare, UserPlus, Receipt } from 'lucide-react';

function diasParaVencer(vencimiento?: string | null): number | null {
  if (!vencimiento) return null;
  return Math.ceil((new Date(vencimiento).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

export default function RootEmpresasPage() {
  const [empresas, setEmpresas] = useState<any[]>([]);
  const [planes, setPlanes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [showModal, setShowModal] = useState(false);
  const [selectedEmpresa, setSelectedEmpresa] = useState<any>(null);

  // Cuenta y suscripción
  const [editEstado, setEditEstado] = useState('ACTIVO');
  const [editPlanId, setEditPlanId] = useState('');
  const [editVencimiento, setEditVencimiento] = useState('');
  const [editMensaje, setEditMensaje] = useState('');
  const [savingCuenta, setSavingCuenta] = useState(false);

  // Sucursales
  const [nuevoNombre, setNuevoNombre] = useState('');
  const [nuevaDireccion, setNuevaDireccion] = useState('');
  const [creatingSucursal, setCreatingSucursal] = useState(false);

  // Pagos
  const [pagoMonto, setPagoMonto] = useState('');
  const [pagoMedio, setPagoMedio] = useState('Efectivo');
  const [pagoConcepto, setPagoConcepto] = useState('');
  const [pagoFecha, setPagoFecha] = useState('');
  const [creatingPago, setCreatingPago] = useState(false);

  // Afiliar comercio nuevo
  const [showAfiliarModal, setShowAfiliarModal] = useState(false);
  const [afNombre, setAfNombre] = useState('');
  const [afCuit, setAfCuit] = useState('');
  const [afCondicionIva, setAfCondicionIva] = useState('Responsable Inscripto');
  const [afPlanId, setAfPlanId] = useState('');
  const [afVencimiento, setAfVencimiento] = useState('');
  const [afEstado, setAfEstado] = useState('ACTIVO');
  const [afOwnerNombre, setAfOwnerNombre] = useState('');
  const [afOwnerEmail, setAfOwnerEmail] = useState('');
  const [afOwnerPassword, setAfOwnerPassword] = useState('');
  const [afiliando, setAfiliando] = useState(false);
  const [afError, setAfError] = useState('');

  const [errorMsg, setErrorMsg] = useState('');

  const loadData = async () => {
    try {
      const [empRes, planRes] = await Promise.all([
        fetch('/api/root/empresas'),
        fetch('/api/root/planes'),
      ]);
      const empData = await empRes.json();
      const planData = await planRes.json();
      setEmpresas(Array.isArray(empData) ? empData : []);
      setPlanes(Array.isArray(planData) ? planData : []);
      return Array.isArray(empData) ? empData : [];
    } catch (err) {
      console.error('Failed to load empresas:', err);
      return [];
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openModal = (emp: any) => {
    setSelectedEmpresa(emp);
    setErrorMsg('');

    setEditEstado(emp.estado);
    setEditPlanId(emp.suscripcion?.planId || '');
    setEditMensaje(emp.mensajeAviso || '');

    if (emp.suscripcion?.fechaVencimiento) {
      setEditVencimiento(new Date(emp.suscripcion.fechaVencimiento).toISOString().split('T')[0]);
    } else {
      const date = new Date();
      date.setDate(date.getDate() + 30);
      setEditVencimiento(date.toISOString().split('T')[0]);
    }

    setNuevoNombre('');
    setNuevaDireccion('');
    setShowModal(true);
  };

  const refreshSelected = async () => {
    const list = await loadData();
    if (selectedEmpresa) {
      setSelectedEmpresa(list.find((e: any) => e.id === selectedEmpresa.id) || null);
    }
  };

  const handleGuardarCuenta = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmpresa) return;
    setSavingCuenta(true);
    setErrorMsg('');

    try {
      const res = await fetch('/api/root/empresas', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedEmpresa.id,
          estado: editEstado,
          planId: editPlanId || undefined,
          fechaVencimiento: editVencimiento ? new Date(editVencimiento).toISOString() : undefined,
          mensajeAviso: editMensaje,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'No se pudo guardar la cuenta.');
      await refreshSelected();
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setSavingCuenta(false);
    }
  };

  const handleCreateSucursal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmpresa) return;
    setCreatingSucursal(true);
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
      setCreatingSucursal(false);
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

  const handleRegistrarPago = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmpresa) return;
    setCreatingPago(true);
    setErrorMsg('');

    try {
      const res = await fetch('/api/root/pagos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          empresaId: selectedEmpresa.id,
          monto: pagoMonto,
          medioPago: pagoMedio,
          concepto: pagoConcepto,
          fecha: pagoFecha ? new Date(pagoFecha).toISOString() : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'No se pudo registrar el pago.');

      setPagoMonto('');
      setPagoConcepto('');
      setPagoFecha('');
      await refreshSelected();
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setCreatingPago(false);
    }
  };

  const handleDeletePago = async (pagoId: string) => {
    if (!confirm('¿Eliminar este pago del historial?')) return;
    await fetch(`/api/root/pagos?id=${pagoId}`, { method: 'DELETE' });
    await refreshSelected();
  };

  const openAfiliarModal = () => {
    setAfNombre('');
    setAfCuit('');
    setAfCondicionIva('Responsable Inscripto');
    setAfPlanId('');
    const date = new Date();
    date.setDate(date.getDate() + 30);
    setAfVencimiento(date.toISOString().split('T')[0]);
    setAfEstado('ACTIVO');
    setAfOwnerNombre('');
    setAfOwnerEmail('');
    setAfOwnerPassword('');
    setAfError('');
    setShowAfiliarModal(true);
  };

  const handleAfiliar = async (e: React.FormEvent) => {
    e.preventDefault();
    setAfiliando(true);
    setAfError('');

    try {
      const res = await fetch('/api/root/empresas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: afNombre,
          cuit: afCuit,
          condicionIva: afCondicionIva,
          planId: afPlanId,
          fechaVencimiento: afVencimiento ? new Date(afVencimiento).toISOString() : undefined,
          estado: afEstado,
          ownerNombre: afOwnerNombre,
          ownerEmail: afOwnerEmail,
          ownerPassword: afOwnerPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'No se pudo afiliar el comercio.');

      setShowAfiliarModal(false);
      await loadData();
    } catch (err: any) {
      setAfError(err.message);
    } finally {
      setAfiliando(false);
    }
  };

  return (
    <div>
      <div style={{ marginBottom: '2rem', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ fontSize: '1.75rem', marginBottom: '0.25rem' }}>Empresas Clientes</h2>
          <p style={{ color: 'var(--text-muted)' }}>
            Tus cuentas comerciales activas: suscripción, pagos, aviso y sucursales, todo en un solo lugar.
          </p>
        </div>
        <button onClick={openAfiliarModal} className="btn btn-primary" style={{ whiteSpace: 'nowrap' }}>
          <UserPlus size={16} />
          <span>Afiliar Comercio</span>
        </button>
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
                <th>Estado</th>
                <th>Plan</th>
                <th>Vencimiento</th>
                <th>Sucursales</th>
                <th style={{ textAlign: 'center' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {empresas.map((emp) => {
                const limite = emp.suscripcion?.plan?.limiteSucursales ?? 1;
                const cantidad = emp.sucursales?.length || 0;
                const limiteTexto = limite === 0 ? 'sin límite' : `de ${limite}`;
                const dias = diasParaVencer(emp.suscripcion?.fechaVencimiento);
                const porVencer = dias !== null && dias <= 7;

                return (
                  <tr key={emp.id} style={{ opacity: emp.estado === 'INACTIVO' ? 0.65 : 1 }}>
                    <td style={{ fontWeight: 600 }}>
                      {emp.nombre}
                      {(emp.mensajeAviso || porVencer) && (
                        <MessageSquare size={14} style={{ marginLeft: '0.4rem', color: '#f59e0b', verticalAlign: 'middle' }} />
                      )}
                    </td>
                    <td><code>{emp.cuit}</code></td>
                    <td>
                      <span className={`badge ${emp.estado === 'ACTIVO' ? 'badge-success' : emp.estado === 'PENDIENTE_PAGO' ? 'badge-warning' : 'badge-danger'}`}>
                        {emp.estado}
                      </span>
                    </td>
                    <td>
                      {emp.suscripcion ? (
                        <span className="badge badge-success" style={{ backgroundColor: 'var(--primary-light)', color: 'var(--primary-hover)' }}>
                          {emp.suscripcion.plan.nombre}
                        </span>
                      ) : (
                        <span className="badge badge-warning">Sin Plan</span>
                      )}
                    </td>
                    <td style={{ fontSize: '0.85rem', color: porVencer ? '#b45309' : undefined, fontWeight: porVencer ? 600 : undefined }}>
                      {emp.suscripcion ? new Date(emp.suscripcion.fechaVencimiento).toLocaleDateString('es-AR') : '-'}
                      {porVencer && dias !== null && (
                        <div>{dias < 0 ? 'Vencida' : `${dias} día(s)`}</div>
                      )}
                    </td>
                    <td>{cantidad} {limiteTexto}</td>
                    <td style={{ textAlign: 'center' }}>
                      <button onClick={() => openModal(emp)} className="btn btn-secondary btn-sm" style={{ padding: '0.35rem 0.65rem' }}>
                        <Settings size={14} />
                        <span>Gestionar</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
              {empresas.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
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
                <Building2 size={18} style={{ verticalAlign: 'middle', marginRight: '0.4rem' }} />
                {selectedEmpresa.nombre}
              </h3>
              <button onClick={() => setShowModal(false)} className="btn btn-secondary btn-sm" style={{ padding: '0.25rem 0.5rem' }}>✕</button>
            </div>

            <div className="modal-body">
              {errorMsg && (
                <div style={{ padding: '0.75rem', backgroundColor: '#fee2e2', color: '#b91c1c', borderRadius: 'var(--radius-sm)', marginBottom: '1rem', fontSize: '0.9rem' }}>
                  ⚠️ {errorMsg}
                </div>
              )}

              {/* --- Cuenta y suscripción --- */}
              <h4 style={{ marginBottom: '0.75rem' }}>Cuenta y Suscripción</h4>
              <form onSubmit={handleGuardarCuenta} style={{ marginBottom: '2rem' }}>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Estado de la Cuenta</label>
                    <select className="form-select" value={editEstado} onChange={(e) => setEditEstado(e.target.value)} required>
                      <option value="ACTIVO">ACTIVO (Acceso Total)</option>
                      <option value="PENDIENTE_PAGO">PENDIENTE PAGO (Redirigir a checkout)</option>
                      <option value="INACTIVO">SUSPENDIDO / INACTIVO (Bloqueo)</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Plan Comercial</label>
                    <select className="form-select" value={editPlanId} onChange={(e) => setEditPlanId(e.target.value)} required>
                      <option value="">-- Seleccionar Plan --</option>
                      {planes.map((p) => (
                        <option key={p.id} value={p.id}>
                          Plan {p.nombre} (${parseFloat(p.precioMensual).toLocaleString('es-AR')}/mes)
                        </option>
                      ))}
                    </select>
                  </div>
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

                <div className="form-group">
                  <label className="form-label">Mensaje de aviso personalizado (opcional)</label>
                  <textarea
                    className="form-input"
                    rows={2}
                    placeholder='Ej: "Tu factura de este mes está pendiente, comunicate con tu asesor."'
                    value={editMensaje}
                    onChange={(e) => setEditMensaje(e.target.value)}
                  />
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>
                    Si lo dejás vacío, el comercio ve un aviso automático solo cuando falta 7 días o menos para el vencimiento.
                    Si escribís algo acá, eso es lo único que va a ver (reemplaza al automático).
                  </p>
                </div>

                <button type="submit" className="btn btn-primary" disabled={savingCuenta}>
                  {savingCuenta ? 'Guardando...' : 'Guardar Cuenta'}
                </button>
              </form>

              {/* --- Historial de pagos --- */}
              <h4 style={{ marginBottom: '0.75rem' }}>
                <Receipt size={16} style={{ verticalAlign: 'middle', marginRight: '0.3rem' }} />
                Historial de Pagos
              </h4>

              {selectedEmpresa.pagos?.length > 0 ? (
                <div style={{ marginBottom: '1rem' }}>
                  {selectedEmpresa.pagos.map((pago: any) => (
                    <div
                      key={pago.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.55rem 0.8rem',
                        borderRadius: 'var(--radius-sm)',
                        backgroundColor: 'var(--bg-secondary)',
                        marginBottom: '0.4rem',
                        fontSize: '0.85rem',
                      }}
                    >
                      <div>
                        <span style={{ fontWeight: 600 }}>${parseFloat(pago.monto).toLocaleString('es-AR')}</span>
                        {' · '}{pago.medioPago}
                        {' · '}{new Date(pago.fecha).toLocaleDateString('es-AR')}
                        {pago.concepto && <div style={{ color: 'var(--text-muted)' }}>{pago.concepto}</div>}
                      </div>
                      <button
                        onClick={() => handleDeletePago(pago.id)}
                        className="btn btn-danger btn-sm"
                        title="Eliminar pago"
                        style={{ padding: '0.3rem 0.5rem' }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Mostrando los últimos 5 pagos.</p>
                </div>
              ) : (
                <p style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>Todavía no registraste ningún pago.</p>
              )}

              <form onSubmit={handleRegistrarPago} style={{ marginBottom: '2rem' }}>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Monto ($)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="form-input"
                      value={pagoMonto}
                      onChange={(e) => setPagoMonto(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Medio de Pago</label>
                    <select className="form-select" value={pagoMedio} onChange={(e) => setPagoMedio(e.target.value)}>
                      <option value="Efectivo">Efectivo</option>
                      <option value="Transferencia">Transferencia</option>
                      <option value="Mercado Pago">Mercado Pago</option>
                      <option value="Otro">Otro</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Fecha (opcional)</label>
                    <input
                      type="date"
                      className="form-input"
                      value={pagoFecha}
                      onChange={(e) => setPagoFecha(e.target.value)}
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Concepto (opcional)</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder='Ej: "Cuota Septiembre 2026"'
                    value={pagoConcepto}
                    onChange={(e) => setPagoConcepto(e.target.value)}
                  />
                </div>
                <button type="submit" className="btn btn-primary" disabled={creatingPago}>
                  {creatingPago ? 'Registrando...' : 'Registrar Pago'}
                </button>
              </form>

              {/* --- Sucursales --- */}
              <h4 style={{ marginBottom: '0.75rem' }}>
                <MapPin size={16} style={{ verticalAlign: 'middle', marginRight: '0.3rem' }} />
                Sucursales
              </h4>
              {(() => {
                const limite = selectedEmpresa.suscripcion?.plan?.limiteSucursales ?? 1;
                const cantidad = selectedEmpresa.sucursales?.length || 0;
                const atLimit = limite !== 0 && cantidad >= limite;

                return (
                  <>
                    {selectedEmpresa.sucursales?.length > 0 ? (
                      <div style={{ marginBottom: '1rem' }}>
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
                      <p style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>Todavía no tiene sucursales cargadas.</p>
                    )}

                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                      {cantidad} {limite === 0 ? 'sucursales (sin límite de plan)' : `de ${limite} sucursales permitidas por el plan`}
                    </p>

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
                        <button type="submit" className="btn btn-primary" disabled={creatingSucursal}>
                          <Plus size={14} />
                          <span>{creatingSucursal ? 'Creando...' : 'Agregar'}</span>
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

      {showAfiliarModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header" style={{ backgroundColor: '#ede9fe' }}>
              <h3 style={{ color: '#5b21b6' }}>
                <UserPlus size={18} style={{ verticalAlign: 'middle', marginRight: '0.4rem' }} />
                Afiliar Comercio Nuevo
              </h3>
              <button onClick={() => setShowAfiliarModal(false)} className="btn btn-secondary btn-sm" style={{ padding: '0.25rem 0.5rem' }}>✕</button>
            </div>
            <form onSubmit={handleAfiliar}>
              <div className="modal-body">
                {afError && (
                  <div style={{ padding: '0.75rem', backgroundColor: '#fee2e2', color: '#b91c1c', borderRadius: 'var(--radius-sm)', marginBottom: '1rem', fontSize: '0.9rem' }}>
                    ⚠️ {afError}
                  </div>
                )}

                <h4 style={{ marginBottom: '0.6rem' }}>Datos del Comercio</h4>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Nombre / Razón Social</label>
                    <input type="text" className="form-input" value={afNombre} onChange={(e) => setAfNombre(e.target.value)} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">CUIT (11 dígitos)</label>
                    <input type="text" className="form-input" value={afCuit} onChange={(e) => setAfCuit(e.target.value)} required />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Condición frente al IVA</label>
                  <select className="form-select" value={afCondicionIva} onChange={(e) => setAfCondicionIva(e.target.value)}>
                    <option value="Responsable Inscripto">Responsable Inscripto</option>
                    <option value="Monotributista">Monotributista</option>
                  </select>
                </div>

                <h4 style={{ margin: '1.25rem 0 0.6rem' }}>Suscripción</h4>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Estado</label>
                    <select className="form-select" value={afEstado} onChange={(e) => setAfEstado(e.target.value)}>
                      <option value="ACTIVO">ACTIVO (Acceso Total)</option>
                      <option value="PENDIENTE_PAGO">PENDIENTE PAGO</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Plan</label>
                    <select className="form-select" value={afPlanId} onChange={(e) => setAfPlanId(e.target.value)} required>
                      <option value="">-- Seleccionar Plan --</option>
                      {planes.map((p) => (
                        <option key={p.id} value={p.id}>
                          Plan {p.nombre} (${parseFloat(p.precioMensual).toLocaleString('es-AR')}/mes)
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Vencimiento</label>
                    <input type="date" className="form-input" value={afVencimiento} onChange={(e) => setAfVencimiento(e.target.value)} required />
                  </div>
                </div>

                <h4 style={{ margin: '1.25rem 0 0.6rem' }}>Usuario Dueño (OWNER)</h4>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.6rem' }}>
                  Con este email y contraseña va a entrar el dueño del comercio a su panel.
                </p>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Nombre</label>
                    <input type="text" className="form-input" value={afOwnerNombre} onChange={(e) => setAfOwnerNombre(e.target.value)} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Email</label>
                    <input type="email" className="form-input" value={afOwnerEmail} onChange={(e) => setAfOwnerEmail(e.target.value)} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Contraseña</label>
                    <input type="text" className="form-input" minLength={6} value={afOwnerPassword} onChange={(e) => setAfOwnerPassword(e.target.value)} required />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" onClick={() => setShowAfiliarModal(false)} className="btn btn-secondary" disabled={afiliando}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={afiliando}>
                  {afiliando ? 'Afiliando...' : 'Afiliar Comercio'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
