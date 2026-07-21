import Afip from '@afipsdk/afip.js';
import { decrypt } from './crypto';
import os from 'os';

export interface InvoiceItem {
  nombre: string;
  cantidad: number;
  precioUnitario: number; // IVA-inclusive retail price
  ivaPorcentaje: number;  // 21.0, 10.5, 0.0
}

export interface InvoiceRequest {
  cuitEmisor: string;
  razonSocialEmisor: string;
  condicionIvaEmisor: 'Responsable Inscripto' | 'Monotributista';
  puntoVenta: number;
  tipoComprobante: 'Factura A' | 'Factura B' | 'Factura C' | 'Factura X' | 'Nota de Crédito A' | 'Nota de Crédito B' | 'Nota de Crédito C' | 'Nota de Crédito X';
  clienteTipoDoc: string; // 'DNI', 'CUIT', '99' (Sin Identificar)
  clienteNroDoc: string;
  items: InvoiceItem[];
  modo: 'demo' | 'homologacion' | 'produccion';
  certificadoEncriptado?: string | null;
  claveEncriptada?: string | null;
  iv?: string | null;
  comprobanteAsociado?: {
    tipoComprobante: 'Factura A' | 'Factura B' | 'Factura C';
    puntoVenta: number;
    numeroComprobante: number;
  };
}

export interface InvoiceResult {
  estado: 'COMPLETADO' | 'DEMO' | 'RECHAZADO_AFIP';
  numeroComprobante: number;
  cae?: string;
  caeVencimiento?: Date;
  mensajeAfip?: string;
}

/**
 * Maps standard invoice types to AFIP numeric codes.
 */
function getCbteTipoCode(tipo: 'Factura A' | 'Factura B' | 'Factura C' | 'Nota de Crédito A' | 'Nota de Crédito B' | 'Nota de Crédito C'): number {
  switch (tipo) {
    case 'Factura A': return 1;
    case 'Factura B': return 6;
    case 'Factura C': return 11;
    case 'Nota de Crédito A': return 3;
    case 'Nota de Crédito B': return 8;
    case 'Nota de Crédito C': return 13;
  }
}

function isTipoC(tipo: string): boolean {
  return tipo === 'Factura C' || tipo === 'Nota de Crédito C';
}

function isNotaCredito(tipo: string): boolean {
  return tipo.startsWith('Nota de Crédito');
}

/**
 * Maps user document types to AFIP numeric codes.
 */
function getDocTipoCode(tipo: string): number {
  switch (tipo) {
    case 'CUIT': return 80;
    case 'DNI': return 96;
    default: return 99; // Sin Identificar
  }
}

/**
 * Authorizes a sales invoice.
 * If mode = 'demo' or certificates are missing, it processes internally.
 * Otherwise, it communicates with ARCA (AFIP) Web Services.
 */
export async function emitirFactura(req: InvoiceRequest): Promise<InvoiceResult> {
  if (req.tipoComprobante === 'Factura X' || req.tipoComprobante === 'Nota de Crédito X') {
    return {
      estado: 'DEMO',
      numeroComprobante: 0,
      mensajeAfip: 'DOCUMENTO NO VALIDO COMO FACTURA - COMPROBANTE X',
    };
  }

  const cbteTipo = getCbteTipoCode(req.tipoComprobante);
  const docTipo = getDocTipoCode(req.clienteTipoDoc);
  const docNro = docTipo === 99 ? 0 : parseInt(req.clienteNroDoc.replace(/\D/g, ''), 10) || 0;

  // 1. Calculate tax bases and totals (assuming input price is final consumer price)
  let impNeto = 0;
  let impIva = 0;
  let impOpEx = 0;

  let neto21 = 0;
  let iva21 = 0;
  let neto105 = 0;
  let iva105 = 0;

  for (const item of req.items) {
    const itemTotal = item.cantidad * item.precioUnitario;
    
    if (isTipoC(req.tipoComprobante)) {
      // Monotributista issues Factura C (no discriminated IVA, total is taxed as net)
      impNeto += itemTotal;
    } else {
      // Responsable Inscripto issues Factura A or B (discriminate IVA)
      if (item.ivaPorcentaje === 21) {
        const net = itemTotal / 1.21;
        const iva = itemTotal - net;
        neto21 += net;
        iva21 += iva;
      } else if (item.ivaPorcentaje === 10.5) {
        const net = itemTotal / 1.105;
        const iva = itemTotal - net;
        neto105 += net;
        iva105 += iva;
      } else if (item.ivaPorcentaje === 0) {
        impOpEx += itemTotal;
      } else {
        // Fallback to 21%
        const net = itemTotal / 1.21;
        const iva = itemTotal - net;
        neto21 += net;
        iva21 += iva;
      }
    }
  }

  if (!isTipoC(req.tipoComprobante)) {
    impNeto = neto21 + neto105;
    impIva = iva21 + iva105;
  }

  const impTotal = impNeto + impIva + impOpEx;

  // 2. CHECK IF DEMO MODE
  if (req.modo === 'demo' || !req.certificadoEncriptado || !req.claveEncriptada || !req.iv) {
    // Generate simulated data (internal demo mode)
    const simulatedCae = `DEMO${Math.floor(100000000000 + Math.random() * 900000000000)}`;
    const simulatedVencimiento = new Date();
    simulatedVencimiento.setDate(simulatedVencimiento.getDate() + 10); // CAE expires in 10 days
    
    return {
      estado: 'DEMO',
      numeroComprobante: 0, // Will be set by API Route based on DB counter or local increment
      cae: simulatedCae,
      caeVencimiento: simulatedVencimiento,
      mensajeAfip: 'COMPROBANTE EMITIDO EN MODO DEMO - NO VALIDO FISCALMENTE',
    };
  }

  // 3. REAL AFIP WSFEv1 CONNECTION
  try {
    // Decrypt credentials. The config stores one IV per encrypted file as "certIv:keyIv".
    const [certIv, keyIv] = req.iv.includes(':') ? req.iv.split(':') : [req.iv, req.iv];
    const cert = decrypt(req.certificadoEncriptado, certIv);
    const key = decrypt(req.claveEncriptada, keyIv);

    // Initialize AFIP client with cross-platform temp directory for XML token caching
    const afip = new Afip({
      CUIT: parseInt(req.cuitEmisor.replace(/\D/g, ''), 10),
      production: req.modo === 'produccion',
      cert: cert,
      key: key,
      res_folder: os.tmpdir(),
    } as any);

    // Fetch the last authorized voucher from AFIP in real-time
    const lastVoucher = await afip.ElectronicBilling.getLastVoucher(req.puntoVenta, cbteTipo);
    const nextVoucherNumber = lastVoucher + 1;

    // Prepare billing structure
    const data: any = {
      CantReg: 1,
      PtoVta: req.puntoVenta,
      CbteTipo: cbteTipo,
      Concepto: 1, // 1 = Productos
      DocTipo: docTipo,
      DocNro: docNro,
      CbteDesde: nextVoucherNumber,
      CbteHasta: nextVoucherNumber,
      CbteFch: parseInt(new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 8), 10),
      ImpTotal: parseFloat(impTotal.toFixed(2)),
      ImpTotConc: 0,
      ImpNeto: parseFloat(impNeto.toFixed(2)),
      ImpOpEx: parseFloat(impOpEx.toFixed(2)),
      ImpTrib: 0,
      ImpIVA: parseFloat(impIva.toFixed(2)),
      FchServDesde: null,
      FchServHasta: null,
      FchVtoPago: null,
      MonId: 'PES',
      MonCotiz: 1,
    };

    if (isNotaCredito(req.tipoComprobante) && req.comprobanteAsociado) {
      data.CbtesAsoc = [{
        Tipo: getCbteTipoCode(req.comprobanteAsociado.tipoComprobante),
        PtoVta: req.comprobanteAsociado.puntoVenta,
        Nro: req.comprobanteAsociado.numeroComprobante,
      }];
    }

    // Discriminate IVA details if not Factura C / Nota de Crédito C
    if (!isTipoC(req.tipoComprobante)) {
      const ivaArray: any[] = [];
      if (neto21 > 0) {
        ivaArray.push({
          Id: 5, // Code 5 is 21% in AFIP
          BaseImp: parseFloat(neto21.toFixed(2)),
          Importe: parseFloat(iva21.toFixed(2)),
        });
      }
      if (neto105 > 0) {
        ivaArray.push({
          Id: 4, // Code 4 is 10.5% in AFIP
          BaseImp: parseFloat(neto105.toFixed(2)),
          Importe: parseFloat(iva105.toFixed(2)),
        });
      }
      
      // AFIP rejects requests with discriminated IVA but empty array
      if (ivaArray.length > 0) {
        data.Iva = ivaArray;
      }
    }

    // Call AFIP Web Service
    const res = await afip.ElectronicBilling.createVoucher(data);

    if (!res || !res.CAE) {
      throw new Error('AFIP did not return a valid CAE number.');
    }

    // Parse CAE expiration date (AFIP format YYYYMMDD to Date object)
    let caeVencimientoDate = new Date();
    if (res.CAEFchVto && res.CAEFchVto.length === 8) {
      const year = parseInt(res.CAEFchVto.substring(0, 4), 10);
      const month = parseInt(res.CAEFchVto.substring(4, 6), 10) - 1;
      const day = parseInt(res.CAEFchVto.substring(6, 8), 10);
      caeVencimientoDate = new Date(year, month, day);
    }

    return {
      estado: 'COMPLETADO',
      numeroComprobante: nextVoucherNumber,
      cae: res.CAE,
      caeVencimiento: caeVencimientoDate,
      mensajeAfip: 'Aprobado Autorizado por AFIP',
    };
  } catch (error: any) {
    console.error('AFIP invoice authorization failed:', error);
    return {
      estado: 'RECHAZADO_AFIP',
      numeroComprobante: 0,
      mensajeAfip: error.message || 'Error desconocido al conectar con AFIP',
    };
  }
}
