import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { emitirFactura } from '@/lib/afip';

function getTenantId(req: NextRequest): string {
  const empresaId = req.headers.get('x-empresa-id');
  if (!empresaId) {
    throw new Error('Tenant context is missing.');
  }
  return empresaId;
}

function getUserId(req: NextRequest): string | null {
  return req.headers.get('x-user-id');
}

function getCreditNoteType(tipoComprobante: string) {
  switch (tipoComprobante) {
    case 'Factura A':
      return 'Nota de Crédito A';
    case 'Factura B':
      return 'Nota de Crédito B';
    case 'Factura C':
      return 'Nota de Crédito C';
    case 'Factura X':
      return 'Nota de Crédito X';
    default:
      return null;
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const empresaId = getTenantId(req);
    const usuarioId = getUserId(req);
    const body = await req.json().catch(() => ({}));
    const requestedAmount = body?.monto !== undefined ? Number(body.monto) : null;

    const empresa = await prisma.empresa.findUnique({
      where: { id: empresaId },
      include: { configAfip: true },
    });

    if (!empresa?.configAfip) {
      return NextResponse.json({ error: 'La configuración de AFIP del comercio no existe.' }, { status: 400 });
    }

    const original = await prisma.venta.findFirst({
      where: { id, empresaId },
      include: {
        cliente: true,
        items: {
          include: {
            producto: true,
          },
        },
      },
    });

    if (!original) {
      return NextResponse.json({ error: 'Comprobante original no encontrado.' }, { status: 404 });
    }

    const tipoNotaCredito = getCreditNoteType(original.tipoComprobante);
    if (!tipoNotaCredito) {
      return NextResponse.json({ error: 'Solo se pueden anular Facturas A, B, C o X.' }, { status: 400 });
    }

    if (original.estado === 'RECHAZADO_AFIP') {
      return NextResponse.json({ error: 'No se puede emitir nota de crédito sobre un comprobante rechazado.' }, { status: 400 });
    }

    const existingCreditNotes = await prisma.venta.findMany({
      where: {
        empresaId,
        tipoComprobante: tipoNotaCredito,
        mensajeAfip: { contains: `Comprobante original ID: ${original.id}` },
      },
    });

    const originalTotal = original.total.toNumber();
    if (originalTotal <= 0) {
      return NextResponse.json({ error: 'El comprobante original no tiene un total válido para acreditar.' }, { status: 400 });
    }

    const creditedTotal = existingCreditNotes.reduce((acc, note) => acc + note.total.toNumber(), 0);
    const remainingTotal = Math.max(0, originalTotal - creditedTotal);
    const creditAmount = requestedAmount === null ? remainingTotal : requestedAmount;

    if (remainingTotal <= 0.009) {
      return NextResponse.json({ error: 'Este comprobante ya fue acreditado por completo.' }, { status: 400 });
    }

    if (!Number.isFinite(creditAmount) || creditAmount <= 0) {
      return NextResponse.json({ error: 'El monto de la nota de crédito debe ser mayor a cero.' }, { status: 400 });
    }

    if (creditAmount - remainingTotal > 0.009) {
      return NextResponse.json(
        { error: `El monto supera el saldo disponible para acreditar ($${remainingTotal.toFixed(2)}).` },
        { status: 400 }
      );
    }

    const configAfip = empresa.configAfip;
    const ratio = creditAmount / originalTotal;
    const invoiceItems = original.items.map((item) => ({
      productoId: item.productoId,
      nombre: item.productoName,
      cantidad: item.cantidad.toNumber() * ratio,
      precioUnitario: item.precioUnitario.toNumber(),
      ivaPorcentaje: item.producto.ivaPorcentaje.toNumber(),
    }));
    const subtotalCredito = original.subtotal.toNumber() * ratio;
    const ivaCredito = original.iva.toNumber() * ratio;

    const afipResult = await emitirFactura({
      cuitEmisor: configAfip.cuit,
      razonSocialEmisor: configAfip.razonSocial,
      condicionIvaEmisor: configAfip.condicionIva as any,
      puntoVenta: configAfip.puntoVenta,
      tipoComprobante: tipoNotaCredito as any,
      clienteTipoDoc: original.cliente.tipoDoc,
      clienteNroDoc: original.cliente.nroDoc,
      items: invoiceItems.map((item) => ({
        nombre: item.nombre,
        cantidad: item.cantidad,
        precioUnitario: item.precioUnitario,
        ivaPorcentaje: item.ivaPorcentaje,
      })),
      modo: configAfip.modo as any,
      certificadoEncriptado: configAfip.certificadoEncriptado,
      claveEncriptada: configAfip.claveEncriptada,
      iv: configAfip.iv,
      comprobanteAsociado: original.tipoComprobante === 'Factura X'
        ? undefined
        : {
            tipoComprobante: original.tipoComprobante as 'Factura A' | 'Factura B' | 'Factura C',
            puntoVenta: original.puntoVenta,
            numeroComprobante: original.numeroComprobante,
          },
    });

    if (afipResult.estado === 'RECHAZADO_AFIP') {
      return NextResponse.json(
        { error: `AFIP rechazó la nota de crédito: ${afipResult.mensajeAfip}` },
        { status: 422 }
      );
    }

    let finalVoucherNumber = afipResult.numeroComprobante;
    if (afipResult.estado === 'DEMO') {
      const lastLocalCreditNote = await prisma.venta.findFirst({
        where: {
          empresaId,
          tipoComprobante: tipoNotaCredito,
          puntoVenta: configAfip.puntoVenta,
        },
        orderBy: { numeroComprobante: 'desc' },
      });
      finalVoucherNumber = lastLocalCreditNote ? lastLocalCreditNote.numeroComprobante + 1 : 1;
    }

    const result = await prisma.$transaction(async (tx) => {
      for (const item of invoiceItems) {
        await tx.producto.update({
          where: { id: item.productoId },
          data: {
            stockActual: { increment: item.cantidad },
          },
        });
      }

      const creditNote = await tx.venta.create({
        data: {
          empresaId,
          usuarioId,
          clienteId: original.clienteId,
          tipoComprobante: tipoNotaCredito,
          puntoVenta: configAfip.puntoVenta,
          numeroComprobante: finalVoucherNumber,
          subtotal: subtotalCredito,
          iva: ivaCredito,
          total: creditAmount,
          formaPago: original.formaPago,
          estado: afipResult.estado,
          cae: afipResult.cae,
          caeVencimiento: afipResult.caeVencimiento,
          mensajeAfip: `${afipResult.mensajeAfip || 'Nota de crédito emitida'}. Nota parcial por $${creditAmount.toFixed(2)}. Comprobante original ID: ${original.id}`,
          items: {
            create: invoiceItems.map((item) => ({
              productoId: item.productoId,
              productoName: item.nombre,
              cantidad: item.cantidad,
              precioUnitario: item.precioUnitario,
              subtotal: item.cantidad * item.precioUnitario,
            })),
          },
        },
        include: {
          cliente: true,
          items: true,
        },
      });

      if (original.formaPago === 'Cuenta Corriente') {
        const clientAfterUpdate = await tx.cliente.update({
          where: { id: original.clienteId },
          data: {
            saldoCuentaCorriente: { decrement: creditAmount },
          },
        });

        await tx.movimientoCuentaCorriente.create({
          data: {
            empresaId,
            clienteId: original.clienteId,
            tipo: 'HABER',
            concepto: `${tipoNotaCredito} Nº ${configAfip.puntoVenta.toString().padStart(4, '0')}-${finalVoucherNumber
              .toString()
              .padStart(8, '0')}`,
            importe: creditAmount,
            ventaId: creditNote.id,
            saldoResultante: clientAfterUpdate.saldoCuentaCorriente,
          },
        });
      }

      return creditNote;
    });

    return NextResponse.json({ success: true, venta: result });
  } catch (error: any) {
    console.error('Credit note creation error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
