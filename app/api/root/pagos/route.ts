import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    const empresaId = req.nextUrl.searchParams.get('empresaId') || undefined;

    const pagos = await prisma.pago.findMany({
      where: empresaId ? { empresaId } : undefined,
      orderBy: { fecha: 'desc' },
      take: empresaId ? undefined : 100,
    });

    return NextResponse.json(pagos);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { empresaId, monto, medioPago, concepto, fecha } = await req.json();

    if (!empresaId || !monto || !medioPago) {
      return NextResponse.json({ error: 'Empresa, monto y medio de pago son requeridos.' }, { status: 400 });
    }

    const montoNum = parseFloat(monto);
    if (Number.isNaN(montoNum) || montoNum <= 0) {
      return NextResponse.json({ error: 'El monto tiene que ser un número mayor a 0.' }, { status: 400 });
    }

    const pago = await prisma.pago.create({
      data: {
        empresaId,
        monto: montoNum,
        medioPago,
        concepto: concepto || null,
        fecha: fecha ? new Date(fecha) : undefined,
      },
    });

    return NextResponse.json(pago, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'ID de pago requerido.' }, { status: 400 });
    }

    await prisma.pago.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
