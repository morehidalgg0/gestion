import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

function getTenantId(req: NextRequest): string {
  const empresaId = req.headers.get('x-empresa-id');
  if (!empresaId) {
    throw new Error('Tenant context is missing.');
  }
  return empresaId;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const empresaId = getTenantId(req);
    const { id } = await params;

    const cierre = await prisma.cajaDiaria.findFirst({
      where: {
        id,
        empresaId,
      },
      include: {
        empresa: {
          include: {
            configAfip: true,
          },
        },
        usuario: {
          select: {
            id: true,
            nombre: true,
            email: true,
          },
        },
      },
    });

    if (!cierre || !cierre.cerradoAt) {
      return NextResponse.json({ error: 'Comprobante de cierre Z no encontrado.' }, { status: 404 });
    }

    return NextResponse.json({
      id: cierre.id,
      fecha: cierre.fecha,
      cerradoAt: cierre.cerradoAt,
      concepto: cierre.concepto,
      montoInicial: Number(cierre.montoInicial),
      facturadoTotal: Number(cierre.facturadoTotal || 0),
      efectivoNeto: Number(cierre.efectivoNeto || 0),
      totalCaja: Number(cierre.totalCaja || 0),
      cantidadComprobantes: cierre.cantidadComprobantes || 0,
      detalle: cierre.detalle,
      empresa: cierre.empresa,
      usuario: cierre.usuario,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
