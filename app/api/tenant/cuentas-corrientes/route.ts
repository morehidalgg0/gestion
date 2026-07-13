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
    const { searchParams } = new URL(req.url);
    const clienteId = searchParams.get('clienteId');

    const filter: any = { empresaId };
    if (clienteId) {
      filter.clienteId = clienteId;
    }

    const movimientos = await prisma.movimientoCuentaCorriente.findMany({
      where: filter,
      include: {
        cliente: true,
      },
      orderBy: { fecha: 'desc' },
    });

    return NextResponse.json(movimientos);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const empresaId = getTenantId(req);
    const { clienteId, importe, concepto } = await req.json();

    if (!clienteId || !importe || isNaN(parseFloat(importe)) || parseFloat(importe) <= 0) {
      return NextResponse.json(
        { error: 'Campos requeridos inválidos (clienteId, importe mayor a 0).' },
        { status: 400 }
      );
    }

    const value = parseFloat(importe);

    // Find client
    const cliente = await prisma.cliente.findUnique({
      where: { id: clienteId },
    });

    if (!cliente || cliente.empresaId !== empresaId) {
      return NextResponse.json({ error: 'Cliente no encontrado.' }, { status: 404 });
    }

    // Process payment in a transaction
    const movimiento = await prisma.$transaction(async (tx) => {
      // Decrement the client's debt
      const updatedClient = await tx.cliente.update({
        where: { id: clienteId },
        data: {
          saldoCuentaCorriente: { decrement: value },
        },
      });

      // Create credit movement (HABER)
      return await tx.movimientoCuentaCorriente.create({
        data: {
          empresaId,
          clienteId,
          tipo: 'HABER',
          concepto: concepto || 'Entrega de efectivo / Pago a cuenta',
          importe: value,
          saldoResultante: updatedClient.saldoCuentaCorriente,
        },
      });
    });

    return NextResponse.json(movimiento);
  } catch (error: any) {
    console.error('CC payment error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
