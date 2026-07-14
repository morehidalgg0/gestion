'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ShoppingCart, AlertTriangle, Users, DollarSign, Package } from 'lucide-react';

export default function DashboardHome() {
  const [session, setSession] = useState<any>(null);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadStats() {
      try {
        const sessionRes = await fetch('/api/auth/session');
        const sessionData = await sessionRes.json();
        if (!sessionData.authenticated) {
          throw new Error('No se pudo validar la sesión.');
        }

        setSession(sessionData.user);

        if (sessionData.user.rol === 'EMPLOYEE') {
          const [ventasRes, productosRes] = await Promise.all([
            fetch('/api/tenant/ventas'),
            fetch('/api/tenant/productos'),
          ]);

          if (!ventasRes.ok || !productosRes.ok) {
            throw new Error('Error al cargar estadísticas.');
          }

          const ventas = await ventasRes.json();
          const productos = await productosRes.json();
          const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' });
          const ventasHoy = Array.isArray(ventas)
            ? ventas.filter((venta: any) => new Date(venta.fecha).toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }) === today && venta.estado !== 'RECHAZADO_AFIP')
            : [];
          const totalVentas = ventasHoy.reduce((acc: number, venta: any) => {
            const total = Number(venta.total) || 0;
            return acc + (venta.tipoComprobante?.startsWith('Nota de Crédito') ? -total : total);
          }, 0);
          const lowStock = Array.isArray(productos)
            ? productos
                .filter((prod: any) => Number(prod.stockActual) <= Number(prod.stockMinimo))
                .sort((a: any, b: any) => Number(a.stockActual) - Number(b.stockActual))
                .slice(0, 10)
                .map((prod: any) => ({
                  id: prod.id,
                  codigo: prod.codigo,
                  nombre: prod.nombre,
                  stock: Number(prod.stockActual),
                  min: Number(prod.stockMinimo),
                  unidad: prod.unidad,
                }))
            : [];

          setData({
            stats: {
              totalVentas,
              cantidadVentas: ventasHoy.length,
            },
            debtors: [],
            lowStock,
          });
          return;
        }

        const res = await fetch('/api/tenant/reportes?periodo=dia');
        if (!res.ok) throw new Error('Error al cargar estadísticas.');
        const statsData = await res.json();
        setData(statsData);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    loadStats();
  }, []);

  if (loading) {
    return <p style={{ color: 'var(--text-muted)' }}>Cargando resumen de operaciones...</p>;
  }

  // Calculate outstanding debt
  const totalDebt = data?.debtors.reduce((acc: number, curr: any) => acc + curr.saldo, 0) || 0;

  return (
    <div>
      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.75rem', marginBottom: '0.25rem' }}>Resumen del Local</h2>
        <p style={{ color: 'var(--text-muted)' }}>Indicadores clave de la jornada de hoy.</p>
      </div>

      {error && (
        <div style={{ padding: '1rem', backgroundColor: '#fee2e2', color: '#b91c1c', borderRadius: 'var(--radius-md)', marginBottom: '1.5rem' }}>
          ⚠️ {error}
        </div>
      )}

      {/* Stats row */}
      <div className="grid-stats">
        <div className="card stat-card">
          <div className="stat-icon" style={{ backgroundColor: 'var(--primary-light)', color: 'var(--primary)' }}>
            <ShoppingCart size={24} />
          </div>
          <div className="stat-info">
            <span className="stat-label">Ventas de Hoy</span>
            <span className="stat-value">${data?.stats?.totalVentas.toLocaleString('es-AR') || 0}</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {data?.stats?.cantidadVentas || 0} comprobantes
            </span>
          </div>
        </div>

        <div className="card stat-card">
          <div className="stat-icon" style={{ backgroundColor: '#fef3c7', color: '#d97706' }}>
            <DollarSign size={24} />
          </div>
          <div className="stat-info">
            <span className="stat-label">Fiados en Cuenta Corriente</span>
            <span className="stat-value">${totalDebt.toLocaleString('es-AR')}</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Deuda de clientes destacados
            </span>
          </div>
        </div>

        <div className="card stat-card">
          <div className="stat-icon" style={{ backgroundColor: '#fee2e2', color: '#ef4444' }}>
            <AlertTriangle size={24} />
          </div>
          <div className="stat-info">
            <span className="stat-label">Alertas de Stock</span>
            <span className="stat-value" style={{ color: data?.lowStock?.length > 0 ? '#ef4444' : 'inherit' }}>
              {data?.lowStock?.length || 0}
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Productos bajo mínimo
            </span>
          </div>
        </div>
      </div>

      {/* Main dashboard columns */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem', marginTop: '2rem' }}>
        
        {/* Critical Stock Alerts */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="card-header">
            <h3>⚠️ Alertas Críticas de Stock</h3>
            <Link href="/dashboard/productos" className="btn btn-secondary btn-sm">
              Gestionar Stock
            </Link>
          </div>
          
          {data?.lowStock?.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              ✅ ¡Felicitaciones! Todos tus productos tienen stock suficiente.
            </div>
          ) : (
            <div className="table-container" style={{ border: 'none', boxShadow: 'none', margin: 0 }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Código</th>
                    <th>Producto</th>
                    <th>Stock Actual</th>
                    <th>Mínimo</th>
                    <th>Unidad</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.lowStock.map((prod: any) => (
                    <tr key={prod.id}>
                      <td><code>{prod.codigo}</code></td>
                      <td style={{ fontWeight: 500 }}>{prod.nombre}</td>
                      <td style={{ color: '#ef4444', fontWeight: 600 }}>{prod.stock}</td>
                      <td>{prod.min}</td>
                      <td>{prod.unidad}</td>
                      <td>
                        <span className="badge badge-danger">
                          {prod.stock === 0 ? 'Sin Stock' : 'Stock Bajo'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Quick Links / Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="card">
            <h3 style={{ marginBottom: '1rem' }}>Accesos Rápidos</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <Link href="/dashboard/ventas" className="btn btn-primary" style={{ width: '100%', padding: '0.85rem' }}>
                🛒 Iniciar Nueva Venta (POS)
              </Link>
              {session?.rol !== 'EMPLOYEE' && (
                <Link href="/dashboard/cuentas-corrientes" className="btn btn-secondary" style={{ width: '100%', padding: '0.85rem' }}>
                  💵 Registrar Pago de Cliente
                </Link>
              )}
              {session?.rol !== 'EMPLOYEE' && (
                <Link href="/dashboard/config-afip" className="btn btn-secondary" style={{ width: '100%', padding: '0.85rem' }}>
                  ⚙️ Configurar AFIP / Certs
                </Link>
              )}
            </div>
          </div>

          <div className="card" style={{ backgroundColor: 'var(--primary-light)', borderColor: 'var(--primary)' }}>
            <h3 style={{ color: 'var(--primary-hover)', marginBottom: '0.5rem' }}>Soporte Comercial</h3>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
              ¿Necesitás ayuda para delegar tu CUIT en AFIP o configurar tu facturación real?
            </p>
            <a href="mailto:soporte@comerciopro.com" className="btn btn-primary btn-sm" style={{ marginTop: '1rem', width: '100%' }}>
              📧 Contactar Soporte
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
