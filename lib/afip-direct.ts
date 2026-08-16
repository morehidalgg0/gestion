import crypto from 'crypto';
import https from 'https';
import forge from 'node-forge';

const WSAA_URLS = {
  prod: 'https://wsaa.afip.gov.ar/ws/services/LoginCms',
  dev: 'https://wsaahomo.afip.gov.ar/ws/services/LoginCms',
};

const WSFE_URLS = {
  prod: 'https://servicios1.afip.gov.ar/wsfev1/service.asmx',
  dev: 'https://wswhomo.afip.gov.ar/wsfev1/service.asmx',
};

const WSFE_NS = 'http://ar.gov.afip.dif.FEV1/';

const legacyAgent = new https.Agent({
  ciphers: 'DEFAULT:@SECLEVEL=0',
  secureOptions: crypto.constants.SSL_OP_LEGACY_SERVER_CONNECT,
});

interface WsaaTicket {
  token: string;
  sign: string;
  expirationTime: Date;
}

const taCache = new Map<string, WsaaTicket>();

function certFingerprint(certPem: string): string {
  return crypto.createHash('sha256').update(certPem).digest('hex').slice(0, 16);
}

export interface TaStore {
  load(): Promise<{ token: string; sign: string; expirationTime: Date; certFingerprint: string } | null>;
  save(token: string, sign: string, expirationTime: Date, certFingerprint: string): Promise<void>;
}

function buildTra(service: string): string {
  const now = new Date();
  // WSAA valida uniqueId como entero de 32 bits: segundos + aleatorio evita colisiones en el mismo segundo
  const uniqueId = Math.floor(now.getTime() / 1000) + Math.floor(Math.random() * 1000);
  const gen = new Date(now.getTime() - 600000).toISOString();
  const exp = new Date(now.getTime() + 600000).toISOString();
  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<loginTicketRequest version="1.0">\n` +
    `<header>\n` +
    `<uniqueId>${uniqueId}</uniqueId>\n` +
    `<generationTime>${gen}</generationTime>\n` +
    `<expirationTime>${exp}</expirationTime>\n` +
    `</header>\n` +
    `<service>${service}</service>\n` +
    `</loginTicketRequest>`
  );
}

function signTra(tra: string, certPem: string, keyPem: string): string {
  const p7 = forge.pkcs7.createSignedData();
  p7.content = forge.util.createBuffer(tra, 'utf8');
  p7.addCertificate(certPem);
  p7.addSigner({
    authenticatedAttributes: [
      { type: forge.pki.oids.contentType, value: forge.pki.oids.data },
      { type: forge.pki.oids.messageDigest },
      { type: forge.pki.oids.signingTime, value: new Date() as unknown as string },
    ],
    certificate: certPem,
    digestAlgorithm: forge.pki.oids.sha256,
    key: keyPem,
  });
  p7.sign();
  return forge.util.encode64(forge.asn1.toDer(p7.toAsn1()).getBytes());
}

function postSoap(url: string, body: string, soapAction: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = https.request(
      url,
      {
        method: 'POST',
        agent: legacyAgent,
        headers: {
          'Content-Type': 'text/xml; charset=utf-8',
          'Content-Length': Buffer.byteLength(body),
          SOAPAction: soapAction,
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => resolve(data));
      }
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function xmlUnescape(xml: string): string {
  return xml
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

function extractFault(xml: string): string | null {
  const faultstring = xml.match(/<faultstring>([\s\S]*?)<\/faultstring>/)?.[1];
  if (faultstring) {
    const msg = faultstring.trim();
    if (!msg.startsWith('IMPORTANTE')) return msg;
  }
  const msgs = Array.from(xml.matchAll(/<Msg>([\s\S]*?)<\/Msg>/g)).map(m => m[1].trim());
  for (const msg of msgs) {
    if (msg && !msg.startsWith('IMPORTANTE')) return msg;
  }
  return null;
}

async function getWsaaTicket(
  production: boolean,
  certPem: string,
  keyPem: string,
  cuit: number,
  service = 'wsfe',
  taStore?: TaStore
): Promise<WsaaTicket> {
  const fp = certFingerprint(certPem);
  const cacheKey = `${production ? 'prod' : 'dev'}:${cuit}:${fp}`;
  const cached = taCache.get(cacheKey);
  if (cached && cached.expirationTime.getTime() > Date.now() + 600000) {
    return cached;
  }

  // Reutilizar el TA persistido (WSAA homologación solo admite un TA válido por certificado+servicio)
  if (taStore) {
    const stored = await taStore.load();
    if (
      stored &&
      stored.certFingerprint === fp &&
      stored.expirationTime.getTime() > Date.now() + 600000
    ) {
      const ticket: WsaaTicket = {
        token: stored.token,
        sign: stored.sign,
        expirationTime: stored.expirationTime,
      };
      taCache.set(cacheKey, ticket);
      return ticket;
    }
  }

  const signedTra = signTra(buildTra(service), certPem, keyPem);
  const body =
    `<?xml version="1.0" encoding="utf-8"?>\n` +
    `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:wsaa="http://wsaa.view.sua.dvadac.desein.afip.gov">\n` +
    `<soapenv:Header/>\n` +
    `<soapenv:Body>\n` +
    `<wsaa:loginCms>\n` +
    `<in0>${signedTra}</in0>\n` +
    `</wsaa:loginCms>\n` +
    `</soapenv:Body>\n` +
    `</soapenv:Envelope>`;

  const url = production ? WSAA_URLS.prod : WSAA_URLS.dev;
  const response = await postSoap(url, body, '""');

  const returnXml = response.match(/<loginCmsReturn>([\s\S]*?)<\/loginCmsReturn>/)?.[1];
  const ticketXml = xmlUnescape(returnXml || '').match(/<loginTicketResponse[\s\S]*?<\/loginTicketResponse>/)?.[0];
  if (!ticketXml) {
    throw new Error(extractFault(response) || 'WSAA: respuesta inesperada al solicitar el token');
  }

  const token = ticketXml.match(/<token>([\s\S]*?)<\/token>/)?.[1];
  const sign = ticketXml.match(/<sign>([\s\S]*?)<\/sign>/)?.[1];
  const expirationTime = ticketXml.match(/<expirationTime>([^<]+)<\/expirationTime>/)?.[1];
  if (!token || !sign || !expirationTime) {
    throw new Error('WSAA: ticket de autorización incompleto');
  }

  const ticket = { token, sign, expirationTime: new Date(expirationTime) };
  taCache.set(cacheKey, ticket);
  if (taStore) {
    await taStore.save(token, sign, ticket.expirationTime, fp);
  }
  return ticket;
}

function buildAuthXml(ticket: WsaaTicket, cuit: number): string {
  return (
    `<fe:Auth>` +
    `<fe:Token>${ticket.token}</fe:Token>` +
    `<fe:Sign>${ticket.sign}</fe:Sign>` +
    `<fe:Cuit>${cuit}</fe:Cuit>` +
    `</fe:Auth>`
  );
}

function buildWsfeEnvelope(operation: string, bodyContent: string): string {
  return (
    `<?xml version="1.0" encoding="utf-8"?>\n` +
    `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:fe="${WSFE_NS}">\n` +
    `<soapenv:Header/>\n` +
    `<soapenv:Body>\n` +
    `<fe:${operation}>\n` +
    bodyContent +
    `\n</fe:${operation}>\n` +
    `</soapenv:Body>\n` +
    `</soapenv:Envelope>`
  );
}

function fmtAmount(n: number): string {
  return parseFloat(n.toFixed(2)).toString();
}

export async function getLastVoucher(
  production: boolean,
  certPem: string,
  keyPem: string,
  cuit: number,
  ptoVta: number,
  cbteTipo: number,
  taStore?: TaStore
): Promise<number> {
  const ticket = await getWsaaTicket(production, certPem, keyPem, cuit, 'wsfe', taStore);
  const body = buildWsfeEnvelope(
    'FECompUltimoAutorizado',
    buildAuthXml(ticket, cuit) +
      `<fe:PtoVta>${ptoVta}</fe:PtoVta>\n` +
      `<fe:CbteTipo>${cbteTipo}</fe:CbteTipo>`
  );
  const url = production ? WSFE_URLS.prod : WSFE_URLS.dev;
  const response = xmlUnescape(await postSoap(url, body, `"${WSFE_NS}FECompUltimoAutorizado"`));

  const fault = extractFault(response);
  if (fault) {
    throw new Error(`AFIP: ${fault}`);
  }

  const cbteNro = response.match(/<CbteNro>(\d+)<\/CbteNro>/)?.[1];
  if (cbteNro === undefined) {
    // AFIP may omit CbteNro (or return xsi:nil) when there are no vouchers yet.
    return 0;
  }
  return parseInt(cbteNro, 10);
}

export interface AlicIva {
  Id: number;
  BaseImp: number;
  Importe: number;
}

export interface CbteAsoc {
  Tipo: number;
  PtoVta: number;
  Nro: number;
}

export interface VoucherData {
  Concepto: number;
  DocTipo: number;
  DocNro: number;
  CbteDesde: number;
  CbteHasta: number;
  CbteFch: string;
  condicionIvaReceptorId?: number;
  ImpTotal: number;
  ImpTotConc: number;
  ImpNeto: number;
  ImpOpEx: number;
  ImpIVA: number;
  ImpTrib: number;
  MonId: string;
  MonCotiz: number;
  iva?: AlicIva[];
  cbtesAsoc?: CbteAsoc[];
}

export interface VoucherResult {
  CAE: string;
  CAEFchVto: string;
}

function buildDetRequestXml(data: VoucherData): string {
  const fixedKeys: Array<[string, number | string]> = [
    ['Concepto', data.Concepto],
    ['DocTipo', data.DocTipo],
    ['DocNro', data.DocNro],
    ['CbteDesde', data.CbteDesde],
    ['CbteHasta', data.CbteHasta],
    ['CbteFch', data.CbteFch],
  ];

  let xml = fixedKeys.map(([name, value]) => `<fe:${name}>${value}</fe:${name}>`).join('');

  if (data.condicionIvaReceptorId !== undefined) {
    xml += `<fe:CondicionIVAReceptorId>${data.condicionIvaReceptorId}</fe:CondicionIVAReceptorId>`;
  }

  xml += ['ImpTotal', 'ImpTotConc', 'ImpNeto', 'ImpOpEx', 'ImpIVA', 'ImpTrib', 'MonCotiz']
    .map((name) => `<fe:${name}>${fmtAmount(data[name as keyof VoucherData] as number)}</fe:${name}>`)
    .join('');
  xml += `<fe:MonId>${data.MonId}</fe:MonId>`;

  if (data.iva && data.iva.length > 0) {
    xml +=
      `<fe:Iva>` +
      data.iva
        .map(
          (a) =>
            `<fe:AlicIva><fe:Id>${a.Id}</fe:Id><fe:BaseImp>${fmtAmount(a.BaseImp)}</fe:BaseImp><fe:Importe>${fmtAmount(
              a.Importe
            )}</fe:Importe></fe:AlicIva>`
        )
        .join('') +
      `</fe:Iva>`;
  }

  if (data.cbtesAsoc && data.cbtesAsoc.length > 0) {
    xml +=
      `<fe:CbtesAsoc>` +
      data.cbtesAsoc
        .map(
          (c) =>
            `<fe:CbteAsoc><fe:Tipo>${c.Tipo}</fe:Tipo><fe:PtoVta>${c.PtoVta}</fe:PtoVta><fe:Nro>${c.Nro}</fe:Nro></fe:CbteAsoc>`
        )
        .join('') +
      `</fe:CbtesAsoc>`;
  }

  return xml;
}

export interface PtoVenta {
  Nro: number;
  EmisionTipo?: string;
  Bloqueado?: string;
  FchBaja?: string;
}

export async function getPuntosVenta(
  production: boolean,
  certPem: string,
  keyPem: string,
  cuit: number,
  taStore?: TaStore
): Promise<PtoVenta[]> {
  const ticket = await getWsaaTicket(production, certPem, keyPem, cuit, 'wsfe', taStore);
  const body = buildWsfeEnvelope('FEParamGetPtosVenta', buildAuthXml(ticket, cuit));
  const url = production ? WSFE_URLS.prod : WSFE_URLS.dev;
  const response = xmlUnescape(await postSoap(url, body, `"${WSFE_NS}FEParamGetPtosVenta"`));

  const fault = extractFault(response);
  if (fault) {
    throw new Error(`AFIP: ${fault}`);
  }

  const block = response.match(/<ResultGet>([\s\S]*?)<\/ResultGet>/)?.[1];
  if (!block) {
    const errMsgs = Array.from(response.matchAll(/<Msg>([\s\S]*?)<\/Msg>/g)).map((m) => m[1].trim());
    if (errMsgs.length > 0) {
      throw new Error(errMsgs.join(' - '));
    }
    return [];
  }

  return Array.from(block.matchAll(/<PtoVenta>([\s\S]*?)<\/PtoVenta>/g)).map((m) => {
    const get = (tag: string) => m[1].match(new RegExp(`<${tag}>([^<]*)</${tag}>`))?.[1];
    return {
      Nro: parseInt(get('Nro') || '0', 10),
      EmisionTipo: get('EmisionTipo'),
      Bloqueado: get('Bloqueado'),
      FchBaja: get('FchBaja'),
    };
  });
}

export async function createVoucher(
  production: boolean,
  certPem: string,
  keyPem: string,
  cuit: number,
  ptoVta: number,
  cbteTipo: number,
  data: VoucherData,
  taStore?: TaStore
): Promise<VoucherResult> {
  const ticket = await getWsaaTicket(production, certPem, keyPem, cuit, 'wsfe', taStore);
  const body = buildWsfeEnvelope(
    'FECAESolicitar',
    buildAuthXml(ticket, cuit) +
      `<fe:FeCAEReq>\n` +
      `<fe:FeCabReq><fe:CantReg>1</fe:CantReg><fe:PtoVta>${ptoVta}</fe:PtoVta><fe:CbteTipo>${cbteTipo}</fe:CbteTipo></fe:FeCabReq>\n` +
      `<fe:FeDetReq><fe:FECAEDetRequest>\n` +
      buildDetRequestXml(data) +
      `\n</fe:FECAEDetRequest></fe:FeDetReq>\n` +
      `</fe:FeCAEReq>`
  );
  const url = production ? WSFE_URLS.prod : WSFE_URLS.dev;
  const response = xmlUnescape(await postSoap(url, body, `"${WSFE_NS}FECAESolicitar"`));

  const fault = extractFault(response);
  if (fault && !response.includes('<Resultado>')) {
    throw new Error(`AFIP: ${fault}`);
  }

  const resultado = response.match(/<Resultado>([A-Z])<\/Resultado>/)?.[1];
  const errMsgs = Array.from(response.matchAll(/<Msg>([\s\S]*?)<\/Msg>/g)).map((m) => m[1].trim());
  if (resultado === 'R') {
    const realErrors = errMsgs.filter(m => !m.startsWith('IMPORTANTE'));
    throw new Error(realErrors.length > 0 ? realErrors.join(' - ') : 'AFIP rechazó el comprobante');
  }

  const cae = response.match(/<CAE>(\d+)<\/CAE>/)?.[1];
  const vto = response.match(/<CAEFchVto>(\d+)<\/CAEFchVto>/)?.[1];
  if (!cae || !vto) {
    if (resultado === 'A') {
      console.error('[AFIP] Resultado=A pero sin CAE. Response:', response.slice(0, 1000));
    }
    const info = errMsgs.filter(m => !m.startsWith('IMPORTANTE')).join(' - ');
    throw new Error(info || 'AFIP no devolvió un CAE válido');
  }

  return { CAE: cae, CAEFchVto: vto };
}
