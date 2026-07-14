import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

function getTenantId(req: NextRequest): string {
  const empresaId = req.headers.get('x-empresa-id');
  if (!empresaId) {
    throw new Error('Tenant context is missing.');
  }
  return empresaId;
}

function getUserId(req: NextRequest): string {
  const userId = req.headers.get('x-user-id');
  if (!userId) {
    throw new Error('User context is missing.');
  }
  return userId;
}

function getBusinessDay(dateValue?: string) {
  const date = dateValue || new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' });
  const start = new Date(`${date}T00:00:00-03:00`);
  const end = new Date(`${date}T23:59:59.999-03:00`);
  return { date, start, end };
}

export async function GET(req: NextRequest) {
  try {
    const empresaId = getTenantId(req);
    const { searchParams } = new URL(req.url);
    const { start, end } = getBusinessDay(searchParams.get('fecha') || undefined);

    const egresos = await prisma.egresoCaja.findMany({
      where: {
        empresaId,
        fecha: {
          gte: start,
          lte: end,
        },
      },
      include: {
        usuario: {
          select: {
            nombre: true,
            email: true,
          },
        },
      },
      orderBy: { fecha: 'desc' },
    });

    return NextResponse.json(egresos.map((egreso) => ({
      ...egreso,
      monto: Number(egreso.monto),
    })));
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const empresaId = getTenantId(req);
    const usuarioId = getUserId(req);
    const { fecha, proveedor, categoria, concepto, formaPago, monto, observacion } = await req.json();
    const parsedMonto = Number(monto);

    if (!proveedor || !categoria || !concepto || !formaPago) {
      return NextResponse.json({ error: 'Faltan campos obligatorios: proveedor, categoría, concepto y forma de pago.' }, { status: 400 });
    }

    if (!Number.isFinite(parsedMonto) || parsedMonto <= 0) {
      return NextResponse.json({ error: 'El monto del egreso debe ser mayor a cero.' }, { status: 400 });
    }

    const businessDay = getBusinessDay(fecha);
    const cierreZ = await prisma.cierreCaja.findFirst({
      where: {
        empresaId,
        fecha: businessDay.start,
        tipo: 'Z',
      },
    });

    if (cierreZ) {
      return NextResponse.json({ error: 'La caja ya tiene Cierre Z emitido. No se pueden registrar egresos en esta jornada.' }, { status: 403 });
    }

    const egreso = await prisma.egresoCaja.create({
      data: {
        empresaId,
        usuarioId,
        fecha: fecha ? new Date(`${fecha}T12:00:00-03:00`) : new Date(),
        proveedor,
        categoria,
        concepto,
        formaPago,
        monto: parsedMonto,
        observacion: observacion || '',
      },
      include: {
        usuario: {
          select: {
            nombre: true,
            email: true,
          },
        },
      },
    });

    return NextResponse.json({ ...egreso, monto: Number(egreso.monto) });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
