/**
 * Código QR obligatorio en comprobantes electrónicos (RG AFIP 4892/2020).
 * Arma la URL que AFIP exige embeber como QR en cada factura autorizada.
 * Spec: https://www.afip.gob.ar/fe/qr/especificaciones.asp
 */

const TIPO_DOC_REC: Record<string, number> = {
  CUIT: 80,
  DNI: 96,
  '99': 99, // Consumidor Final / Sin identificar
};

const TIPO_CMP_CODIGO: Record<string, number> = {
  'Factura A': 1,
  'Nota de Crédito A': 3,
  'Factura B': 6,
  'Nota de Crédito B': 8,
  'Factura C': 11,
  'Nota de Crédito C': 13,
};

export function getTipoComprobanteCodigo(tipoComprobante: string): number | null {
  return TIPO_CMP_CODIGO[tipoComprobante] ?? null;
}

export interface AfipQrParams {
  fecha: string | Date; // Fecha de emisión del comprobante
  cuitEmisor: string;
  puntoVenta: number;
  tipoComprobanteCodigo: number; // 01, 06, 11, etc. (código AFIP, no el nombre)
  numeroComprobante: number;
  importeTotal: number;
  tipoDocReceptor: string; // 'CUIT', 'DNI', '99'
  nroDocReceptor: string;
  cae: string;
}

// Usa siempre el calendario de Argentina, sin importar en qué zona horaria
// corra el servidor (Vercel corre en UTC, y eso podía correr la fecha un día).
const arDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Argentina/Buenos_Aires',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

function toYyyyMmDd(fecha: string | Date): string {
  return arDateFormatter.format(new Date(fecha)); // en-CA ya formatea como YYYY-MM-DD
}

export function buildAfipQrUrl(params: AfipQrParams): string {
  const payload = {
    ver: 1,
    fecha: toYyyyMmDd(params.fecha),
    cuit: parseInt(params.cuitEmisor.replace(/\D/g, ''), 10),
    ptoVta: params.puntoVenta,
    tipoCmp: params.tipoComprobanteCodigo,
    nroCmp: params.numeroComprobante,
    importe: Number(params.importeTotal),
    moneda: 'PES',
    ctz: 1,
    tipoDocRec: TIPO_DOC_REC[params.tipoDocReceptor] ?? 99,
    nroDocRec: parseInt(String(params.nroDocReceptor).replace(/\D/g, ''), 10) || 0,
    tipoCodAut: 'E',
    codAut: parseInt(params.cae, 10),
  };

  const base64 = Buffer.from(JSON.stringify(payload)).toString('base64');
  return `https://www.afip.gob.ar/fe/qr/?p=${base64}`;
}
