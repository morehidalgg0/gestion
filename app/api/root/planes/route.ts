import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    const planes = await prisma.plan.findMany({
      orderBy: { precioMensual: 'asc' },
    });
    return NextResponse.json(planes);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const { id, nombre, precioMensual, limiteVentasMensuales, limiteUsuarios, limiteSucursales } = await req.json();

    if (!id) {
      return NextResponse.json({ error: 'ID de plan requerido.' }, { status: 400 });
    }

    const updateData: any = {};
    if (typeof nombre === 'string') updateData.nombre = nombre;
    if (precioMensual !== undefined) updateData.precioMensual = precioMensual;
    if (limiteVentasMensuales !== undefined) updateData.limiteVentasMensuales = limiteVentasMensuales;
    if (limiteUsuarios !== undefined) updateData.limiteUsuarios = limiteUsuarios;
    if (limiteSucursales !== undefined) updateData.limiteSucursales = limiteSucursales;

    const plan = await prisma.plan.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(plan);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
