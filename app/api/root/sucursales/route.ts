import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    const empresaId = req.nextUrl.searchParams.get('empresaId') || undefined;

    const sucursales = await prisma.sucursal.findMany({
      where: empresaId ? { empresaId } : undefined,
      orderBy: [{ empresaId: 'asc' }, { nombre: 'asc' }],
    });

    return NextResponse.json(sucursales);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { empresaId, nombre, direccion } = await req.json();

    if (!empresaId || !nombre) {
      return NextResponse.json({ error: 'Empresa y nombre de sucursal son requeridos.' }, { status: 400 });
    }

    const empresa = await prisma.empresa.findUnique({
      where: { id: empresaId },
      include: { suscripcion: { include: { plan: true } }, sucursales: true },
    });

    if (!empresa) {
      return NextResponse.json({ error: 'Empresa no encontrada.' }, { status: 404 });
    }

    const limite = empresa.suscripcion?.plan.limiteSucursales ?? 1;
    if (limite !== 0 && empresa.sucursales.length >= limite) {
      return NextResponse.json(
        { error: `El plan de esta empresa permite hasta ${limite} sucursal(es). Ampliá el límite del plan para agregar más.` },
        { status: 409 }
      );
    }

    const sucursal = await prisma.sucursal.create({
      data: { empresaId, nombre, direccion: direccion || null },
    });

    return NextResponse.json(sucursal, { status: 201 });
  } catch (error: any) {
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'Esa empresa ya tiene una sucursal con ese nombre.' }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const { id, nombre, direccion, activa } = await req.json();

    if (!id) {
      return NextResponse.json({ error: 'ID de sucursal requerido.' }, { status: 400 });
    }

    const updateData: any = {};
    if (typeof nombre === 'string') updateData.nombre = nombre;
    if (direccion !== undefined) updateData.direccion = direccion || null;
    if (typeof activa === 'boolean') updateData.activa = activa;

    const sucursal = await prisma.sucursal.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(sucursal);
  } catch (error: any) {
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'Esa empresa ya tiene una sucursal con ese nombre.' }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'ID de sucursal requerido.' }, { status: 400 });
    }

    await prisma.sucursal.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
