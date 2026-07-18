import Link from 'next/link';

export default function LandingPage() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <header className="navbar" style={{ padding: '0 5rem', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)' }}>
        <div className="sidebar-logo" style={{ marginBottom: 0, borderBottom: 'none', paddingBottom: 0 }}>
          ◼ ComercioPro
        </div>
        <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
          <Link href="/login" className="btn btn-secondary">
            Iniciar Sesión
          </Link>
          <Link href="/registro" className="btn btn-primary">
            Registrar Comercio
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <section style={{
        padding: '5rem 2rem',
        textAlign: 'center',
        background: 'radial-gradient(circle at top, var(--primary-light) 0%, var(--bg-primary) 100%)',
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div style={{ maxWidth: '800px' }}>
          <span className="badge badge-success" style={{ marginBottom: '1.5rem', fontSize: '0.85rem' }}>
            Facturación Electrónica ARCA/AFIP Integrada
          </span>
          <h1 style={{ fontSize: '3.5rem', color: 'var(--text-main)', marginBottom: '1.5rem', lineHeight: '1.15' }}>
            Gestioná tu comercio sin complicaciones
          </h1>
          <p style={{ fontSize: '1.25rem', color: 'var(--text-muted)', marginBottom: '2.5rem' }}>
            Punto de venta rápido, control de stock, cuentas corrientes, cierres de caja y facturas electrónicas A, B, C y X. Todo en una plataforma simple para cualquier rubro.
          </p>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
            <Link href="/registro" className="btn btn-primary btn-lg">
              Comenzar Prueba Gratis
            </Link>
            <a href="#planes" className="btn btn-secondary btn-lg">
              Ver Planes de Suscripción
            </a>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" style={{ padding: '5rem 2rem', backgroundColor: 'var(--bg-secondary)' }}>
        <div className="container" style={{ textAlign: 'center' }}>
          <h2 style={{ fontSize: '2.25rem', marginBottom: '1rem' }}>Funcionalidades para operar tu negocio</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '3rem', fontSize: '1.1rem' }}>
            Enfocado en las operaciones que más impactan en el mostrador, la caja y la facturación.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '2rem' }}>
            <div className="card" style={{ padding: '2rem' }}>
              <div className="stat-icon" style={{ margin: '0 auto 1.5rem' }}>🛒</div>
              <h3>Punto de Venta Simple</h3>
              <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                Buscá productos por código o nombre, agregá al carrito y calculá subtotales e impuestos al instante. Venta rápida para mostrador o caja.
              </p>
            </div>
            <div className="card" style={{ padding: '2rem' }}>
              <div className="stat-icon" style={{ margin: '0 auto 1.5rem' }}>⚖️</div>
              <h3>Venta por Peso Exacto</h3>
              <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                Configurá precios por kg o unidad y cobrá cantidades fraccionadas en gramos calculando el importe exacto.
              </p>
            </div>
            <div className="card" style={{ padding: '2rem' }}>
              <div className="stat-icon" style={{ margin: '0 auto 1.5rem' }}>📊</div>
              <h3>Factura Electrónica Real</h3>
              <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                Conexión automática a AFIP con tus certificados digitales. Generá CAE oficial en segundos o trabajá en modo demo.
              </p>
            </div>
            <div className="card" style={{ padding: '2rem' }}>
              <div className="stat-icon" style={{ margin: '0 auto 1.5rem' }}>🧾</div>
              <h3>Comprobantes y Notas de Crédito</h3>
              <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                Consultá comprobantes históricos, imprimilos nuevamente y emití notas de crédito A, B, C o X cuando necesites anular una venta.
              </p>
            </div>
            <div className="card" style={{ padding: '2rem' }}>
              <div className="stat-icon" style={{ margin: '0 auto 1.5rem' }}>✅</div>
              <h3>Cierre Z Manual</h3>
              <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                Emití el cierre Z del día con total vendido, discriminado por forma de pago, fondo fijo y plata física esperada en caja.
              </p>
            </div>
            <div className="card" style={{ padding: '2rem' }}>
              <div className="stat-icon" style={{ margin: '0 auto 1.5rem' }}>📈</div>
              <h3>Reportes Comerciales</h3>
              <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                Analizá ventas, IVA, formas de pago, productos más vendidos y clientes con deuda para tomar mejores decisiones.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="planes" style={{ padding: '5rem 2rem', backgroundColor: 'var(--bg-primary)' }}>
        <div className="container" style={{ textAlign: 'center' }}>
          <h2 style={{ fontSize: '2.25rem', marginBottom: '1rem' }}>Planes simples</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '3rem', fontSize: '1.1rem' }}>
            Empezá con una prueba de 7 días o activá el plan mensual. Las restricciones se definirán más adelante.
          </p>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem', maxWidth: '760px', margin: '0 auto' }}>
            {/* Plan Prueba */}
            <div className="card" style={{ display: 'flex', flexDirection: 'column', padding: '2.5rem', border: '1px solid var(--border-color)' }}>
              <h3 style={{ fontSize: '1.5rem', color: 'var(--text-muted)' }}>Versión de prueba</h3>
              <div style={{ margin: '1.5rem 0' }}>
                <span style={{ fontSize: '2.5rem', fontWeight: 700 }}>$0</span>
                <span style={{ color: 'var(--text-muted)' }}> / 7 días</span>
              </div>
              <ul style={{ textAlign: 'left', listStyle: 'none', padding: 0, marginBottom: '2rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <li>✔️ Acceso de prueba por <strong>7 días</strong></li>
                <li>✔️ Probá punto de venta, stock y comprobantes</li>
                <li>✔️ Las restricciones se definirán más adelante</li>
              </ul>
              <Link href="/registro" className="btn btn-secondary" style={{ marginTop: 'auto', width: '100%' }}>
                Iniciar prueba
              </Link>
            </div>

            {/* Plan Mensual */}
            <div className="card" style={{ display: 'flex', flexDirection: 'column', padding: '2.5rem', border: '2px solid var(--primary)', position: 'relative' }}>
              <span className="badge badge-success" style={{ position: 'absolute', top: '1rem', right: '1rem' }}>
                Recomendado
              </span>
              <h3 style={{ fontSize: '1.5rem', color: 'var(--primary)' }}>Plan mensual</h3>
              <div style={{ margin: '1.5rem 0' }}>
                <span style={{ fontSize: '2.5rem', fontWeight: 700 }}>$35.000</span>
                <span style={{ color: 'var(--text-muted)' }}> / mes</span>
              </div>
              <ul style={{ textAlign: 'left', listStyle: 'none', padding: 0, marginBottom: '2rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <li>✔️ Acceso mensual a ComercioPro</li>
                <li>✔️ Punto de venta, stock, caja y comprobantes</li>
                <li>✔️ Las restricciones se definirán más adelante</li>
              </ul>
              <Link href="/registro" className="btn btn-primary" style={{ marginTop: 'auto', width: '100%' }}>
                Suscribirme
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{
        backgroundColor: 'var(--text-main)',
        color: '#e7e5e0',
        padding: '3rem 2rem',
        textAlign: 'center',
        fontSize: '0.9rem',
        borderTop: '1px solid var(--border-color)'
      }}>
        <p>© 2026 ComercioPro. Gestión comercial y facturación para comercios en Argentina.</p>
        <p style={{ marginTop: '0.5rem', opacity: 0.6 }}>Todos los derechos reservados. ARCA / AFIP Web Services Integration.</p>
      </footer>
    </div>
  );
}
