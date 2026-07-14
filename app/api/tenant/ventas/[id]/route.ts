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

    return NextResponse.json(venta);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
