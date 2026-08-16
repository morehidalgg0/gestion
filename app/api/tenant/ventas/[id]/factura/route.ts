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

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const empresaId = getTenantId(req);
    const usuarioId = getUserId(req);
    const body = await req.json().catch(() => ({}));
    const tipoComprobanteSolicitado = body?.tipoComprobante;
    const datosFacturacion = body?.datosFacturacion;

    const empresa = await prisma.empresa.findUnique({
      where: { id: empresaId },
      include: {
        suscripcion: {
          include: { plan: true },
        },
        configAfip: true,
      },
    });

    if (!empresa) {
      return NextResponse.json({ error: 'Empresa no encontrada.' }, { status: 404 });
    }

    if (empresa.estado !== 'ACTIVO') {
      return NextResponse.json(
        { error: 'Su comercio está suspendido o tiene pagos pendientes de suscripción.' },
        { status: 403 }
      );
    }

    const suscripcion = empresa.suscripcion;
    if (!suscripcion || new Date() > new Date(suscripcion.fechaVencimiento)) {
      return NextResponse.json(
        { error: 'Su suscripción ha vencido. Por favor, realice el pago para continuar operando.' },
        { status: 403 }
      );
    }

    if (!empresa.configAfip) {
      return NextResponse.json({ error: 'La configuración de AFIP del comercio no existe.' }, { status: 400 });
    }

    // 1. Load the original Ticket X sale
    const original = await prisma.venta.findFirst({
      where: { id, empresaId },
      include: {
        cliente: true,
        items: {
          include: { producto: true },
        },
      },
    });

    if (!original) {
      return NextResponse.json({ error: 'Ticket original no encontrado.' }, { status: 404 });
    }

    if (original.tipoComprobante !== 'Factura X') {
      return NextResponse.json({ error: 'Solo se pueden facturar tickets emitidos como Factura X (no fiscal).' }, { status: 400 });
    }

    // 2. Prevent double conversion
    const alreadyConverted = await prisma.venta.findFirst({
      where: { ventaOrigenId: original.id },
    });
    if (alreadyConverted) {
      return NextResponse.json(
        { error: `Este ticket ya fue facturado en el comprobante ${alreadyConverted.tipoComprobante} ${alreadyConverted.puntoVenta
            .toString()
            .padStart(4, '0')}-${alreadyConverted.numeroComprobante.toString().padStart(8, '0')}.` },
        { status: 400 }
      );
    }

    // 3. Determine fiscal invoice type
    const tiposValidos = ['Factura A', 'Factura B', 'Factura C'];
    let tipoComprobante: 'Factura A' | 'Factura B' | 'Factura C';
    if (tiposValidos.includes(tipoComprobanteSolicitado)) {
      tipoComprobante = tipoComprobanteSolicitado;
    } else {
      // Automatic: based on emitter and receiver tax condition
      if (empresa.condicionIva === 'Monotributista') {
        tipoComprobante = 'Factura C';
      } else {
        tipoComprobante = original.cliente.condicionIva === 'Responsable Inscripto' ? 'Factura A' : 'Factura B';
      }
    }

    if (tipoComprobante === 'Factura C' && empresa.condicionIva !== 'Monotributista') {
      return NextResponse.json({ error: 'La Factura C corresponde a emisores Monotributistas.' }, { status: 400 });
    }

    // 4. Resolve receiver fiscal data
    let cliente = original.cliente;
    const necesitaDatosFiscales = cliente.tipoDoc === '99' || datosFacturacion;

    if (necesitaDatosFiscales) {
      if (
        !datosFacturacion?.tipoDoc ||
        !datosFacturacion?.nroDoc ||
        !datosFacturacion?.razonSocial ||
        !datosFacturacion?.condicionIva
      ) {
        return NextResponse.json(
          { error: 'Para emitir la factura fiscal tenés que completar tipo de documento, número, razón social y condición IVA del receptor.' },
          { status: 400 }
        );
      }

      if (tipoComprobante === 'Factura A' && (datosFacturacion.tipoDoc !== 'CUIT' || datosFacturacion.condicionIva !== 'Responsable Inscripto')) {
        return NextResponse.json(
          { error: 'Para Factura A el receptor debe tener CUIT y condición IVA Responsable Inscripto.' },
          { status: 400 }
        );
      }

      const normalizedDoc = String(datosFacturacion.nroDoc).replace(/\D/g, '') || String(datosFacturacion.nroDoc).trim();
      const existingCliente = datosFacturacion.tipoDoc === '99'
        ? null
        : await prisma.cliente.findFirst({
            where: {
              empresaId,
              tipoDoc: datosFacturacion.tipoDoc,
              nroDoc: normalizedDoc,
            },
          });

      cliente = existingCliente || await prisma.cliente.create({
        data: {
          empresaId,
          tipoDoc: datosFacturacion.tipoDoc,
          nroDoc: normalizedDoc,
          razonSocial: datosFacturacion.razonSocial,
          condicionIva: datosFacturacion.condicionIva,
          direccion: datosFacturacion.direccion || '',
          email: datosFacturacion.email || '',
          telefono: '',
          saldoCuentaCorriente: 0,
        },
      });
    }

    // 5. Build invoice items from the original ticket (without touching stock again)
    const invoiceItems = original.items.map((item) => ({
      productoId: item.productoId,
      nombre: item.productoName,
      cantidad: item.cantidad.toNumber(),
      precioUnitario: item.precioUnitario.toNumber(),
      ivaPorcentaje: item.producto ? item.producto.ivaPorcentaje.toNumber() : 21,
    }));

    // 6. Compute taxes based on the fiscal invoice type
    let taxSubtotal = 0;
    let taxIva = 0;
    if (tipoComprobante === 'Factura C') {
      taxSubtotal = invoiceItems.reduce((acc, item) => acc + item.cantidad * item.precioUnitario, 0);
    } else {
      for (const item of invoiceItems) {
        const itemTotal = item.cantidad * item.precioUnitario;
        const rate = item.ivaPorcentaje === 10.5 ? 1.105 : item.ivaPorcentaje === 0 ? 1 : 1.21;
        taxSubtotal += itemTotal / rate;
        taxIva += itemTotal - itemTotal / rate;
      }
    }
    const totalVenta = invoiceItems.reduce((acc, item) => acc + item.cantidad * item.precioUnitario, 0);

    const configAfip = empresa.configAfip;

    // 7. Request AFIP authorization
    const afipResult = await emitirFactura({
      cuitEmisor: configAfip.cuit,
      razonSocialEmisor: configAfip.razonSocial,
      condicionIvaEmisor: configAfip.condicionIva as 'Responsable Inscripto' | 'Monotributista',
      puntoVenta: configAfip.puntoVenta,
      tipoComprobante,
      clienteTipoDoc: cliente.tipoDoc,
      clienteNroDoc: cliente.nroDoc,
      items: invoiceItems.map((item) => ({
        nombre: item.nombre,
        cantidad: item.cantidad,
        precioUnitario: item.precioUnitario,
        ivaPorcentaje: item.ivaPorcentaje,
      })),
      modo: configAfip.modo as 'demo' | 'homologacion' | 'produccion',
      certificadoEncriptado: configAfip.certificadoEncriptado,
      claveEncriptada: configAfip.claveEncriptada,
      iv: configAfip.iv,
    });

    if (afipResult.estado === 'RECHAZADO_AFIP') {
      return NextResponse.json(
        { error: `AFIP rechazó la factura: ${afipResult.mensajeAfip}` },
        { status: 422 }
      );
    }

    // 8. Assign numbering if in internal demo mode
    let finalVoucherNumber = afipResult.numeroComprobante;
    if (afipResult.estado === 'DEMO') {
      const lastLocalSale = await prisma.venta.findFirst({
        where: {
          empresaId,
          tipoComprobante,
          puntoVenta: configAfip.puntoVenta,
        },
        orderBy: { numeroComprobante: 'desc' },
      });
      finalVoucherNumber = lastLocalSale ? lastLocalSale.numeroComprobante + 1 : 1;
    }

    // 9. Persist the fiscal invoice (stock was already deducted on the original ticket)
    const result = await prisma.$transaction(async (tx) => {
      const sale = await tx.venta.create({
        data: {
          empresaId,
          usuarioId,
          clienteId: cliente.id,
          tipoComprobante,
          puntoVenta: configAfip.puntoVenta,
          numeroComprobante: finalVoucherNumber,
          subtotal: taxSubtotal,
          iva: taxIva,
          total: totalVenta,
          formaPago: original.formaPago,
          estado: afipResult.estado,
          cae: afipResult.cae,
          caeVencimiento: afipResult.caeVencimiento,
          mensajeAfip: `${afipResult.mensajeAfip || 'Factura emitida a demanda'}. Emitida desde Ticket X ${original.puntoVenta
            .toString()
            .padStart(4, '0')}-${original.numeroComprobante.toString().padStart(8, '0')}.`,
          ventaOrigenId: original.id,
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
          items: true,
          cliente: true,
        },
      });

      return sale;
    });

    return NextResponse.json({ success: true, venta: result });
  } catch (error) {
    console.error('On-demand invoicing error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Error desconocido.' }, { status: 500 });
  }
}
