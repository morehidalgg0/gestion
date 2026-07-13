import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

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
    const clientes = await prisma.cliente.findMany({
      where: { empresaId },
      orderBy: { razonSocial: 'asc' },
    });
    return NextResponse.json(clientes);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const empresaId = getTenantId(req);
    const {
      tipoDoc,
      nroDoc,
      razonSocial,
      condicionIva,
      direccion,
      telefono,
      email,
      limiteCredito,
    } = await req.json();

    if (!tipoDoc || !nroDoc || !razonSocial || !condicionIva) {
      return NextResponse.json(
        { error: 'Faltan campos obligatorios (tipoDoc, nroDoc, razón social, condición IVA).' },
        { status: 400 }
      );
    }

    // Check duplicate document *within this company only*, unless it is document type '99' (anonymous)
    if (tipoDoc !== '99') {
      const existing = await prisma.cliente.findFirst({
        where: {
          empresaId,
          tipoDoc,
          nroDoc,
        },
      });

      if (existing) {
        return NextResponse.json(
          { error: `Ya existe un cliente registrado con el ${tipoDoc} ${nroDoc}.` },
          { status: 400 }
        );
      }
    }

    const cliente = await prisma.cliente.create({
      data: {
        empresaId,
        tipoDoc,
        nroDoc,
        razonSocial,
        condicionIva,
        direccion: direccion || '',
        telefono: telefono || '',
        email: email || '',
        limiteCredito: limiteCredito ? parseFloat(limiteCredito) : null,
        saldoCuentaCorriente: 0,
      },
    });

    return NextResponse.json(cliente);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
