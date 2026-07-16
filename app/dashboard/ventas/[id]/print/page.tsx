'use client';

import { useEffect, useState, use } from 'react';
import { Printer, X } from 'lucide-react';

export default function PrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [venta, setVenta] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchVenta = async () => {
      try {
        const res = await fetch(`/api/tenant/ventas/${id}`);
        if (!res.ok) {
          throw new Error('No se pudo obtener el comprobante.');
        }
        const data = await res.json();
        setVenta(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchVenta();
  }, [id]);

  if (loading) {
    return <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Cargando comprobante...</div>;
  }

  if (error || !venta) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: '#ef4444' }}>
        <h3>⚠️ Error</h3>
        <p>{error || 'Comprobante no disponible.'}</p>
      </div>
    );
  }

  const { items, cliente, empresa } = venta;
  const config = empresa?.configAfip;
  const isFiscal = venta.estado !== 'DEMO' && venta.cae;

  // Determine letter box
  let letter = 'X';
  let title = 'DOCUMENTO NO VÁLIDO COMO FACTURA';
  let subtitle = 'COMPROBANTE CLASE "X"';
  
  if (venta.tipoComprobante === 'Factura A' || venta.tipoComprobante === 'Nota de Crédito A') {
    letter = 'A';
    title = venta.tipoComprobante.startsWith('Nota') ? 'NOTA DE CRÉDITO' : 'FACTURA';
    subtitle = 'COMPROBANTE CLASE "A"';
  } else if (venta.tipoComprobante === 'Factura B' || venta.tipoComprobante === 'Nota de Crédito B') {
    letter = 'B';
    title = venta.tipoComprobante.startsWith('Nota') ? 'NOTA DE CRÉDITO' : 'FACTURA';
    subtitle = 'COMPROBANTE CLASE "B"';
  } else if (venta.tipoComprobante === 'Factura C' || venta.tipoComprobante === 'Nota de Crédito C') {
    letter = 'C';
    title = venta.tipoComprobante.startsWith('Nota') ? 'NOTA DE CRÉDITO' : 'FACTURA';
    subtitle = 'COMPROBANTE CLASE "C"';
  } else if (venta.tipoComprobante === 'Nota de Crédito X') {
    title = 'NOTA DE CRÉDITO';
    subtitle = 'COMPROBANTE CLASE "X"';
  }

  const code = venta.tipoComprobante === 'Factura A' ? '01'
    : venta.tipoComprobante === 'Nota de Crédito A' ? '03'
    : venta.tipoComprobante === 'Factura B' ? '06'
    : venta.tipoComprobante === 'Nota de Crédito B' ? '08'
    : venta.tipoComprobante === 'Factura C' ? '11'
    : venta.tipoComprobante === 'Nota de Crédito C' ? '13'
    : '99';

  const formattedDocNum = `${venta.puntoVenta.toString().padStart(4, '0')}-${venta.numeroComprobante.toString().padStart(8, '0')}`;
  const fechaHora = new Date(venta.createdAt);

  return (
    <div className="print-page-root" style={{ background: '#f5f5f5', minHeight: '100vh', padding: '1.5rem 0' }}>
      
      {/* PRINT TOOLBAR (Hidden in Print) */}
      <div className="no-print" style={{
        maxWidth: '580px',
        margin: '0 auto 1.5rem auto',
        padding: '0.75rem 1.25rem',
        backgroundColor: '#ffffff',
        borderRadius: 'var(--radius-md)',
        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Vista de Impresión</span>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button onClick={() => window.print()} className="btn btn-primary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <Printer size={14} />
            <span>Imprimir (Ctrl+P)</span>
          </button>
          <button onClick={() => window.close()} className="btn btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <X size={14} />
            <span>Cerrar</span>
          </button>
        </div>
      </div>

      {/* RECEIPT WRAPPER */}
      <div style={{
        maxWidth: '500px',
        margin: '0 auto',
        padding: '2.5rem 2rem',
        backgroundColor: '#ffffff',
        boxShadow: '0 1px 3px rgb(0 0 0 / 0.1)',
        border: '1px solid #e5e7eb',
        fontFamily: 'Courier New, monospace',
        color: '#000000',
        lineHeight: '1.3'
      }} className="print-ticket">
        
        {/* Argentina Standard Invoice Header Box */}
        <div style={{
          border: '2px solid #000000',
          position: 'relative',
          padding: '1rem',
          marginBottom: '1.5rem'
        }}>
          {/* Centered Letter Code */}
          <div style={{
            position: 'absolute',
            top: '-1px',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            border: '2px solid #000000',
            backgroundColor: '#ffffff',
            width: '45px',
            height: '45px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            fontWeight: 'bold',
            fontSize: '1.75rem',
            lineHeight: 1
          }}>
            {letter}
            <span style={{ fontSize: '0.45rem', textTransform: 'uppercase' }}>cod. {code}</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '0.5rem' }}>
            {/* Left Col: Emisor Info */}
            <div style={{ fontSize: '0.75rem' }}>
              <div style={{ fontWeight: 'bold', fontSize: '0.95rem', marginBottom: '0.25rem' }}>
                {config?.razonSocial || empresa?.nombre || 'Comercio Demo'}
              </div>
              <div>CUIT: {config?.cuit || empresa?.cuit || '-'}</div>
              <div>Cond. IVA: {config?.condicionIva || empresa?.condicionIva || '-'}</div>
              <div>P. Venta: {venta.puntoVenta.toString().padStart(4, '0')}</div>
            </div>

            {/* Right Col: Invoice Info */}
            <div style={{ fontSize: '0.75rem', textAlign: 'right' }}>
              <div style={{ fontWeight: 'bold', fontSize: '0.95rem', marginBottom: '0.25rem' }}>
                {title}
              </div>
              <div style={{ fontWeight: 'bold', marginBottom: '0.25rem' }}>
                {subtitle}
              </div>
              <div>Nº: {formattedDocNum}</div>
              <div>Fecha: {fechaHora.toLocaleDateString('es-AR')}</div>
              <div>Hora: {fechaHora.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })} hs</div>
            </div>
          </div>
        </div>

        {/* CLIENT INFO SECTION */}
        <div style={{
          borderBottom: '1px dashed #000000',
          paddingBottom: '0.75rem',
          marginBottom: '1rem',
          fontSize: '0.8rem'
        }}>
          <div style={{ fontWeight: 'bold', marginBottom: '0.25rem' }}>RECEPTOR:</div>
          <div>Cliente: <strong>{cliente.razonSocial}</strong></div>
          <div>{cliente.tipoDoc}: {cliente.nroDoc}</div>
          <div>Cond. IVA: {cliente.condicionIva}</div>
          {cliente.direccion && <div>Dirección: {cliente.direccion}</div>}
        </div>

        {/* ITEMS LIST */}
        <div style={{ minHeight: '120px', fontSize: '0.8rem' }}>
          {/* Header */}
          <div style={{
            display: 'flex',
            fontWeight: 'bold',
            borderBottom: '1px solid #000000',
            paddingBottom: '0.25rem',
            marginBottom: '0.5rem'
          }}>
            <div style={{ flex: '2' }}>Descripción</div>
            <div style={{ flex: '1', textAlign: 'right' }}>Cant.</div>
            <div style={{ flex: '1', textAlign: 'right' }}>P.Unit</div>
            <div style={{ flex: '1', textAlign: 'right' }}>Total</div>
          </div>

          {/* Table Items */}
          {items.map((item: any) => (
            <div key={item.id} style={{ display: 'flex', marginBottom: '0.4rem' }}>
              <div style={{ flex: '2', wordBreak: 'break-word' }}>{item.productoName}</div>
              <div style={{ flex: '1', textAlign: 'right' }}>
                {parseFloat(item.cantidad).toFixed(item.productoName.toLowerCase().includes('peso') || item.productoName.toLowerCase().includes('kg') ? 3 : 2)}
              </div>
              <div style={{ flex: '1', textAlign: 'right' }}>
                ${parseFloat(item.precioUnitario).toFixed(2)}
              </div>
              <div style={{ flex: '1', textAlign: 'right', fontWeight: 'bold' }}>
                ${parseFloat(item.subtotal).toFixed(2)}
              </div>
            </div>
          ))}
        </div>

        {/* BILL TOTALS */}
        <div style={{
          borderTop: '1px dashed #000000',
          paddingTop: '0.75rem',
          marginTop: '1rem',
          fontSize: '0.85rem'
        }}>
          {letter === 'A' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', paddingRight: '0.25rem', marginBottom: '0.5rem', opacity: 0.8, fontSize: '0.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Subtotal (Neto):</span>
                <span>${parseFloat(venta.subtotal).toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>IVA Discriminado:</span>
                <span>${parseFloat(venta.iva).toFixed(2)}</span>
              </div>
            </div>
          )}

          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: '1.15rem',
            fontWeight: 'bold',
            marginTop: '0.25rem'
          }}>
            <span>TOTAL:</span>
            <span>${parseFloat(venta.total).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
          </div>
          <div style={{ fontSize: '0.75rem', marginTop: '0.5rem', fontStyle: 'italic' }}>
            Forma de Pago: {venta.formaPago}
          </div>
        </div>

        {/* FISCAL DATA FOOTER (AFIP) */}
        {isFiscal ? (
          <div style={{
            marginTop: '2rem',
            paddingTop: '0.75rem',
            borderTop: '1px solid #000000',
            fontSize: '0.75rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.2rem'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
              <span>🔑 CAE:</span>
              <span>{venta.cae}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>📅 Vencimiento CAE:</span>
              <span>{new Date(venta.caeVencimiento).toLocaleDateString('es-AR')}</span>
            </div>
            <div style={{ textAlign: 'center', marginTop: '0.5rem', fontWeight: 'bold', fontSize: '0.65rem' }}>
              Comprobante autorizado por AFIP
            </div>
          </div>
        ) : (
          <div style={{
            marginTop: '2rem',
            padding: '0.5rem',
            border: '1px dashed #000000',
            fontSize: '0.7rem',
            textAlign: 'center',
            fontWeight: 'bold'
          }}>
            DOCUMENTO NO VÁLIDO COMO FACTURA
            <br />
            {venta.estado === 'DEMO' && 'COMPROBANTE DE SIMULACION INTERNA'}
          </div>
        )}

      </div>

      {/* Global CSS overrides for printing */}
      <style jsx global>{`
        @media print {
          @page {
            size: 80mm auto;
            margin: 0;
          }
          .no-print {
            display: none !important;
          }
          .sidebar,
          .navbar {
            display: none !important;
          }
          body {
            background-color: #ffffff !important;
            padding: 0 !important;
            margin: 0 !important;
            width: 72mm !important;
            min-height: 0 !important;
            overflow: visible !important;
          }
          .main-layout,
          .content-area,
          main,
          .container {
            display: block !important;
            width: 100% !important;
            max-width: none !important;
            min-height: 0 !important;
            padding: 0 !important;
            margin: 0 !important;
            background: #ffffff !important;
          }
          .print-page-root {
            background: #ffffff !important;
            min-height: 0 !important;
            height: auto !important;
            padding: 0 !important;
            margin: 0 !important;
            width: 72mm !important;
          }
          .print-ticket {
            position: static !important;
            max-width: 72mm !important;
            width: 72mm !important;
            box-sizing: border-box !important;
            border: none !important;
            box-shadow: none !important;
            padding: 2mm !important;
            margin: 0 !important;
            font-size: 10px !important;
            line-height: 1.2 !important;
            overflow: visible !important;
            page-break-after: avoid !important;
            break-after: avoid !important;
          }
          .print-ticket * {
            max-width: 100% !important;
          }
        }
      `}</style>
    </div>
  );
}
