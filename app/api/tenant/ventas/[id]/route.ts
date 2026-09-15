import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { buildAfipQrUrl, getTipoComprobanteCodigo } from '@/lib/afipQr';

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
    const { id } = await params;
    const empresaId = getTenantId(req);

    const venta = await prisma.venta.findFirst({
      where: {
        id,
        empresaId,
      },
      include: {
        cliente: true,
        items: true,
        empresa: {
          include: {
            configAfip: true,
          },
        },
      },
    });

    if (!venta) {
      return NextResponse.json({ error: 'Comprobante no encontrado.' }, { status: 404 });
    }

    let qrUrl: string | null = null;
    const tipoCmpCodigo = getTipoComprobanteCodigo(venta.tipoComprobante);
    if (venta.cae && tipoCmpCodigo !== null) {
      qrUrl = buildAfipQrUrl({
        fecha: venta.createdAt,
        cuitEmisor: venta.empresa.configAfip?.cuit || venta.empresa.cuit,
        puntoVenta: venta.puntoVenta,
        tipoComprobanteCodigo: tipoCmpCodigo,
        numeroComprobante: venta.numeroComprobante,
        importeTotal: Number(venta.total),
        tipoDocReceptor: venta.cliente.tipoDoc,
        nroDocReceptor: venta.cliente.nroDoc,
        cae: venta.cae,
      });
    }

    return NextResponse.json({ ...venta, qrUrl });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
