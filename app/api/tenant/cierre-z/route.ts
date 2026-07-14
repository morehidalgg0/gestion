import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const DEFAULT_MONTO_INICIAL = 10000;

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

function signedTotal(tipoComprobante: string, total: unknown) {
  const amount = Number(total);
  return tipoComprobante.startsWith('Nota de Crédito') ? -amount : amount;
}

async function calculateCierre(empresaId: string, usuarioId: string, start: Date, end: Date, montoInicial: number) {
  const ventas = await prisma.venta.findMany({
    where: {
      empresaId,
      usuarioId,
      fecha: {
        gte: start,
        lte: end,
      },
      estado: {
        in: ['COMPLETADO', 'DEMO'],
      },
    },
    include: {
      cliente: true,
    },
    orderBy: { fecha: 'asc' },
  });

  const porFormaPago = ventas.reduce<Record<string, number>>((acc, venta) => {
    acc[venta.formaPago] = (acc[venta.formaPago] || 0) + signedTotal(venta.tipoComprobante, venta.total);
    return acc;
  }, {});

  const facturadoTotal = ventas.reduce((acc, venta) => acc + signedTotal(venta.tipoComprobante, venta.total), 0);
  const efectivoNeto = porFormaPago.Efectivo || 0;

  return {
    montoInicial,
    facturadoTotal,
    efectivoNeto,
    totalCaja: montoInicial + efectivoNeto,
    porFormaPago,
    cantidadComprobantes: ventas.length,
    ventas: ventas.map((venta) => ({
      id: venta.id,
      fecha: venta.fecha,
      tipoComprobante: venta.tipoComprobante,
      puntoVenta: venta.puntoVenta,
      numeroComprobante: venta.numeroComprobante,
      formaPago: venta.formaPago,
      total: Number(venta.total),
      signedTotal: signedTotal(venta.tipoComprobante, venta.total),
      cliente: venta.cliente.razonSocial,
    })),
  };
}

async function getOrCreateCaja(empresaId: string, usuarioId: string, fecha: Date) {
  return prisma.cajaDiaria.upsert({
    where: {
      empresaId_usuarioId_fecha: {
        empresaId,
        usuarioId,
        fecha,
      },
    },
    update: {},
    create: {
      empresaId,
      usuarioId,
      fecha,
      montoInicial: DEFAULT_MONTO_INICIAL,
    },
  });
}

export async function GET(req: NextRequest) {
  try {
    const empresaId = getTenantId(req);
    const usuarioId = getUserId(req);
    const { searchParams } = new URL(req.url);
    const { date, start, end } = getBusinessDay(searchParams.get('fecha') || undefined);

    const caja = await getOrCreateCaja(empresaId, usuarioId, start);
    const montoInicial = Number(caja.montoInicial);
    const calculated = await calculateCierre(empresaId, usuarioId, start, end, montoInicial);
    const cierreGuardado = caja.detalle as any;
    const cierre = caja.cerradoAt && cierreGuardado ? cierreGuardado : calculated;

    return NextResponse.json({
      fecha: date,
      cerrado: !!caja.cerradoAt,
      cerradoAt: caja.cerradoAt,
      concepto: caja.concepto,
      ...cierre,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const empresaId = getTenantId(req);
    const usuarioId = getUserId(req);
    const { fecha, montoInicial } = await req.json();
    const businessDay = getBusinessDay(fecha);
    const parsedMonto = Number(montoInicial);

    if (!Number.isFinite(parsedMonto) || parsedMonto < 0) {
      return NextResponse.json({ error: 'El monto inicial debe ser un número mayor o igual a cero.' }, { status: 400 });
    }

    const existing = await getOrCreateCaja(empresaId, usuarioId, businessDay.start);
    if (existing.cerradoAt) {
      return NextResponse.json({ error: 'El cierre Z de este día ya fue emitido y no puede modificarse.' }, { status: 400 });
    }

    const caja = await prisma.cajaDiaria.upsert({
      where: {
        empresaId_usuarioId_fecha: {
          empresaId,
          usuarioId,
          fecha: businessDay.start,
        },
      },
      update: {
        montoInicial: parsedMonto,
      },
      create: {
        empresaId,
        usuarioId,
        fecha: businessDay.start,
        montoInicial: parsedMonto,
      },
    });

    return NextResponse.json({ success: true, montoInicial: Number(caja.montoInicial) });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const empresaId = getTenantId(req);
    const usuarioId = getUserId(req);
    const { fecha } = await req.json();
    const businessDay = getBusinessDay(fecha);
    const caja = await getOrCreateCaja(empresaId, usuarioId, businessDay.start);

    if (caja.cerradoAt) {
      return NextResponse.json({ error: 'El cierre Z de este día ya fue emitido.' }, { status: 400 });
    }

    const cierre = await calculateCierre(
      empresaId,
      usuarioId,
      businessDay.start,
      businessDay.end,
      Number(caja.montoInicial)
    );

    const updated = await prisma.cajaDiaria.update({
      where: { id: caja.id },
      data: {
        cerradoAt: new Date(),
        concepto: 'Cierre Z diario: total de comprobantes emitidos en el dia, discriminado por forma de pago y caja fisica esperada',
        facturadoTotal: cierre.facturadoTotal,
        efectivoNeto: cierre.efectivoNeto,
        totalCaja: cierre.totalCaja,
        cantidadComprobantes: cierre.cantidadComprobantes,
        detalle: cierre,
      },
    });

    return NextResponse.json({
      success: true,
      fecha: businessDay.date,
      cerrado: true,
      cerradoAt: updated.cerradoAt,
      concepto: updated.concepto,
      ...cierre,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
