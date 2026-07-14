'use client';

import { useState, useEffect } from 'react';
import { Settings, Shield, Upload, FileText, CheckCircle, AlertTriangle } from 'lucide-react';

export default function ConfigAfipPage() {
  const [cuit, setCuit] = useState('');
  const [razonSocial, setRazonSocial] = useState('');
  const [condicionIva, setCondicionIva] = useState('Responsable Inscripto');
  const [puntoVenta, setPuntoVenta] = useState('1');
  const [modo, setModo] = useState('demo');
  
  // Files content (PEM strings)
  const [certificado, setCertificado] = useState('');
  const [clavePrivada, setClavePrivada] = useState('');
  const [certFileName, setCertFileName] = useState('');
  const [keyFileName, setKeyFileName] = useState('');

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [hasCert, setHasCert] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const loadConfig = async () => {
    try {
      const res = await fetch('/api/tenant/config-afip');
      const data = await res.json();
      
      setCuit(data.cuit || '');
      setRazonSocial(data.razonSocial || '');
      setCondicionIva(data.condicionIva || 'Responsable Inscripto');
      setPuntoVenta(data.puntoVenta?.toString() || '1');
      setModo(data.modo || 'demo');
      setHasCert(data.hasCert || false);
    } catch (err) {
      console.error('Failed to load AFIP config:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConfig();
  }, []);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'cert' | 'key') => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (type === 'cert') setCertFileName(file.name);
    else setKeyFileName(file.name);

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (type === 'cert') {
        setCertificado(content);
      } else {
        setClavePrivada(content);
      }
    };
    reader.readAsText(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setSuccessMsg('');
    setErrorMsg('');

    // CUIT validation
    const cleanCuit = cuit.replace(/\D/g, '');
    if (cleanCuit.length !== 11) {
      setErrorMsg('El CUIT del emisor debe tener exactamente 11 dígitos.');
      setSubmitting(false);
      return;
    }

    // If changing mode to real connection but no cert uploaded yet
    if (modo !== 'demo' && !hasCert && (!certificado || !clavePrivada)) {
      setErrorMsg('Para habilitar el modo de facturación real (Homologación o Producción) debes adjuntar tu certificado (.crt) y clave privada (.key).');
      setSubmitting(false);
      return;
    }

    try {
      const response = await fetch('/api/tenant/config-afip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cuit: cleanCuit,
          razonSocial,
          condicionIva,
          puntoVenta: parseInt(puntoVenta, 10),
          modo,
          certificado: certificado || undefined,
          clavePrivada: clavePrivada || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Ocurrió un error al guardar la configuración.');
      }

      setSuccessMsg('Configuración guardada y encriptada correctamente.');
      
      // Clear local file states
      setCertificado('');
      setClavePrivada('');
      setCertFileName('');
      setKeyFileName('');
      
      // Reload updated values
      loadConfig();
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <p style={{ color: 'var(--text-muted)' }}>Cargando asistente de configuración AFIP...</p>;
  }

  return (
    <div style={{ maxWidth: '850px', margin: '0 auto' }}>
      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.75rem', marginBottom: '0.25rem' }}>Configuración Fiscal AFIP / ARCA</h2>
        <p style={{ color: 'var(--text-muted)' }}>Enlazá tu CUIT y tus certificados criptográficos para habilitar la facturación electrónica real.</p>
      </div>

      {successMsg && (
        <div style={{
          padding: '1rem',
          backgroundColor: '#dcfce7',
          color: '#15803d',
          borderRadius: 'var(--radius-md)',
          fontWeight: 500,
          marginBottom: '1.5rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          <CheckCircle size={18} />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div style={{
          padding: '1rem',
          backgroundColor: '#fee2e2',
          color: '#b91c1c',
          borderRadius: 'var(--radius-md)',
          fontWeight: 500,
          marginBottom: '1.5rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          <AlertTriangle size={18} />
          <span>{errorMsg}</span>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: '2rem' }}>
        
        {/* CONFIGURATION FORM */}
        <div className="card" style={{ padding: '2rem' }}>
          <h3 style={{ marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
            ⚙️ Datos de Facturación
          </h3>

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Razón Social del Comercio (Emisor)</label>
              <input
                type="text"
                className="form-input"
                placeholder="Ej: Comercial La Esquina S.A."
                value={razonSocial}
                onChange={(e) => setRazonSocial(e.target.value)}
                required
                disabled={submitting}
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">CUIT de la Empresa (11 dígitos)</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="20123456789"
                  maxLength={11}
                  value={cuit}
                  onChange={(e) => setCuit(e.target.value)}
                  required
                  disabled={submitting}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Categoría Impositiva</label>
                <select
                  className="form-select"
                  value={condicionIva}
                  onChange={(e) => setCondicionIva(e.target.value)}
                  disabled={submitting}
                >
                  <option value="Responsable Inscripto">Responsable Inscripto</option>
                  <option value="Monotributista">Monotributista</option>
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Punto de Venta Autorizado (AFIP)</label>
                <input
                  type="number"
                  className="form-input"
                  placeholder="1"
                  value={puntoVenta}
                  onChange={(e) => setPuntoVenta(e.target.value)}
                  required
                  disabled={submitting}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Modo de Operación</label>
                <select
                  className="form-select"
                  value={modo}
                  onChange={(e) => setModo(e.target.value)}
                  disabled={submitting}
                >
                  <option value="demo">Demo Interna (Comprobantes Simulados)</option>
                  <option value="homologacion">Homologación (Pruebas AFIP)</option>
                  <option value="produccion">Producción (Invoices Fiscales Reales ⚠️)</option>
                </select>
              </div>
            </div>

            {/* Certs upload section */}
            <div style={{ marginTop: '2rem', borderTop: '1px dashed var(--border-color)', paddingTop: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h4 style={{ fontSize: '1rem' }}>🔑 Certificados Digitales (.crt y .key)</h4>
                {hasCert ? (
                  <span className="badge badge-success">Certificados Activos</span>
                ) : (
                  <span className="badge badge-danger">Faltan Certificados</span>
                )}
              </div>

              {hasCert && (
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                  💡 Ya hay credenciales registradas. Solo carga archivos nuevos si deseas reemplazarlas (por ejemplo si vencieron).
                </p>
              )}

              <div className="form-row">
                {/* CRT File */}
                <div className="form-group">
                  <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <FileText size={14} />
                    <span>Certificado (.crt)</span>
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type="file"
                      id="cert-file"
                      accept=".crt,.pem"
                      onChange={(e) => handleFileUpload(e, 'cert')}
                      style={{ display: 'none' }}
                    />
                    <label
                      htmlFor="cert-file"
                      className="btn btn-secondary btn-sm"
                      style={{ width: '100%', cursor: 'pointer', display: 'flex', gap: '0.5rem' }}
                    >
                      <Upload size={14} />
                      <span>{certFileName ? certFileName.substring(0, 15) + '...' : 'Subir Certificado'}</span>
                    </label>
                  </div>
                </div>

                {/* Private Key */}
                <div className="form-group">
                  <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <FileText size={14} />
                    <span>Clave Privada (.key)</span>
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type="file"
                      id="key-file"
                      accept=".key,.pem"
                      onChange={(e) => handleFileUpload(e, 'key')}
                      style={{ display: 'none' }}
                    />
                    <label
                      htmlFor="key-file"
                      className="btn btn-secondary btn-sm"
                      style={{ width: '100%', cursor: 'pointer', display: 'flex', gap: '0.5rem' }}
                    >
                      <Upload size={14} />
                      <span>{keyFileName ? keyFileName.substring(0, 15) + '...' : 'Subir Clave Privada'}</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-lg"
              style={{ width: '100%', marginTop: '1.5rem' }}
              disabled={submitting}
            >
              {submitting ? 'Guardando configuración...' : 'Guardar Cambios Fiscales'}
            </button>
          </form>
        </div>

        {/* SECURITY & HELP SIDEBAR */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          <div className="card" style={{ borderColor: 'var(--primary)', backgroundColor: 'var(--primary-light)' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.1rem', color: 'var(--primary-hover)', marginBottom: '0.75rem' }}>
              <Shield size={18} />
              <span>Cifrado de Extrema Seguridad</span>
            </h3>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
              Tus claves privadas de AFIP se encriptan utilizando el algoritmo estándar de grado militar <strong>AES-256-GCM</strong> antes de guardarse en nuestra base de datos.
            </p>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginTop: '0.5rem', lineHeight: '1.4' }}>
              El descifrado de tus certificados se realiza exclusivamente en memoria en el momento de procesar una factura oficial y nunca se almacenan archivos en texto plano en el disco de los servidores.
            </p>
          </div>

          <div className="card">
            <h3 style={{ fontSize: '1.05rem', marginBottom: '0.75rem' }}>¿Cómo activar AFIP?</h3>
            <ol style={{ paddingLeft: '1.25rem', fontSize: '0.85rem', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <li>
                Generá tu clave privada (<code>.key</code>) y archivo de pedido de certificado (<code>.csr</code>) desde tu equipo o solicitanos asistencia.
              </li>
              <li>
                Accedé al portal de ARCA/AFIP con tu clave fiscal nivel 3 y registrá el certificado en el servicio <strong>"Administración de Certificados Digitales"</strong>.
              </li>
              <li>
                Vinculá el certificado al Web Service <strong>"Facturación Electrónica" (wsfe)</strong> mediante el administrador de relaciones.
              </li>
              <li>
                Subí el certificado aprobado (<code>.crt</code>) y tu clave privada aquí, configura tu número de Punto de Venta habilitado ¡y listo!
              </li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
