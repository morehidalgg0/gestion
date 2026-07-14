'use client';

import { useState, useEffect } from 'react';
import { Shield, Plus, Key, Mail, User, Pencil, Ban, RotateCcw } from 'lucide-react';

export default function StaffPage() {
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);

  // Form states
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rol, setRol] = useState('EMPLOYEE');
  
  const [errorMsg, setErrorMsg] = useState('');
  const [editErrorMsg, setEditErrorMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadStaff = async () => {
    try {
      const res = await fetch('/api/tenant/usuarios');
      const data = await res.json();
      setUsuarios(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load staff list:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStaff();
  }, []);

  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSubmitting(true);

    try {
      const res = await fetch('/api/tenant/usuarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre,
          email,
          password,
          rol,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'No se pudo crear la cuenta de usuario.');
      }

      // Reset Form
      setNombre('');
      setEmail('');
      setPassword('');
      setRol('EMPLOYEE');
      
      setShowAddModal(false);
      loadStaff();
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const openEditModal = (user: any) => {
    setSelectedUser(user);
    setNombre(user.nombre);
    setEmail(user.email);
    setRol(user.rol);
    setPassword('');
    setEditErrorMsg('');
    setShowEditModal(true);
  };

  const closeEditModal = () => {
    setShowEditModal(false);
    setSelectedUser(null);
    setNombre('');
    setEmail('');
    setPassword('');
    setRol('EMPLOYEE');
    setEditErrorMsg('');
  };

  const handleEditStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;

    setEditErrorMsg('');
    setSubmitting(true);

    try {
      const res = await fetch(`/api/tenant/usuarios/${selectedUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre,
          email,
          rol,
          password: password || undefined,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'No se pudo actualizar el usuario.');
      }

      closeEditModal();
      loadStaff();
    } catch (err: any) {
      setEditErrorMsg(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (user: any) => {
    const action = user.activo ? 'dar de baja' : 'reactivar';
    if (!window.confirm(`Vas a ${action} a ${user.nombre}. ¿Continuar?`)) return;

    try {
      const res = await fetch(`/api/tenant/usuarios/${user.id}`, {
        method: user.activo ? 'DELETE' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: user.activo ? undefined : JSON.stringify({ activo: true }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'No se pudo cambiar el estado del usuario.');
      }
      loadStaff();
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyItems: 'center', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h2 style={{ fontSize: '1.75rem', marginBottom: '0.25rem' }}>Personal y Control de Caja</h2>
          <p style={{ color: 'var(--text-muted)' }}>Administrá las cuentas de tus cajeros y administradores con acceso al local.</p>
        </div>
        <button onClick={() => setShowAddModal(true)} className="btn btn-primary">
          <Plus size={16} />
          <span>Nuevo Usuario</span>
        </button>
      </div>

      {loading ? (
        <p style={{ color: 'var(--text-muted)' }}>Cargando personal...</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '2rem', alignItems: 'start' }}>
          
          {/* USERS LIST TABLE */}
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Email / Usuario</th>
                  <th>Rol / Acceso</th>
                  <th>Estado</th>
                  <th>Fecha de Alta</th>
                  <th style={{ textAlign: 'center' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {usuarios.map((u) => (
                  <tr key={u.id}>
                    <td style={{ fontWeight: 600 }}>{u.nombre}</td>
                    <td><code>{u.email}</code></td>
                    <td>
                      <span className={`badge ${u.rol === 'OWNER' ? 'badge-success' : 'badge-info'}`}>
                        {u.rol === 'OWNER' ? 'Administrador (Dueño)' : 'Cajero / Empleado'}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${u.activo ? 'badge-success' : 'badge-danger'}`}>
                        {u.activo ? 'Activo' : 'Baja'}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      {new Date(u.createdAt).toLocaleDateString('es-AR')}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                        <button onClick={() => openEditModal(u)} className="btn btn-secondary btn-sm" style={{ padding: '0.35rem 0.6rem' }}>
                          <Pencil size={14} />
                          <span>Editar</span>
                        </button>
                        <button onClick={() => handleToggleActive(u)} className={u.activo ? 'btn btn-danger btn-sm' : 'btn btn-secondary btn-sm'} style={{ padding: '0.35rem 0.6rem' }}>
                          {u.activo ? <Ban size={14} /> : <RotateCcw size={14} />}
                          <span>{u.activo ? 'Baja' : 'Reactivar'}</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* PERMISSION INFOCARD */}
          <div className="card">
            <h3 style={{ fontSize: '1.1rem', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Shield size={16} style={{ color: 'var(--primary)' }} />
              <span>Roles de Caja</span>
            </h3>
            <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '1rem', lineHeight: '1.4' }}>
              <div>
                <strong style={{ color: 'var(--text-main)' }}>Administrador (Owner):</strong>
                <p>Tiene acceso completo a todas las secciones. Puede modificar productos, agregar clientes, configurar AFIP y ver los reportes globales.</p>
              </div>
              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem' }}>
                <strong style={{ color: 'var(--text-main)' }}>Cajero (Employee):</strong>
                <p>Orientado a la atención rápida al cliente. Puede vender, ver comprobantes emitidos y consultar su cierre Z diario, sin acceso a reportes ni configuración administrativa.</p>
              </div>
            </div>
          </div>

        </div>
      )}

      {/* ADD STAFF MODAL */}
      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>👥 Agregar Usuario de Personal</h3>
              <button onClick={() => setShowAddModal(false)} className="btn btn-secondary btn-sm" style={{ padding: '0.25rem 0.5rem' }}>✕</button>
            </div>
            <form onSubmit={handleAddStaff}>
              <div className="modal-body">
                {errorMsg && (
                  <div style={{
                    padding: '0.85rem',
                    backgroundColor: '#fee2e2',
                    color: '#b91c1c',
                    borderRadius: 'var(--radius-sm)',
                    marginBottom: '1rem',
                    fontSize: '0.9rem',
                    fontWeight: 500
                  }}>
                    ⚠️ {errorMsg}
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <User size={14} />
                    <span>Nombre Completo</span>
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Ej: Sofía Martínez"
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    required
                    disabled={submitting}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <Mail size={14} />
                    <span>Correo Electrónico (Para login)</span>
                  </label>
                  <input
                    type="email"
                    className="form-input"
                    placeholder="sofia@tucomercio.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={submitting}
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <Key size={14} />
                      <span>Contraseña de Acceso</span>
                    </label>
                    <input
                      type="password"
                      className="form-input"
                      placeholder="Mínimo 6 caracteres"
                      minLength={6}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      disabled={submitting}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Rol de Acceso</label>
                    <select
                      className="form-select"
                      value={rol}
                      onChange={(e) => setRol(e.target.value)}
                      disabled={submitting}
                    >
                      <option value="EMPLOYEE">Cajero / Empleado</option>
                      <option value="OWNER">Administrador / Owner</option>
                    </select>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" onClick={() => setShowAddModal(false)} className="btn btn-secondary" disabled={submitting}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Creando cuenta...' : 'Crear Usuario'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT STAFF MODAL */}
      {showEditModal && selectedUser && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Editar Usuario</h3>
              <button onClick={closeEditModal} className="btn btn-secondary btn-sm" style={{ padding: '0.25rem 0.5rem' }}>X</button>
            </div>
            <form onSubmit={handleEditStaff}>
              <div className="modal-body">
                {editErrorMsg && (
                  <div style={{ padding: '0.85rem', backgroundColor: '#fee2e2', color: '#b91c1c', borderRadius: 'var(--radius-sm)', marginBottom: '1rem', fontSize: '0.9rem', fontWeight: 500 }}>
                    {editErrorMsg}
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label">Nombre Completo</label>
                  <input type="text" className="form-input" value={nombre} onChange={(e) => setNombre(e.target.value)} required disabled={submitting} />
                </div>

                <div className="form-group">
                  <label className="form-label">Correo Electrónico</label>
                  <input type="email" className="form-input" value={email} onChange={(e) => setEmail(e.target.value)} required disabled={submitting} />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Rol de Acceso</label>
                    <select className="form-select" value={rol} onChange={(e) => setRol(e.target.value)} disabled={submitting}>
                      <option value="EMPLOYEE">Cajero / Empleado</option>
                      <option value="OWNER">Administrador / Owner</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Resetear Contraseña</label>
                    <input type="password" className="form-input" placeholder="Dejar vacío para no cambiar" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} disabled={submitting} />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" onClick={closeEditModal} className="btn btn-secondary" disabled={submitting}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>{submitting ? 'Guardando...' : 'Guardar Cambios'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
