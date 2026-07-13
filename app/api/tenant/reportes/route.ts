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
    const { searchParams } = new URL(req.url);
    const periodo = searchParams.get('periodo') || 'mes'; // 'dia', 'semana', 'mes', 'todos'

    // Compute date boundary
    const dateLimit = new Date();
    if (periodo === 'dia') {
      dateLimit.setHours(0, 0, 0, 0);
    } else if (periodo === 'semana') {
      dateLimit.setDate(dateLimit.getDate() - 7);
      dateLimit.setHours(0, 0, 0, 0);
    } else if (periodo === 'mes') {
      dateLimit.setDate(dateLimit.getDate() - 30);
      dateLimit.setHours(0, 0, 0, 0);
    } else {
      // 'todos' - e.g. 5 years ago
      dateLimit.setFullYear(dateLimit.getFullYear() - 5);
    }

    // 1. Total sales and taxes
    const salesStats = await prisma.venta.aggregate({
      where: {
        empresaId,
        fecha: { gte: dateLimit },
        estado: { in: ['COMPLETADO', 'DEMO'] },
      },
      _sum: {
        total: true,
        iva: true,
        subtotal: true,
      },
      _count: {
        id: true,
      },
    });

    // 2. Best Selling Products (grouped)
    const bestSellersRaw = await prisma.ventaItem.groupBy({
      by: ['productoId', 'productoName'],
      where: {
        venta: {
          empresaId,
          fecha: { gte: dateLimit },
          estado: { in: ['COMPLETADO', 'DEMO'] },
        },
      },
      _sum: {
        cantidad: true,
        subtotal: true,
      },
      orderBy: {
        _sum: {
          cantidad: 'desc',
        },
      },
      take: 5,
    });

    const bestSellers = bestSellersRaw.map((item) => ({
      id: item.productoId,
      nombre: item.productoName,
      cantidad: item._sum.cantidad?.toNumber() || 0,
      total: item._sum.subtotal?.toNumber() || 0,
    }));

    // 3. Debtor Clients (sorted highest to lowest debt)
    const debtors = await prisma.cliente.findMany({
      where: {
        empresaId,
        saldoCuentaCorriente: { gt: 0 },
      },
      orderBy: {
        saldoCuentaCorriente: 'desc',
      },
      take: 10,
    });

    // 4. Low stock products (filter in-memory for database-agnostic comparison)
    const allProducts = await prisma.producto.findMany({
      where: { empresaId },
    });
    
    const lowStock = allProducts
      .filter((p) => p.stockActual.toNumber() <= p.stockMinimo.toNumber())
      .sort((a, b) => a.stockActual.toNumber() - b.stockActual.toNumber())
      .slice(0, 10);

    // 5. Sales by Payment Method
    const salesByPaymentMethod = await prisma.venta.groupBy({
      by: ['formaPago'],
      where: {
        empresaId,
        fecha: { gte: dateLimit },
        estado: { in: ['COMPLETADO', 'DEMO'] },
      },
      _sum: {
        total: true,
      },
    });

    return NextResponse.json({
      periodo,
      stats: {
        totalVentas: salesStats._sum.total?.toNumber() || 0,
        totalIva: salesStats._sum.iva?.toNumber() || 0,
        totalNeto: salesStats._sum.subtotal?.toNumber() || 0,
        cantidadVentas: salesStats._count.id || 0,
      },
      bestSellers,
      debtors: debtors.map((d) => ({
        id: d.id,
        razonSocial: d.razonSocial,
        nroDoc: d.nroDoc,
        saldo: d.saldoCuentaCorriente.toNumber(),
      })),
      lowStock: lowStock.map((p) => ({
        id: p.id,
        codigo: p.codigo,
        nombre: p.nombre,
        stock: p.stockActual.toNumber(),
        min: p.stockMinimo.toNumber(),
        unidad: p.unidad,
      })),
      paymentMethods: salesByPaymentMethod.map((item) => ({
        metodo: item.formaPago,
        total: item._sum.total?.toNumber() || 0,
      })),
    });
  } catch (error: any) {
    console.error('Reports endpoint error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
