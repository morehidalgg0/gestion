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

function getUserRole(req: NextRequest): string {
  return req.headers.get('x-user-rol') || '';
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

function saleTotal(tipoComprobante: string, total: unknown) {
  return tipoComprobante.startsWith('Nota de Crédito') ? 0 : Number(total);
}

async function calculateCierre(empresaId: string, usuarioId: string | null, start: Date, end: Date, montoInicial: number) {
  const ventas = await prisma.venta.findMany({
    where: {
      empresaId,
      ...(usuarioId ? { usuarioId } : {}),
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

  const facturadoTotal = ventas.reduce((acc, venta) => acc + saleTotal(venta.tipoComprobante, venta.total), 0);
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

function cierreConcepto(tipo: string) {
  if (tipo === 'X') {
    return 'Cierre X de control: corte parcial de caja para cambio o control de empleado, sin cerrar la jornada.';
  }

  return 'Cierre Z diario: total de comprobantes emitidos en el dia, discriminado por forma de pago y caja fisica esperada';
}

function toCierreResponse(cierre: any) {
  return {
    id: cierre.id,
    tipo: cierre.tipo,
    fecha: cierre.fecha,
    emitidoAt: cierre.emitidoAt,
    cerradoAt: cierre.tipo === 'Z' ? cierre.emitidoAt : null,
    concepto: cierre.concepto,
    montoInicial: Number(cierre.montoInicial),
    facturadoTotal: Number(cierre.facturadoTotal),
    efectivoNeto: Number(cierre.efectivoNeto),
    totalCaja: Number(cierre.totalCaja),
    cantidadComprobantes: cierre.cantidadComprobantes,
    detalle: cierre.detalle,
  };
}

export async function GET(req: NextRequest) {
  try {
    const empresaId = getTenantId(req);
    const usuarioId = getUserId(req);
    const userRole = getUserRole(req);
    const { searchParams } = new URL(req.url);
    const { date, start, end } = getBusinessDay(searchParams.get('fecha') || undefined);
    const cierreUsuarioId = userRole === 'OWNER' ? null : usuarioId;

    const caja = await getOrCreateCaja(empresaId, usuarioId, start);
    const montoInicial = Number(caja.montoInicial);
    const calculated = await calculateCierre(empresaId, cierreUsuarioId, start, end, montoInicial);
    const cierres = await prisma.cierreCaja.findMany({
      where: {
        empresaId,
        ...(cierreUsuarioId ? { usuarioId: cierreUsuarioId } : {}),
        fecha: start,
      },
      orderBy: { emitidoAt: 'desc' },
    });
    const cierreZ = cierres.find((cierre) => cierre.tipo === 'Z');
    const cierre = (cierreZ?.detalle as any) || calculated;

    return NextResponse.json({
      id: caja.id,
      fecha: date,
      cerrado: !!caja.cerradoAt,
      cerradoAt: caja.cerradoAt,
      concepto: caja.concepto,
      historial: cierres.map(toCierreResponse),
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
    const userRole = getUserRole(req);
    const { fecha, tipo = 'Z' } = await req.json();
    const cierreTipo = String(tipo).toUpperCase();

    if (!['X', 'Z'].includes(cierreTipo)) {
      return NextResponse.json({ error: 'El tipo de cierre debe ser X o Z.' }, { status: 400 });
    }

    const businessDay = getBusinessDay(fecha);
    const cierreUsuarioId = userRole === 'OWNER' ? null : usuarioId;
    const caja = await getOrCreateCaja(empresaId, usuarioId, businessDay.start);

    if (cierreTipo === 'Z' && caja.cerradoAt) {
      return NextResponse.json({ error: 'El cierre Z de este día ya fue emitido.' }, { status: 400 });
    }

    if (cierreTipo === 'X' && caja.cerradoAt) {
      return NextResponse.json({ error: 'La caja ya tiene Cierre Z emitido. No se pueden emitir nuevos Cierres X para esta jornada.' }, { status: 400 });
    }

    const cierre = await calculateCierre(
      empresaId,
      cierreUsuarioId,
      businessDay.start,
      businessDay.end,
      Number(caja.montoInicial)
    );

    const concepto = cierreConcepto(cierreTipo);
    const emitidoAt = new Date();
    const comprobante = await prisma.$transaction(async (tx) => {
      const created = await tx.cierreCaja.create({
        data: {
          empresaId,
          usuarioId,
          cajaDiariaId: caja.id,
          tipo: cierreTipo,
          fecha: businessDay.start,
          emitidoAt,
          concepto,
          montoInicial: cierre.montoInicial,
          facturadoTotal: cierre.facturadoTotal,
          efectivoNeto: cierre.efectivoNeto,
          totalCaja: cierre.totalCaja,
          cantidadComprobantes: cierre.cantidadComprobantes,
          detalle: cierre as any,
        },
      });

      if (cierreTipo === 'Z') {
        await tx.cajaDiaria.update({
          where: { id: caja.id },
          data: {
            cerradoAt: emitidoAt,
            concepto,
            facturadoTotal: cierre.facturadoTotal,
            efectivoNeto: cierre.efectivoNeto,
            totalCaja: cierre.totalCaja,
            cantidadComprobantes: cierre.cantidadComprobantes,
            detalle: cierre as any,
          },
        });
      }

      return created;
    });

    return NextResponse.json({
      success: true,
      id: comprobante.id,
      tipo: comprobante.tipo,
      fecha: businessDay.date,
      cerrado: cierreTipo === 'Z',
      cerradoAt: cierreTipo === 'Z' ? comprobante.emitidoAt : null,
      emitidoAt: comprobante.emitidoAt,
      concepto: comprobante.concepto,
      ...cierre,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
