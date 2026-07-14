import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

function getTenantId(req: NextRequest): string {
  const empresaId = req.headers.get('x-empresa-id');
  if (!empresaId) {
    throw new Error('Tenant context is missing.');
  }
  return empresaId;
}

export async function GET(req: NextRequest) {
  try {
    const empresaId = getTenantId(req);
    const productos = await prisma.producto.findMany({
      where: { empresaId, activo: true },
      orderBy: { nombre: 'asc' },
    });
    return NextResponse.json(productos);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const empresaId = getTenantId(req);
    const {
      codigo,
      nombre,
      categoria,
      navigator,
      unidad,
      precioCosto,
      precioVenta,
      ivaPorcentaje,
      stockActual,
      stockMinimo,
    } = await req.json();

    if (!codigo || !nombre || !unidad) {
      return NextResponse.json({ error: 'Faltan campos obligatorios (código, nombre, unidad).' }, { status: 400 });
    }

    // Check duplicate code *within this business only*
    const existing = await prisma.producto.findFirst({
      where: {
        empresaId,
        codigo,
      },
    });

    if (existing?.activo) {
      return NextResponse.json(
        { error: `Ya existe un producto con el código "${codigo}" en tu comercio.` },
        { status: 400 }
      );
    }

    if (existing) {
      const producto = await prisma.producto.update({
        where: { id: existing.id },
        data: {
          nombre,
          categoria: categoria || 'General',
          unidad,
          precioCosto: parseFloat(precioCosto) || 0,
          precioVenta: parseFloat(precioVenta) || 0,
          ivaPorcentaje: parseFloat(ivaPorcentaje) || 21.0,
          stockActual: parseFloat(stockActual) || 0,
          stockMinimo: parseFloat(stockMinimo) || 0,
          activo: true,
        },
      });

      return NextResponse.json(producto);
    }

    const producto = await prisma.producto.create({
      data: {
        empresaId,
        codigo,
        nombre,
        categoria: categoria || 'General',
        unidad,
        precioCosto: parseFloat(precioCosto) || 0,
        precioVenta: parseFloat(precioVenta) || 0,
        ivaPorcentaje: parseFloat(ivaPorcentaje) || 21.0,
        stockActual: parseFloat(stockActual) || 0,
        stockMinimo: parseFloat(stockMinimo) || 0,
      },
    });

    return NextResponse.json(producto);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const empresaId = getTenantId(req);
    const { id, tipoAjuste, cantidad, precioVenta, precioCosto } = await req.json();

    if (!id) {
      return NextResponse.json({ error: 'ID de producto requerido.' }, { status: 400 });
    }

    // Find existing product to make sure it belongs to the tenant
    const prod = await prisma.producto.findFirst({
      where: { id, empresaId, activo: true }
    });

    if (!prod) {
      return NextResponse.json({ error: 'Producto no encontrado.' }, { status: 404 });
    }

    const updateData: any = {};
    if (precioVenta !== undefined) updateData.precioVenta = parseFloat(precioVenta) || 0;
    if (precioCosto !== undefined) updateData.precioCosto = parseFloat(precioCosto) || 0;

    // Handle stock adjustments
    if (tipoAjuste && cantidad !== undefined) {
      const qty = parseFloat(cantidad) || 0;
      const currentStock = prod.stockActual.toNumber();
      
      if (tipoAjuste === 'compra') {
        updateData.stockActual = currentStock + qty;
      } else if (tipoAjuste === 'merma') {
        updateData.stockActual = Math.max(0, currentStock - qty);
      } else if (tipoAjuste === 'ajuste') {
        updateData.stockActual = qty;
      }
    }

    const updatedProduct = await prisma.producto.update({
      where: { id },
      data: updateData
    });

    return NextResponse.json(updatedProduct);
  } catch (error: any) {
    console.error('Stock adjustment error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const empresaId = getTenantId(req);
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID de producto requerido.' }, { status: 400 });
    }

    const prod = await prisma.producto.findFirst({
      where: { id, empresaId, activo: true },
    });

    if (!prod) {
      return NextResponse.json({ error: 'Producto no encontrado.' }, { status: 404 });
    }

    await prisma.producto.update({
      where: { id },
      data: { activo: false },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Product delete error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
