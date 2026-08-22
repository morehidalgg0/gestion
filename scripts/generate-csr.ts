#!/usr/bin/env node

/**
 * Generador de CSR para AFIP
 * Uso: npx tsx scripts/generate-csr.ts --cuit 20123456789 --razon "VERDEMARE SRL" --outdir ./certs
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

interface CsrOptions {
  cuit: string;
  razonSocial: string;
  condicionIva?: string;
  pais?: string;
  outdir?: string;
  keySize?: number;
}

function parseArgs(): CsrOptions {
  const args = process.argv.slice(2);
  const opts: CsrOptions = { cuit: '', razonSocial: '' };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--cuit': opts.cuit = args[++i]; break;
      case '--razon': opts.razonSocial = args[++i]; break;
      case '--iva': opts.condicionIva = args[++i]; break;
      case '--outdir': opts.outdir = args[++i]; break;
      case '--keysize': opts.keySize = parseInt(args[++i], 10); break;
    }
  }

  if (!opts.cuit || !opts.razonSocial) {
    console.error('Uso: npx tsx scripts/generate-csr.ts --cuit <CUIT> --razon "Razon Social" [--outdir ./certs]');
    process.exit(1);
  }

  return opts;
}

function generateCsr(opts: CsrOptions): { csrPem: string; keyPem: string } {
  const { cuit, razonSocial, pais = 'AR', keySize = 2048 } = opts;

  // Generate RSA key pair
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: keySize,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });

  // Build CSR attributes manually (DER)
  const attrs: Array<{ type: string; value: string }> = [
    { type: '2.5.4.3', value: cuit },                    // CN: CUIT
    { type: '2.5.4.10', value: razonSocial },             // O: Razón social
    { type: '2.5.4.6', value: pais },                     // C: País
    { type: '2.5.4.11', value: 'AFIP - Facturación' },   // OU: Propósito
  ];

  // Use OpenSSL via child_process for reliable CSR generation
  const { execSync } = require('child_process');
  const tmpKey = path.join('/tmp', `tmpkey-${Date.now()}.pem`);
  const tmpCsr = path.join('/tmp', `tmpcsr-${Date.now()}.pem`);
  const tmpCnf = path.join('/tmp', `tmpcnf-${Date.now()}.cnf`);

  try {
    fs.writeFileSync(tmpKey, privateKey);

    // OpenSSL config for CSR
    const cnf = `
[req]
default_bits = ${keySize}
prompt = no
default_md = sha256
distinguished_name = dn
req_extensions = v3_req

[dn]
CN = ${cuit}
O = ${razonSocial}
OU = AFIP - Facturacion
C = ${pais}

[v3_req]
basicConstraints = CA:FALSE
keyUsage = digitalSignature, keyEncipherment
extendedKeyUsage = serverAuth, clientAuth
subjectAltName = @alt_names

[alt_names]
DNS.1 = ${cuit}.afip.gov.ar
DNS.2 = wsfe.afip.gov.ar
`;
    fs.writeFileSync(tmpCnf, cnf);

    execSync(
      `openssl req -new -key ${tmpKey} -out ${tmpCsr} -config ${tmpCnf} -sha256`,
      { stdio: 'pipe' }
    );

    const csrPem = fs.readFileSync(tmpCsr, 'utf8');
    return { csrPem, keyPem: privateKey };
  } finally {
    [tmpKey, tmpCsr, tmpCnf].forEach((f) => {
      try { fs.unlinkSync(f); } catch {}
    });
  }
}

function main() {
  const opts = parseArgs();
  const outdir = opts.outdir || path.join(process.cwd(), 'certs', opts.cuit);

  console.log(`🔐 Generando CSR para:`);
  console.log(`   CUIT:         ${opts.cuit}`);
  console.log(`   Razón social: ${opts.razonSocial}`);
  console.log(`   Salida:       ${outdir}\n`);

  fs.mkdirSync(outdir, { recursive: true });

  const { csrPem, keyPem } = generateCsr(opts);

  const csrPath = path.join(outdir, 'request.csr');
  const keyPath = path.join(outdir, 'private.key');

  fs.writeFileSync(csrPath, csrPem);
  fs.writeFileSync(keyPath, keyPem, { mode: 0o600 });

  console.log(`✅ Archivos generados:`);
  console.log(`   CSR:   ${csrPath}`);
  console.log(`   Clave: ${keyPath}\n`);
  console.log(`📋 Pasos siguientes:`);
  console.log(`   1. Subí el CSR (request.csr) en AFIP → WSAA → Certificados`);
  console.log(`   2. Descargá el certificado firmado (.crt) desde AFIP`);
  console.log(`   3. Convertí el .crt a PEM: openssl x509 -inform DER -in cert.der -out cert.pem`);
  console.log(`   4. Subí cert.pem y private.key en la config de AFIP de la plataforma`);
}

main();
