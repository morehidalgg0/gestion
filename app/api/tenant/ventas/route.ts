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

function getBusinessDay(date = new Date()) {
  const day = date.toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' });
  const start = new Date(`${day}T00:00:00-03:00`);
  const end = new Date(`${day}T23:59:59.999-03:00`);
  return { start, end };
}

export async function GET(req: NextRequest) {
  try {
    const empresaId = getTenantId(req);
    const ventas = await prisma.venta.findMany({
      where: { empresaId },
      include: {
        cliente: true,
        items: true,
      },
      orderBy: { fecha: 'desc' },
    });
    return NextResponse.json(ventas);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const empresaId = getTenantId(req);
    const usuarioId = getUserId(req);

    if (usuarioId) {
      const { start } = getBusinessDay();
      const [cajaCerrada, cierreZEmitido] = await Promise.all([
        prisma.cajaDiaria.findUnique({
          where: {
            empresaId_usuarioId_fecha: {
              empresaId,
              usuarioId,
              fecha: start,
            },
          },
        }),
        prisma.cierreCaja.findFirst({
          where: {
            empresaId,
            usuarioId,
            fecha: start,
            tipo: 'Z',
          },
        }),
      ]);

      if (cajaCerrada?.cerradoAt || cierreZEmitido) {
        return NextResponse.json(
          { error: 'La caja de hoy ya tiene Cierre Z emitido. No se pueden registrar más ventas en esta jornada.' },
          { status: 403 }
        );
      }
    }

    // 1. Load company and subscription details to verify limits
    const empresa = await prisma.empresa.findUnique({
      where: { id: empresaId },
      include: {
        suscripcion: {
          include: {
            plan: true,
          },
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

    // 2. Check Monthly Sales Limit
    const plan = suscripcion.plan;
    if (plan.limiteVentasMensuales > 0) {
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const salesCount = await prisma.venta.count({
        where: {
          empresaId,
          fecha: { gte: startOfMonth },
          estado: { in: ['COMPLETADO', 'DEMO'] },
        },
      });

      if (salesCount >= plan.limiteVentasMensuales) {
        return NextResponse.json(
          {
            error: `Ha superado el límite de ventas mensuales de su plan (${plan.limiteVentasMensuales} ventas). Por favor, actualice su plan.`,
          },
          { status: 403 }
        );
      }
    }

    // Parse input
    const { clienteId, formaPago, items, tipoComprobante: manualTipoComprobante, datosFacturacion } = await req.json();

    if (!clienteId || !formaPago || !items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Faltan campos obligatorios para registrar la venta.' }, { status: 400 });
    }

    // 3. Load client info
    let cliente: any = await prisma.cliente.findUnique({
      where: { id: clienteId },
    });

    if (!cliente || cliente.empresaId !== empresaId) {
      return NextResponse.json({ error: 'Cliente no encontrado.' }, { status: 404 });
    }

    const tiposFacturaManual = ['Factura A', 'Factura B', 'Factura C'];
    if (tiposFacturaManual.includes(manualTipoComprobante)) {
      if (!datosFacturacion?.tipoDoc || !datosFacturacion?.nroDoc || !datosFacturacion?.razonSocial || !datosFacturacion?.condicionIva) {
        return NextResponse.json(
          { error: 'Para Factura A/B/C tenés que completar tipo de documento, número, razón social y condición IVA.' },
          { status: 400 }
        );
      }

      if (manualTipoComprobante === 'Factura A' && (datosFacturacion.tipoDoc !== 'CUIT' || datosFacturacion.condicionIva !== 'Responsable Inscripto')) {
        return NextResponse.json(
          { error: 'Para Factura A el receptor debe tener CUIT y condición IVA Responsable Inscripto.' },
          { status: 400 }
        );
      }

      if (manualTipoComprobante === 'Factura C' && empresa.condicionIva !== 'Monotributista') {
        return NextResponse.json(
          { error: 'La Factura C corresponde a emisores Monotributistas.' },
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

    // 4. Load products and check stock
    const productIds = items.map((i: any) => i.productoId);
    const dbProducts = await prisma.producto.findMany({
      where: {
        id: { in: productIds },
        empresaId,
      },
    });

    if (dbProducts.length !== items.length) {
      return NextResponse.json({ error: 'Algunos productos del carrito no existen en su stock.' }, { status: 400 });
    }

    // Validate quantities, compute subtotal and IVA
    let totalVenta = 0;
    const invoiceItems: any[] = [];
    const dbProductsMap = new Map(dbProducts.map((p) => [p.id, p]));

    for (const item of items) {
      const prod = dbProductsMap.get(item.productoId);
      if (!prod) continue;

      const qty = parseFloat(item.cantidad);
      if (isNaN(qty) || qty <= 0) {
        return NextResponse.json({ error: `Cantidad inválida para el producto ${prod.nombre}.` }, { status: 400 });
      }

      // Check stock limit
      const stock = prod.stockActual.toNumber();
      if (stock < qty) {
        return NextResponse.json(
          { error: `Stock insuficiente para ${prod.nombre}. Disponible: ${stock} ${prod.unidad}.` },
          { status: 400 }
        );
      }

      const precioUnitario = prod.unidad === 'g' ? prod.precioVenta.toNumber() / 1000 : prod.precioVenta.toNumber();
      const itemSubtotal = qty * precioUnitario;
      totalVenta += itemSubtotal;

      invoiceItems.push({
        productoId: prod.id,
        nombre: prod.nombre,
        cantidad: qty,
        precioUnitario,
        ivaPorcentaje: prod.ivaPorcentaje.toNumber(),
      });
    }

    // 5. Check Credit Limit for Cuenta Corriente
    if (formaPago === 'Cuenta Corriente') {
      const currentDebt = cliente.saldoCuentaCorriente.toNumber();
      const maxCredit = cliente.limiteCredito ? cliente.limiteCredito.toNumber() : null;

      if (maxCredit !== null && currentDebt + totalVenta > maxCredit) {
        return NextResponse.json(
          {
            error: `Límite de crédito superado. Deuda actual: $${currentDebt.toFixed(
              2
            )}, Compra: $${totalVenta.toFixed(2)}, Límite: $${maxCredit.toFixed(2)}.`,
          },
          { status: 400 }
        );
      }
    }

    // 6. Determine Invoice Type (Fiscal A/B/C or Manual Non-Fiscal X)
    let tipoComprobante: 'Factura A' | 'Factura B' | 'Factura C' | 'Factura X' = 'Factura B';
    if (tiposFacturaManual.includes(manualTipoComprobante)) {
      tipoComprobante = manualTipoComprobante;
    } else if (manualTipoComprobante === 'Factura X') {
      tipoComprobante = 'Factura X';
    } else if (empresa.condicionIva === 'Monotributista') {
      tipoComprobante = 'Factura C';
    } else if (empresa.condicionIva === 'Responsable Inscripto') {
      if (cliente.condicionIva === 'Responsable Inscripto') {
        tipoComprobante = 'Factura A';
      } else {
        tipoComprobante = 'Factura B';
      }
    }

    // 7. Initialize AFIP setup
    const configAfip = empresa.configAfip;
    if (!configAfip) {
      return NextResponse.json({ error: 'La configuración de AFIP del comercio no existe.' }, { status: 400 });
    }

    // Execute AFIP Web Service authorization
    const afipResult = await emitirFactura({
      cuitEmisor: configAfip.cuit,
      razonSocialEmisor: configAfip.razonSocial,
      condicionIvaEmisor: configAfip.condicionIva as any,
      puntoVenta: configAfip.puntoVenta,
      tipoComprobante,
      clienteTipoDoc: cliente.tipoDoc,
      clienteNroDoc: cliente.nroDoc,
      items: invoiceItems.map((i) => ({
        nombre: i.nombre,
        cantidad: i.cantidad,
        precioUnitario: i.precioUnitario,
        ivaPorcentaje: i.ivaPorcentaje,
      })),
      modo: configAfip.modo as any,
      certificadoEncriptado: configAfip.certificadoEncriptado,
      claveEncriptada: configAfip.claveEncriptada,
      iv: configAfip.iv,
    });

    // 8. Handle Rejection from AFIP
    if (afipResult.estado === 'RECHAZADO_AFIP') {
      // Save rejected sale history for auditing
      await prisma.venta.create({
        data: {
          empresaId,
          usuarioId,
          clienteId: cliente.id,
          tipoComprobante,
          puntoVenta: configAfip.puntoVenta,
          numeroComprobante: 0,
          subtotal: totalVenta * 0.826, // dummy tax ratio
          iva: totalVenta * 0.174,
          total: totalVenta,
          formaPago,
          estado: 'RECHAZADO_AFIP',
          mensajeAfip: afipResult.mensajeAfip,
        },
      });

      return NextResponse.json(
        {
          error: `AFIP rechazó el comprobante: ${afipResult.mensajeAfip}`,
          status: 'RECHAZADO_AFIP',
        },
        { status: 422 }
      );
    }

    // 9. Assign numbering if in internal demo mode
    let finalVoucherNumber = afipResult.numeroComprobante;
    if (afipResult.estado === 'DEMO') {
      // Find last number locally and increment
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

    // 10. Perform DB transaction (Save Sale, Deduct Stock, Update CC if needed)
    const result = await prisma.$transaction(async (tx) => {
      // 10.1 Deduct stock
      for (const item of invoiceItems) {
        await tx.producto.update({
          where: { id: item.productoId },
          data: {
            stockActual: { decrement: item.cantidad },
          },
        });
      }

      // Calculate taxes breakdown for database logging
      let taxSubtotal = 0;
      let taxIva = 0;
      if (tipoComprobante === 'Factura C') {
        taxSubtotal = totalVenta;
        taxIva = 0;
      } else {
        // Compute backwards from total
        for (const item of invoiceItems) {
          const itemTotal = item.cantidad * item.precioUnitario;
          const rate = item.ivaPorcentaje === 10.5 ? 1.105 : 1.21;
          const net = itemTotal / rate;
          taxSubtotal += net;
          taxIva += itemTotal - net;
        }
      }

      // 10.2 Create Sale record
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
          formaPago,
          estado: afipResult.estado,
          cae: afipResult.cae,
          caeVencimiento: afipResult.caeVencimiento,
          mensajeAfip: afipResult.mensajeAfip,
          items: {
            create: invoiceItems.map((i) => ({
              productoId: i.productoId,
              productoName: i.nombre,
              cantidad: i.cantidad,
              precioUnitario: i.precioUnitario,
              subtotal: i.cantidad * i.precioUnitario,
            })),
          },
        },
        include: {
          items: true,
          cliente: true,
        },
      });

      // 10.3 Update current account if sold on credit
      if (formaPago === 'Cuenta Corriente') {
        const clientAfterUpdate = await tx.cliente.update({
          where: { id: cliente.id },
          data: {
            saldoCuentaCorriente: { increment: totalVenta },
          },
        });

        // Log cc movement
        await tx.movimientoCuentaCorriente.create({
          data: {
            empresaId,
            clienteId: cliente.id,
            tipo: 'DEBE',
            concepto: `${tipoComprobante} Nº ${configAfip.puntoVenta.toString().padStart(4, '0')}-${finalVoucherNumber
              .toString()
              .padStart(8, '0')}`,
            importe: totalVenta,
            ventaId: sale.id,
            saldoResultante: clientAfterUpdate.saldoCuentaCorriente,
          },
        });
      }

      return sale;
    });

    return NextResponse.json({
      success: true,
      venta: result,
    });
  } catch (error: any) {
    console.error('POS Checkout error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
