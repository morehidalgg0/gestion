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
      include: {
        codigos: {
          select: { id: true, codigo: true },
        },
      },
      orderBy: { nombre: 'asc' },
    });
    return NextResponse.json(productos);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}

// Normaliza la lista de códigos alternativos venida del cliente (array o string
// separado por comas) quitando vacíos, duplicados y el código principal.
function normalizeAltCodes(codigos: any, principal: string): string[] {
  const list = Array.isArray(codigos)
    ? codigos
    : typeof codigos === 'string'
      ? codigos.split(',')
      : [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of list) {
    const code = String(raw || '').trim();
    if (!code) continue;
    if (code === principal.trim()) continue;
    if (seen.has(code)) continue;
    seen.add(code);
    result.push(code);
  }
  return result;
}

// Devuelve true si algún código (principal o alternativo) ya existe en otro
// producto de la empresa (excluyendo un producto específico si se pasa).
async function codeExistsElsewhere(
  empresaId: string,
  codes: string[],
  excludeProductId?: string
): Promise<boolean> {
  if (!codes.length) return false;
  const [inAlt, inMain] = await Promise.all([
    prisma.productoCodigo.findMany({
      where: {
        codigo: { in: codes },
        producto: { empresaId, ...(excludeProductId ? { NOT: { id: excludeProductId } } : {}) },
      },
      select: { codigo: true },
    }),
    prisma.producto.findMany({
      where: {
        empresaId,
        codigo: { in: codes },
        ...(excludeProductId ? { NOT: { id: excludeProductId } } : {}),
      },
      select: { codigo: true },
    }),
  ]);
  return inAlt.length > 0 || inMain.length > 0;
}

// Persiste la lista de códigos alternativos en un prod (transaction).
async function replaceAltCodes(productoId: string, codes: string[]) {
  await prisma.$transaction([
    prisma.productoCodigo.deleteMany({ where: { productoId } }),
    ...codes.map((codigo) =>
      prisma.productoCodigo.create({ data: { productoId, codigo } })
    ),
  ]);
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
      imagenUrl,
      codigosAlternativos,
    } = await req.json();

    if (!codigo || !nombre || !unidad) {
      return NextResponse.json({ error: 'Faltan campos obligatorios (código, nombre, unidad).' }, { status: 400 });
    }

    const altCodes = normalizeAltCodes(codigosAlternativos, codigo);

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

    if (await codeExistsElsewhere(empresaId, altCodes)) {
      return NextResponse.json(
        { error: 'Uno de los códigos alternativos ya pertenece a otro producto.' },
        { status: 400 }
      );
    }

    if (existing) {
      const producto = await prisma.$transaction(async (tx) => {
        const updated = await tx.producto.update({
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
            imagenUrl: imagenUrl || null,
            activo: true,
          },
        });
        if (altCodes.length) {
          await replaceAltCodes(updated.id, altCodes);
        }
        return updated;
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
        imagenUrl: imagenUrl || null,
        codigos: altCodes.length ? { create: altCodes.map((codigo) => ({ codigo })) } : undefined,
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

export async function PATCH(req: NextRequest) {
  try {
    const empresaId = getTenantId(req);
    const body = await req.json();
    const {
      id,
      codigo,
      nombre,
      categoria,
      unidad,
      precioCosto,
      precioVenta,
      ivaPorcentaje,
      stockActual,
      stockMinimo,
      imagenUrl,
      codigosAlternativos,
    } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID de producto requerido.' }, { status: 400 });
    }

    const prod = await prisma.producto.findFirst({
      where: { id, empresaId },
    });

    if (!prod || !prod.activo) {
      return NextResponse.json({ error: 'Producto no encontrado.' }, { status: 404 });
    }

    // If editing the main fields (not a pure image update), require the basics
    const editingMain = codigo !== undefined || nombre !== undefined || unidad !== undefined;
    if (editingMain && (!codigo || !nombre || !unidad)) {
      return NextResponse.json({ error: 'Faltan campos obligatorios (código, nombre, unidad).' }, { status: 400 });
    }

    const nextCodigo = codigo !== undefined ? codigo : prod.codigo;
    if (codigo !== undefined && codigo !== prod.codigo) {
      const duplicate = await prisma.producto.findFirst({
        where: { empresaId, codigo, NOT: { id } },
      });

      if (duplicate) {
        return NextResponse.json(
          { error: `Ya existe un producto con el código "${codigo}" en tu comercio.` },
          { status: 400 }
        );
      }
    }

    // If alternative codes are being updated, validate and replace them
    let data: any = {};

    if (codigo !== undefined) data.codigo = codigo;
    if (nombre !== undefined) data.nombre = nombre;
    if (categoria !== undefined) data.categoria = categoria || 'General';
    if (unidad !== undefined) data.unidad = unidad;
    if (precioCosto !== undefined) data.precioCosto = parseFloat(precioCosto) || 0;
    if (precioVenta !== undefined) data.precioVenta = parseFloat(precioVenta) || 0;
    if (ivaPorcentaje !== undefined) data.ivaPorcentaje = parseFloat(ivaPorcentaje) || 21.0;
    if (stockActual !== undefined) data.stockActual = parseFloat(stockActual) || 0;
    if (stockMinimo !== undefined) data.stockMinimo = parseFloat(stockMinimo) || 0;
    if (imagenUrl !== undefined) {
      data.imagenUrl = imagenUrl === '' || imagenUrl === null ? null : imagenUrl;
    }

    const producto = await prisma.$transaction(async (tx) => {
      const updated = await tx.producto.update({
        where: { id },
        data,
      });

      // Replace alternative codes only when explicitly provided
      if (codigosAlternativos !== undefined) {
        const altCodes = normalizeAltCodes(codigosAlternativos, nextCodigo);
        if (await codeExistsElsewhere(empresaId, altCodes, id)) {
          throw new Error('Uno de los códigos alternativos ya pertenece a otro producto.');
        }
        await replaceAltCodes(updated.id, altCodes);
      }

      return updated;
    });

    return NextResponse.json(producto);
  } catch (error: any) {
    console.error('Product edit error:', error);
    if (error.message === 'Uno de los códigos alternativos ya pertenece a otro producto.') {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
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
