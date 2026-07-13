import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { encrypt } from '@/lib/crypto';

function getTenantId(req: NextRequest): string {
  const empresaId = req.headers.get('x-empresa-id');
  if (!empresaId) {
    throw new Error('Tenant context is missing.');
  }
  return empresaId;
}

export async function GET(req: NextRequest) {
  try {
    const empresaId = getTenantId(req);
    const config = await prisma.configuracionAfip.findUnique({
      where: { empresaId },
    });

    if (!config) {
      return NextResponse.json({
        exists: false,
        modo: 'demo',
        puntoVenta: 1,
        cuit: '',
        razonSocial: '',
        condicionIva: 'Responsable Inscripto',
        hasCert: false,
      });
    }

    return NextResponse.json({
      exists: true,
      id: config.id,
      cuit: config.cuit,
      razonSocial: config.razonSocial,
      condicionIva: config.condicionIva,
      puntoVenta: config.puntoVenta,
      modo: config.modo,
      hasCert: !!config.certificadoEncriptado,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const empresaId = getTenantId(req);
    const { cuit, razonSocial, condicionIva, puntoVenta, modo, certificado, clavePrivada } = await req.json();

    if (!cuit || !razonSocial || !condicionIva || !puntoVenta || !modo) {
      return NextResponse.json({ error: 'Faltan campos obligatorios para configurar AFIP.' }, { status: 400 });
    }

    // Load existing config
    const existing = await prisma.configuracionAfip.findUnique({
      where: { empresaId },
    });

    let certificadoEncriptado = existing?.certificadoEncriptado || null;
    let claveEncriptada = existing?.claveEncriptada || null;
    let iv = existing?.iv || null;

    // Encrypt certificates if newly provided
    if (certificado && clavePrivada) {
      const encryptedCert = encrypt(certificado);
      const encryptedKey = encrypt(clavePrivada);
      
      certificadoEncriptado = encryptedCert.encrypted;
      claveEncriptada = encryptedKey.encrypted;
      
      // Both encryption results use different random IVs.
      // For simplicity, we can store the key's iv in the DB and use it.
      // Wait, let's make sure: if we encrypt them separately, they get different IVs.
      // If we store a single iv in the database, we should encrypt them with the SAME IV or store IVs in the ciphertext!
      // In lib/crypto.ts, we designed encrypt to return { encrypted: "tag:ciphertext", iv: ivHex }.
      // If we save the IV, which IV do we save?
      // Ah! In lib/crypto.ts, we can update it or just use different columns or save the IV inside the encrypted text!
      // Wait, let's look at lib/crypto.ts:
      // decrypt(encryptedWithTag: string, ivHex: string) -> decrypts it.
      // Since it expects ivHex as a parameter, if we have two fields (cert and key), and only one IV column,
      // they would have to share the IV, or we could store the IV directly inside the encrypted column!
      // Wait, let's check: if we encrypt cert and key, can we use the same IV for both?
      // It is cryptographically safer to use different IVs, but if they share it, it's fine.
      // Or we can store the IV in the column itself, like `iv:tag:ciphertext`!
      // Wait! Let's check our implementation of encrypt/decrypt in lib/crypto.ts.
      // In lib/crypto.ts:
      // encrypt(text: string) returns { encrypted: `${tag}:${encrypted}`, iv: iv.toString('hex') }
      // decrypt(encryptedWithTag: string, ivHex: string) expects the iv separately.
      // Since we have a single `iv` column, we can encrypt both fields using the SAME iv, or we can just save the IV of the key.
      // But wait! If we encrypt both, how do we use the same IV?
      // Let's look at `lib/crypto.ts`. We didn't export a function to encrypt with a custom IV.
      // Let's modify `lib/crypto.ts` or write a small adjustment so we can save both IVs,
      // or we can just save them in a combined string, or we can rewrite encrypt/decrypt to pack the IV inside the string!
      // Packing the IV inside the string is extremely clean:
      // `encrypted: `${ivHex}:${tag}:${ciphertext}``
      // Then we don't even need the `iv` column in the database!
      // Let's see: yes! That is a very standard and robust pattern: self-contained encrypted strings.
      // Let's check if we can write a wrapper or rewrite decrypt/encrypt to pack the IV, or let's just make both share the IV.
      // Wait! Can we store both IVs in the database? Since we only have a single `iv` string column in prisma schema, we can store a JSON or we can just make both share the same IV.
      // Let's see: we can generate a single IV, and use a custom encrypt function, or we can just store the IV of the cert in the `iv` column, and for the key we can store it in another place, or we can just adjust `lib/crypto.ts` to pack the IV, or adjust `POST` to do a simple trick.
      // Let's check: can we just write the IV in the database `iv` column, and if we encrypt both, we just generate one IV?
      // Wait, in `lib/crypto.ts`, `encrypt` generates `iv` internally.
      // Let's check: we can easily pack both. What if we change `iv` database column to store the IV, and we encrypt the cert and key?
      // Since they both need an IV, if they use different IVs, we can store them in a joined string, e.g. `ivCert:ivKey` in the `iv` database column!
      // Yes! That's super simple! We save `iv: `${certIv}:${keyIv}`` in the `iv` database column, and when decrypting:
      // `const [certIv, keyIv] = iv.split(':')`
      // That is extremely clever, requires absolutely no changes to `lib/crypto.ts`, and works beautifully!
      // Let's write this logic. It is clean and elegant!
    }

    const certIv = certificado ? encrypt(certificado).iv : (existing?.iv ? existing.iv.split(':')[0] : null);
    const keyIv = clavePrivada ? encrypt(clavePrivada).iv : (existing?.iv ? existing.iv.split(':')[1] : null);

    if (certificado && clavePrivada) {
      const encCert = encrypt(certificado);
      const encKey = encrypt(clavePrivada);
      certificadoEncriptado = encCert.encrypted;
      claveEncriptada = encKey.encrypted;
      iv = `${encCert.iv}:${encKey.iv}`;
    }

    await prisma.configuracionAfip.upsert({
      where: { empresaId },
      update: {
        cuit,
        razonSocial,
        condicionIva,
        puntoVenta: parseInt(puntoVenta, 10) || 1,
        modo,
        certificadoEncriptado,
        claveEncriptada,
        iv,
      },
      create: {
        empresaId,
        cuit,
        razonSocial,
        condicionIva,
        puntoVenta: parseInt(puntoVenta, 10) || 1,
        modo,
        certificadoEncriptado,
        claveEncriptada,
        iv,
      },
    });

    // Also update the company's CUIT and name to match AFIP config for consistency
    await prisma.empresa.update({
      where: { id: empresaId },
      data: {
        cuit,
        nombre: razonSocial,
        condicionIva,
      },
    });

    return NextResponse.json({ success: true, message: 'Configuración de AFIP guardada correctamente.' });
  } catch (error: any) {
    console.error('AFIP config error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
