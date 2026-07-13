import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    const empresas = await prisma.empresa.findMany({
      include: {
        usuarios: {
          select: { id: true, nombre: true, email: true },
        },
        suscripcion: {
          include: {
            plan: true,
          },
        },
        _count: {
          select: {
            productos: true,
            ventas: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(empresas);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const { id, estado, planId, fechaVencimiento } = await req.json();

    if (!id) {
      return NextResponse.json({ error: 'ID de empresa requerido.' }, { status: 400 });
    }

    const updateData: any = {};
    if (estado) {
      updateData.estado = estado;
    }

    // Update Empresa details
    const empresa = await prisma.empresa.update({
      where: { id },
      data: updateData,
    });

    // Update Subscription details if requested
    if (planId || fechaVencimiento) {
      const sub = await prisma.suscripcion.findUnique({
        where: { empresaId: id },
      });

      const subUpdate: any = {};
      if (planId) subUpdate.planId = planId;
      if (fechaVencimiento) subUpdate.fechaVencimiento = new Date(fechaVencimiento);

      if (sub) {
        await prisma.suscripcion.update({
          where: { empresaId: id },
          data: subUpdate,
        });
      } else if (planId && fechaVencimiento) {
        await prisma.suscripcion.create({
          data: {
            empresaId: id,
            planId,
            estado: 'authorized',
            fechaVencimiento: new Date(fechaVencimiento),
          },
        });
      }
    }

    return NextResponse.json({ success: true, empresa });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
