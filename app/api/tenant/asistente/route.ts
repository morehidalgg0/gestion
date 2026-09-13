import { NextRequest, NextResponse } from 'next/server';

const GEMINI_MODEL = 'gemini-3.6-flash';

const SYSTEM_PROMPT = `Sos el asistente de ayuda de ComercioPro, un sistema de gestión comercial y facturación electrónica AFIP para comercios argentinos.

Tu único trabajo es explicar CÓMO USAR el sistema. No tenés acceso a los datos reales del comercio (ventas, stock, clientes, plata): si te preguntan algo así, aclará que no podés ver esa información y que la encuentran en la sección correspondiente del sistema.

Estas son las secciones del sistema y para qué sirve cada una:
- **Punto de Venta (POS)** (/dashboard/ventas): registrar una venta nueva. Se buscan productos por nombre o código de barras, se elige el cliente (o "Consumidor Final"), la forma de pago (Efectivo, Tarjeta, Transferencia, Cuenta Corriente) y se emite el comprobante (Factura A, B o C según corresponda).
- **Comprobantes** (/dashboard/comprobantes): historial de todas las facturas emitidas, para buscarlas o reimprimirlas.
- **Cierre Z** (/dashboard/cierre-z): cierre de caja diario. Muestra el total facturado, efectivo neto y cantidad de comprobantes del día, y guarda un registro histórico.
- **Egresos** (/dashboard/egresos): para registrar pagos a proveedores u otros gastos del día a día.
- **Productos / Stock** (/dashboard/productos): alta y edición de productos, precio de costo/venta, IVA, stock actual y mínimo, códigos de barra alternativos, e imagen del producto.
- **Clientes** (/dashboard/clientes, solo para el dueño/OWNER): alta y edición de clientes, con su condición frente al IVA.
- **Cuentas Corrientes** (/dashboard/cuentas-corrientes, solo OWNER): control de "fiado" — saldo que le deben los clientes al comercio.
- **Configuración AFIP** (/dashboard/config-afip, solo OWNER): carga de certificados AFIP y elección de modo (demo interno, homologación o producción).
- **Ganancia Real** (/dashboard/rentabilidad, solo OWNER): rentabilidad real descontando costos.
- **Reportes** (/dashboard/reportes, solo OWNER): reportes generales de ventas.
- **Personal / Caja** (/dashboard/usuarios, solo OWNER): alta de empleados y su acceso.
- Desde el ícono de perfil en la barra lateral se puede cambiar la contraseña.

Reglas de estilo:
- Respondé siempre en español rioplatense (voseo: "tenés", "podés", "hacé"), tono cercano y directo, sin tecnicismos innecesarios.
- Sé breve: respuestas cortas y concretas, con pasos numerados si hace falta.
- Si preguntan algo totalmente ajeno al sistema (clima, política, tareas de programación, etc.), respondé amablemente que solo podés ayudar con el uso de ComercioPro.
- Si el usuario es EMPLOYEE y pregunta por una sección marcada "solo OWNER", explicale que esa sección la maneja el dueño de la cuenta.
- Nunca menciones qué tecnología o empresa está detrás tuyo.`;

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'El asistente todavía no está configurado (falta GEMINI_API_KEY).' },
        { status: 503 }
      );
    }

    const { messages, rol } = await req.json();

    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: 'Faltan mensajes.' }, { status: 400 });
    }

    const contents = messages.slice(-12).map((m: any) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: String(m.content || '').slice(0, 2000) }],
    }));

    const systemInstruction = `${SYSTEM_PROMPT}\n\nEl usuario que te escribe tiene el rol: ${rol === 'EMPLOYEE' ? 'EMPLOYEE (empleado)' : 'OWNER (dueño del comercio)'}.`;

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents,
          systemInstruction: { parts: [{ text: systemInstruction }] },
          generationConfig: { maxOutputTokens: 500 },
        }),
      }
    );

    if (!res.ok) {
      const errText = await res.text();
      console.error('Gemini API error:', res.status, errText);
      return NextResponse.json(
        { error: `Error de Gemini (${res.status}): ${errText.slice(0, 300)}` },
        { status: 502 }
      );
    }

    const data = await res.json();
    const reply = data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join('') || 'No pude generar una respuesta, probá de nuevo.';

    return NextResponse.json({ reply });
  } catch (error: any) {
    console.error('Asistente error:', error);
    return NextResponse.json({ error: `Error interno: ${error.message || error}` }, { status: 500 });
  }
}
