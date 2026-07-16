'use client';

import { use, useEffect, useState } from 'react';
import { Printer, X } from 'lucide-react';

type CierreZ = {
  id: string;
  tipo: 'X' | 'Z';
  fecha: string;
  emitidoAt: string;
  cerradoAt?: string | null;
  concepto: string;
  montoInicial: number;
  facturadoTotal: number;
  efectivoNeto: number;
  egresosTotal?: number;
  egresosEfectivo?: number;
  totalCaja: number;
  cantidadComprobantes: number;
  detalle?: {
    porFormaPago?: Record<string, number>;
    egresosPorFormaPago?: Record<string, number>;
    ventas?: Array<{
      id: string;
      fecha: string;
      tipoComprobante: string;
      puntoVenta: number;
      numeroComprobante: number;
      formaPago: string;
      signedTotal: number;
      cliente: string;
    }>;
    egresos?: Array<{
      id: string;
      fecha: string;
      proveedor: string;
      concepto: string;
      formaPago: string;
      monto: number;
    }>;
  };
  empresa?: {
    nombre: string;
    cuit: string;
    condicionIva: string;
    configAfip?: {
      razonSocial: string;
      cuit: string;
      condicionIva: string;
      puntoVenta: number;
    } | null;
  };
  usuario?: {
    nombre: string;
    email: string;
  };
};

type CierreZVenta = NonNullable<NonNullable<CierreZ['detalle']>['ventas']>[number];

function formatMoney(value: number) {
  return value.toLocaleString('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 2,
  });
}

function formatVoucherNumber(venta: CierreZVenta) {
  return `${venta.puntoVenta.toString().padStart(4, '0')}-${venta.numeroComprobante.toString().padStart(8, '0')}`;
}

export default function CierreZPrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [cierre, setCierre] = useState<CierreZ | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadCierre() {
      try {
        const response = await fetch(`/api/tenant/cierre-z/${id}`);
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || 'No se pudo obtener el comprobante de cierre.');
        }
        setCierre(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    loadCierre();
  }, [id]);

  if (loading) {
    return <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Cargando comprobante de cierre...</div>;
  }

  if (error || !cierre) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: '#ef4444' }}>
        <h3>Error</h3>
        <p>{error || 'Comprobante de cierre no disponible.'}</p>
      </div>
    );
  }

  const config = cierre.empresa?.configAfip;
  const razonSocial = config?.razonSocial || cierre.empresa?.nombre || 'Comercio';
  const cuit = config?.cuit || cierre.empresa?.cuit || '-';
  const condicionIva = config?.condicionIva || cierre.empresa?.condicionIva || '-';
  const puntoVenta = config?.puntoVenta || 1;
  const ventas = cierre.detalle?.ventas || [];
  const egresos = cierre.detalle?.egresos || [];
  const porFormaPago = cierre.detalle?.porFormaPago || {};
  const egresosEfectivo = cierre.egresosEfectivo ?? (cierre.detalle as any)?.egresosEfectivo ?? 0;
  const egresosTotal = cierre.egresosTotal ?? (cierre.detalle as any)?.egresosTotal ?? 0;
  const tituloCierre = `CIERRE ${cierre.tipo}`;
  const subtituloCierre = cierre.tipo === 'Z' ? 'COMPROBANTE DE CIERRE DIARIO DE CAJA' : 'COMPROBANTE DE CONTROL PARCIAL DE CAJA';

  return (
    <div className="print-page-root" style={{ background: '#f5f5f5', minHeight: '100vh', padding: '1.5rem 0' }}>
      <div className="no-print" style={{
        maxWidth: '680px',
        margin: '0 auto 1.5rem auto',
        padding: '0.75rem 1.25rem',
        backgroundColor: '#ffffff',
        borderRadius: 'var(--radius-md)',
        boxShadow: 'var(--shadow-sm)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Comprobante de {tituloCierre}</span>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button onClick={() => window.print()} className="btn btn-primary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <Printer size={14} />
            <span>Imprimir</span>
          </button>
          <button onClick={() => window.close()} className="btn btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <X size={14} />
            <span>Cerrar</span>
          </button>
        </div>
      </div>

      <div className="print-ticket" style={{
        maxWidth: '640px',
        margin: '0 auto',
        padding: '2rem',
        backgroundColor: '#ffffff',
        border: '1px solid #e5e7eb',
        boxShadow: 'var(--shadow-sm)',
        fontFamily: 'Courier New, monospace',
        color: '#000000'
      }}>
        <div style={{ border: '2px solid #000000', padding: '1rem', marginBottom: '1.25rem', textAlign: 'center' }}>
          <div style={{ fontSize: '1.3rem', fontWeight: 'bold' }}>{tituloCierre}</div>
          <div style={{ fontSize: '0.85rem', marginTop: '0.25rem' }}>{subtituloCierre}</div>
          <div style={{ fontSize: '0.75rem', marginTop: '0.5rem' }}>ID: {cierre.id}</div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', fontSize: '0.8rem', borderBottom: '1px dashed #000', paddingBottom: '1rem', marginBottom: '1rem' }}>
          <div>
            <div style={{ fontWeight: 'bold', marginBottom: '0.25rem' }}>{razonSocial}</div>
            <div>CUIT: {cuit}</div>
            <div>Cond. IVA: {condicionIva}</div>
            <div>Punto de venta: {puntoVenta.toString().padStart(4, '0')}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div>Fecha fiscal: {new Date(cierre.fecha).toLocaleDateString('es-AR')}</div>
            <div>Emitido: {new Date(cierre.emitidoAt).toLocaleString('es-AR')}</div>
            <div>Cajero: {cierre.usuario?.nombre || '-'}</div>
            <div>{cierre.usuario?.email || ''}</div>
          </div>
        </div>

        <div style={{ fontSize: '0.8rem', borderBottom: '1px dashed #000', paddingBottom: '1rem', marginBottom: '1rem' }}>
          <div style={{ fontWeight: 'bold', marginBottom: '0.5rem' }}>CONCEPTO</div>
          <div>{cierre.concepto}</div>
          <div style={{ marginTop: '0.5rem' }}>
            {cierre.tipo === 'Z'
              ? 'Este comprobante consolida las ventas del día y deja cerrada la jornada para el usuario emisor.'
              : 'Este comprobante consolida las ventas registradas hasta el momento sin cerrar la jornada.'}
          </div>
        </div>

        <div style={{ fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.35rem', borderBottom: '1px dashed #000', paddingBottom: '1rem', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Comprobantes incluidos:</span>
            <strong>{cierre.cantidadComprobantes}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Total vendido del día:</span>
            <strong>{formatMoney(cierre.facturadoTotal)}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Fondo fijo inicial:</span>
            <strong>{formatMoney(cierre.montoInicial)}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Efectivo neto:</span>
            <strong>{formatMoney(cierre.efectivoNeto)}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Egresos en efectivo:</span>
            <strong>-{formatMoney(egresosEfectivo)}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1rem', borderTop: '1px solid #000', paddingTop: '0.5rem', marginTop: '0.25rem' }}>
            <span>TOTAL FÍSICO ESPERADO EN CAJA:</span>
            <strong>{formatMoney(cierre.totalCaja)}</strong>
          </div>
        </div>

        <div style={{ fontSize: '0.8rem', borderBottom: '1px dashed #000', paddingBottom: '1rem', marginBottom: '1rem' }}>
          <div style={{ fontWeight: 'bold', marginBottom: '0.5rem' }}>DISCRIMINADO POR FORMA DE PAGO</div>
          {Object.entries(porFormaPago).map(([formaPago, total]) => (
            <div key={formaPago} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
              <span>{formaPago}</span>
              <strong>{formatMoney(Number(total))}</strong>
            </div>
          ))}
          {Object.keys(porFormaPago).length === 0 && <div>Sin movimientos.</div>}
        </div>

        <div style={{ fontSize: '0.8rem', borderBottom: '1px dashed #000', paddingBottom: '1rem', marginBottom: '1rem' }}>
          <div style={{ fontWeight: 'bold', marginBottom: '0.5rem' }}>EGRESOS REGISTRADOS</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span>Total egresos:</span>
            <strong>{formatMoney(egresosTotal)}</strong>
          </div>
          {egresos.map((egreso) => (
            <div key={egreso.id} style={{ display: 'grid', gridTemplateColumns: '52px 1fr 82px', gap: '0.5rem', marginBottom: '0.25rem' }}>
              <span>{new Date(egreso.fecha).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</span>
              <span>{egreso.proveedor} - {egreso.concepto} - {egreso.formaPago}</span>
              <strong style={{ textAlign: 'right' }}>-{formatMoney(egreso.monto)}</strong>
            </div>
          ))}
          {egresos.length === 0 && <div>Sin egresos.</div>}
        </div>

        <div style={{ fontSize: '0.72rem' }}>
          <div style={{ fontWeight: 'bold', marginBottom: '0.5rem' }}>COMPROBANTES INCLUIDOS</div>
          {ventas.map((venta) => (
            <div key={venta.id} style={{ display: 'grid', gridTemplateColumns: '52px 1fr 82px', gap: '0.5rem', marginBottom: '0.35rem' }}>
              <span>{new Date(venta.fecha).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</span>
              <span>{venta.tipoComprobante} {formatVoucherNumber(venta)} - {venta.formaPago}</span>
              <strong style={{ textAlign: 'right' }}>{formatMoney(venta.signedTotal)}</strong>
            </div>
          ))}
          {ventas.length === 0 && <div>Sin comprobantes emitidos.</div>}
        </div>

        <div style={{ marginTop: '2rem', textAlign: 'center', fontSize: '0.7rem', fontWeight: 'bold' }}>
          FIN DEL {tituloCierre} {cierre.tipo === 'Z' ? '- CONTADORES DE LA JORNADA CERRADOS' : '- CONTROL PARCIAL EMITIDO'}
        </div>
      </div>

      <style jsx global>{`
        @media print {
          @page { margin: 0; }
          .no-print { display: none !important; }
          .sidebar, .navbar { display: none !important; }
          body { background-color: #ffffff !important; padding: 0 !important; margin: 0 !important; min-height: 0 !important; overflow: visible !important; }
          .main-layout, .content-area, main, .container { display: block !important; width: 100% !important; max-width: none !important; min-height: 0 !important; padding: 0 !important; margin: 0 !important; background: #ffffff !important; }
          .print-page-root { background: #ffffff !important; min-height: 0 !important; height: auto !important; padding: 0 !important; margin: 0 !important; }
          .print-ticket { position: static !important; max-width: 100% !important; width: 100% !important; box-sizing: border-box !important; border: none !important; box-shadow: none !important; padding: 0 !important; margin: 0 !important; page-break-after: avoid !important; break-after: avoid !important; }
        }
      `}</style>
    </div>
  );
}
