import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

function getTenantId(req: NextRequest): string {
  const empresaId = req.headers.get('x-empresa-id');
  if (!empresaId) {
    throw new Error('Tenant context is missing.');
  }
  return empresaId;
}

function getRange(periodo: string, desde?: string | null, hasta?: string | null) {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' });

  let start: Date;
  let end: Date;

  if (desde && hasta) {
    start = new Date(`${desde}T00:00:00-03:00`);
    end = new Date(`${hasta}T23:59:59.999-03:00`);
    return { start, end };
  }

  if (periodo === 'hoy') {
    start = new Date(`${today}T00:00:00-03:00`);
    end = new Date(`${today}T23:59:59.999-03:00`);
    return { start, end };
  }

  start = new Date(`${today}T00:00:00-03:00`);
  if (periodo === 'semana') {
    start.setDate(start.getDate() - 7);
  } else if (periodo === 'mes') {
    start.setDate(start.getDate() - 30);
  } else if (periodo === 'trimestre') {
    start.setDate(start.getDate() - 90);
  } else {
    // todos
    start.setFullYear(start.getFullYear() - 5);
  }
  end = new Date(`${today}T23:59:59.999-03:00`);
  return { start, end };
}

// Fixed category classification for clearer profitability breakdown
const OPERATIVOS_FIJOS = new Set([
  'Alquiler',
  'Sueldos',
  'Servicios',
  'Impuestos',
  'Seguros',
  'Publicidad',
]);

export async function GET(req: NextRequest) {
  try {
    const empresaId = getTenantId(req);
    const { searchParams } = new URL(req.url);
    const periodo = searchParams.get('periodo') || 'mes';

    const { start, end } = getRange(periodo, searchParams.get('desde'), searchParams.get('hasta'));

    // INGRESOS por ventas (COMPLETADO y DEMO) en el período
    const ventas = await prisma.venta.findMany({
      where: {
        empresaId,
        fecha: { gte: start, lte: end },
        estado: { in: ['COMPLETADO', 'DEMO'] },
      },
      select: {
        total: true,
        tipoComprobante: true,
        formaPago: true,
      },
    });

    let ingresos = 0;
    let ingresosEfectivo = 0;
    let ingresosTarjeta = 0;
    let ingresosTransferencia = 0;
    let ventasCuentaCorriente = 0;
    for (const v of ventas) {
      const mult = v.tipoComprobante.startsWith('Nota de Crédito') ? -1 : 1;
      const total = v.total.toNumber() * mult;
      ingresos += total;

      if (v.tipoComprobante.startsWith('Nota de Crédito')) {
        // Nota de crédito reduce según la forma de pago original (no la trackeamos), se resta del total.
        continue;
      }

      if (v.formaPago === 'Efectivo') ingresosEfectivo += total;
      else if (v.formaPago === 'Tarjeta') ingresosTarjeta += total;
      else if (v.formaPago === 'Transferencia') ingresosTransferencia += total;
      else ventasCuentaCorriente += total;
    }

    // EGRESOS en el período (todos los gastos)
    const egresos = await prisma.egresoCaja.findMany({
      where: {
        empresaId,
        fecha: { gte: start, lte: end },
      },
      select: {
        categoria: true,
        monto: true,
      },
    });

    const egresoPorCategoria = new Map<string, number>();
    let egresosTotales = 0;
    let egresosVariados = 0;
    let egresosFijos = 0;

    for (const e of egresos) {
      const monto = e.monto.toNumber();
      egresosTotales += monto;
      egresoPorCategoria.set(e.categoria, (egresoPorCategoria.get(e.categoria) || 0) + monto);

      if (OPERATIVOS_FIJOS.has(e.categoria)) {
        egresosFijos += monto;
      } else {
        egresosVariados += monto;
      }
    }

    const gananciaReal = ingresos - egresosTotales;
    const margen = ingresos > 0 ? (gananciaReal / ingresos) * 100 : 0;

    const desglose = Array.from(egresoPorCategoria.entries())
      .map(([categoria, monto]) => ({
        categoria,
        monto,
        porcentaje: egresosTotales > 0 ? (monto / egresosTotales) * 100 : 0,
      }))
      .sort((a, b) => b.monto - a.monto);

    return NextResponse.json({
      periodo,
      rango: { desde: start, hasta: end },
      ingresos,
      ventas: {
        total: ingresos,
        efectivo: ingresosEfectivo,
        tarjeta: ingresosTarjeta,
        transferencia: ingresosTransferencia,
        cuentaCorriente: ventasCuentaCorriente,
      },
      egresos: {
        total: egresosTotales,
        fijos: egresosFijos,
        variados: egresosVariados,
      },
      desgloseEgresos: desglose,
      gananciaReal,
      margen,
    });
  } catch (error: any) {
    console.error('Rentabilidad endpoint error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
