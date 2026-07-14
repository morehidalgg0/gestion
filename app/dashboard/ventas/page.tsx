'use client';

import { useState, useEffect } from 'react';
import { ShoppingCart, Search, Trash2, CheckCircle2, AlertOctagon, HelpCircle } from 'lucide-react';

function todayArgentina() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' });
}

export default function PosPage() {
  const [productos, setProductos] = useState<any[]>([]);
  const [clientes, setClientes] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  
  // POS Cart State
  const [cart, setCart] = useState<any[]>([]);
  const [selectedClienteId, setSelectedClienteId] = useState('');
  const [formaPago, setFormaPago] = useState('Efectivo');
  const [tipoComprobanteSeleccionado, setTipoComprobanteSeleccionado] = useState('auto');
  const [facturacionTipoDoc, setFacturacionTipoDoc] = useState('CUIT');
  const [facturacionNroDoc, setFacturacionNroDoc] = useState('');
  const [facturacionRazonSocial, setFacturacionRazonSocial] = useState('');
  const [facturacionCondicionIva, setFacturacionCondicionIva] = useState('Responsable Inscripto');
  const [facturacionDireccion, setFacturacionDireccion] = useState('');
  const [facturacionEmail, setFacturacionEmail] = useState('');
  
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  
  // Dialog / Result states
  const [successResult, setSuccessResult] = useState<any>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [cajaCerrada, setCajaCerrada] = useState<{ cerrado: boolean; cerradoAt?: string | null }>({ cerrado: false });

  const loadData = async () => {
    try {
      const [prodRes, cliRes, cierreRes] = await Promise.all([
        fetch('/api/tenant/productos'),
        fetch('/api/tenant/clientes'),
        fetch(`/api/tenant/cierre-z?fecha=${todayArgentina()}`),
      ]);
      
      const prodData = await prodRes.json();
      const cliData = await cliRes.json();
      const cierreData = await cierreRes.json().catch(() => null);

      setProductos(Array.isArray(prodData) ? prodData : []);
      if (cierreRes.ok && cierreData) {
        setCajaCerrada({ cerrado: !!cierreData.cerrado, cerradoAt: cierreData.cerradoAt });
        if (cierreData.cerrado) {
          setCart([]);
        }
      }
      
      const clientsList = Array.isArray(cliData) ? cliData : [];
      setClientes(clientsList);

      // Default client is "Consumidor Final Genérico"
      const defaultClient = clientsList.find(
        (c) => c.nroDoc === '0' && c.tipoDoc === '99'
      );
      if (defaultClient) {
        setSelectedClienteId(defaultClient.id);
      } else if (clientsList.length > 0) {
        setSelectedClienteId(clientsList[0].id);
      }
    } catch (err) {
      console.error('Failed to load POS data:', err);
    } finally {
      setLoading(false);
    }
  };

  const getEffectiveUnitPrice = (product: any) => {
    const price = parseFloat(product.precioVenta);
    return product.unidad === 'g' ? price / 1000 : price;
  };

  const getPriceLabel = (product: any) => {
    const price = parseFloat(product.precioVenta).toLocaleString('es-AR');
    if (product.unidad === 'g') return `$${price} / kg`;
    if (product.unidad === 'kg') return `$${price} / kg`;
    return `$${price} / unidad`;
  };

  useEffect(() => {
    loadData();
  }, []);

  const requiereDatosFiscales = ['Factura A', 'Factura B', 'Factura C'].includes(tipoComprobanteSeleccionado);

  useEffect(() => {
    if (tipoComprobanteSeleccionado === 'Factura A') {
      setFacturacionTipoDoc('CUIT');
      setFacturacionCondicionIva('Responsable Inscripto');
    } else if (tipoComprobanteSeleccionado === 'Factura B') {
      setFacturacionCondicionIva('Consumidor Final');
    } else if (tipoComprobanteSeleccionado === 'Factura C') {
      setFacturacionCondicionIva('Monotributista');
    }
  }, [tipoComprobanteSeleccionado]);

  const addToCart = (product: any) => {
    if (cajaCerrada.cerrado) {
      alert('La caja de hoy ya tiene Cierre Z emitido. No se pueden registrar más ventas en esta jornada.');
      return;
    }

    const existing = cart.find((item) => item.productoId === product.id);
    const availableStock = product.stockActual;

    if (existing) {
      const nextQty = existing.cantidad + (product.unidad === 'g' ? 100 : 1);
      if (nextQty > availableStock) {
        alert(`No podés agregar más de este producto. Stock disponible: ${availableStock} ${product.unidad}`);
        return;
      }
      setCart(
        cart.map((item) =>
          item.productoId === product.id
            ? { ...item, cantidad: nextQty, subtotal: nextQty * item.precioUnitario }
            : item
        )
      );
    } else {
      const initialQty = product.unidad === 'g' ? 100 : 1;
      if (initialQty > availableStock) {
        alert(`Stock insuficiente. Disponible: ${availableStock} ${product.unidad}`);
        return;
      }
      setCart([
        ...cart,
        {
          productoId: product.id,
          nombre: product.nombre,
          unidad: product.unidad,
          precioUnitario: getEffectiveUnitPrice(product),
          precioReferencia: parseFloat(product.precioVenta),
          ivaPorcentaje: parseFloat(product.ivaPorcentaje),
          cantidad: initialQty,
          subtotal: initialQty * getEffectiveUnitPrice(product),
        },
      ]);
    }
  };

  const removeFromCart = (productoId: string) => {
    setCart(cart.filter((item) => item.productoId !== productoId));
  };

  const updateCartQty = (productoId: string, value: string) => {
    const qty = parseFloat(value);
    if (isNaN(qty) || qty <= 0) return;

    // Find original product to check stock
    const item = cart.find((i) => i.productoId === productoId);
    const originalProd = productos.find((p) => p.id === productoId);

    if (item && originalProd) {
      if (qty > originalProd.stockActual) {
        alert(`Stock insuficiente. Disponible: ${originalProd.stockActual} ${originalProd.unidad}`);
        return;
      }

      setCart(
        cart.map((i) =>
          i.productoId === productoId
            ? { ...i, cantidad: qty, subtotal: qty * i.precioUnitario }
            : i
        )
      );
    }
  };

  // Calculators
  const calculateCartTotals = () => {
    let total = 0;
    let net21 = 0;
    let iva21 = 0;
    let net105 = 0;
    let iva105 = 0;
    let exento = 0;

    cart.forEach((item) => {
      total += item.subtotal;
      
      if (item.ivaPorcentaje === 21.0) {
        const net = item.subtotal / 1.21;
        net21 += net;
        iva21 += item.subtotal - net;
      } else if (item.ivaPorcentaje === 10.5) {
        const net = item.subtotal / 1.105;
        net105 += net;
        iva105 += item.subtotal - net;
      } else {
        exento += item.subtotal;
      }
    });

    const subtotal = net21 + net105 + exento;
    const iva = iva21 + iva105;

    return {
      subtotal,
      iva,
      total,
      ivaDetail: {
        iva21,
        iva105,
      },
    };
  };

  const totals = calculateCartTotals();

  const handleCheckout = async () => {
    if (cajaCerrada.cerrado) {
      setErrorMessage('La caja de hoy ya tiene Cierre Z emitido. No se pueden registrar más ventas en esta jornada.');
      return;
    }

    if (cart.length === 0) {
      alert('El carrito de compras está vacío.');
      return;
    }

    if (requiereDatosFiscales && (!facturacionNroDoc.trim() || !facturacionRazonSocial.trim())) {
      setErrorMessage('Completá documento y razón social para emitir Factura A/B/C.');
      return;
    }

    setSubmitting(true);
    setErrorMessage('');

    try {
      const response = await fetch('/api/tenant/ventas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clienteId: selectedClienteId,
          formaPago,
          tipoComprobante: tipoComprobanteSeleccionado === 'auto' ? undefined : tipoComprobanteSeleccionado,
          datosFacturacion: requiereDatosFiscales ? {
            tipoDoc: facturacionTipoDoc,
            nroDoc: facturacionNroDoc,
            razonSocial: facturacionRazonSocial,
            condicionIva: facturacionCondicionIva,
            direccion: facturacionDireccion,
            email: facturacionEmail,
          } : undefined,
          items: cart.map((item) => ({
            productoId: item.productoId,
            cantidad: item.cantidad,
          })),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error desconocido al facturar.');
      }

      setSuccessResult(data.venta);
      setCart([]); // Clear cart
      loadData();  // Reload stock in screen
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const filteredProducts = productos.filter((p) => {
    const term = search.toLowerCase();
    const stock = parseFloat(p.stockActual);
    return (
      stock > 0 && // Only show items with stock available to sell
      (p.nombre.toLowerCase().includes(term) ||
        p.codigo.toLowerCase().includes(term) ||
        p.categoria.toLowerCase().includes(term))
    );
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Title */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.75rem', marginBottom: '0.25rem' }}>Facturación en Caja (POS)</h2>
        <p style={{ color: 'var(--text-muted)' }}>Carga el carrito de compras del cliente y emite comprobantes oficiales.</p>
      </div>

      {cajaCerrada.cerrado && (
        <div style={{ padding: '1rem', backgroundColor: '#fee2e2', color: '#b91c1c', borderRadius: 'var(--radius-md)', marginBottom: '1.5rem' }}>
          La caja de hoy ya tiene Cierre Z emitido{cajaCerrada.cerradoAt ? ` el ${new Date(cajaCerrada.cerradoAt).toLocaleString('es-AR')}` : ''}. No se pueden registrar más ventas en esta jornada.
        </div>
      )}

      {loading ? (
        <p style={{ color: 'var(--text-muted)' }}>Cargando caja registradora...</p>
      ) : (
        <div className="pos-layout">
          {/* LEFT: PRODUCTS LIST */}
          <div className="pos-products">
            <div className="card" style={{ padding: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Search size={18} style={{ color: 'var(--text-muted)' }} />
              <input
                type="text"
                className="form-input"
                style={{ border: 'none', padding: '0.25rem' }}
                placeholder="Buscar por código, nombre o categoría..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="pos-products-grid">
              {filteredProducts.map((p) => (
                <div
                  key={p.id}
                  onClick={() => addToCart(p)}
                  className="card pos-product-card"
                  style={{ opacity: cajaCerrada.cerrado ? 0.55 : 1, cursor: cajaCerrada.cerrado ? 'not-allowed' : 'pointer' }}
                >
                  <div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>
                      {p.categoria}
                    </span>
                    <strong style={{ fontSize: '0.95rem', display: 'block', height: '40px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {p.nombre}
                    </strong>
                  </div>
                  <div>
                    <span style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--primary)' }}>
                      {getPriceLabel(p)}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>
                      Stock: {parseFloat(p.stockActual).toFixed(3).replace(/\.?0+$/, '')} {p.unidad}
                    </span>
                  </div>
                </div>
              ))}
              {filteredProducts.length === 0 && (
                <p style={{ gridColumn: '1/-1', textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                  No hay productos disponibles con stock en el inventario.
                </p>
              )}
            </div>
          </div>

          {/* RIGHT: BILLING CART */}
          <div className="pos-cart">
            <div className="pos-cart-header">
              <h3 style={{ fontSize: '1.1rem' }}>🛒 Carrito de Compra</h3>
              <span className="badge badge-success">{cart.length} items</span>
            </div>

            {/* Select Customer */}
            <div style={{ padding: '1rem', borderBottom: '1px solid var(--border-color)' }}>
              <label className="form-label">Cliente Receptor</label>
              <select
                className="form-select"
                  value={selectedClienteId}
                  onChange={(e) => setSelectedClienteId(e.target.value)}
                  disabled={cajaCerrada.cerrado}
                >
                {clientes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.razonSocial} ({c.tipoDoc}: {c.nroDoc})
                  </option>
                ))}
              </select>
            </div>

            {/* Cart Items list */}
            <div className="pos-cart-items">
              {cart.map((item) => (
                <div key={item.productoId} className="pos-cart-item">
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ fontWeight: 600, fontSize: '0.9rem', display: 'block' }}>
                      {item.nombre}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {item.unidad === 'g'
                        ? `$${item.precioReferencia.toLocaleString('es-AR')} / kg`
                        : `$${item.precioUnitario.toLocaleString('es-AR')} / ${item.unidad}`}
                    </span>
                    <span style={{ fontSize: '0.85rem', color: 'var(--primary)', fontWeight: 700, display: 'block', marginTop: '0.25rem' }}>
                      Subtotal: ${item.subtotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', alignItems: 'flex-end' }}>
                      <input
                        type="number"
                        step={item.unidad === 'g' || item.unidad === 'unidad' ? '1' : '0.001'}
                        className="form-input"
                        style={{ width: '90px', padding: '0.35rem 0.5rem', textAlign: 'center' }}
                        value={item.cantidad}
                        onChange={(e) => updateCartQty(item.productoId, e.target.value)}
                        disabled={cajaCerrada.cerrado}
                      />
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{item.unidad}</span>
                    </div>
                    <button
                      onClick={() => removeFromCart(item.productoId)}
                      className="btn btn-secondary btn-sm"
                      style={{ padding: '0.4rem', border: 'none', color: '#ef4444' }}
                      disabled={cajaCerrada.cerrado}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
              {cart.length === 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, opacity: 0.5 }}>
                  <ShoppingCart size={48} style={{ marginBottom: '1rem' }} />
                  <p>Carrito de compras vacío</p>
                </div>
              )}
            </div>

            {/* Cart checkout Summary */}
            <div className="pos-cart-summary">
              {/* Payment Method */}
              <div className="form-group" style={{ marginBottom: '0.75rem' }}>
                <label className="form-label" style={{ fontSize: '0.8rem' }}>Forma de Pago</label>
                <select
                  className="form-select"
                  style={{ padding: '0.5rem 0.75rem', fontSize: '0.9rem' }}
                  value={formaPago}
                  onChange={(e) => setFormaPago(e.target.value)}
                  disabled={cajaCerrada.cerrado}
                >
                  <option value="Efectivo">💵 Efectivo</option>
                  <option value="Tarjeta">💳 Tarjeta (Crédito/Débito)</option>
                  <option value="Transferencia">📱 Transferencia (Mercado Pago/CBU)</option>
                  <option value="Cuenta Corriente">⚖️ Cuenta Corriente (A cuenta/Fiado)</option>
                </select>
              </div>

              {/* Invoice Type Select */}
              <div className="form-group" style={{ marginBottom: '0.75rem' }}>
                <label className="form-label" style={{ fontSize: '0.8rem' }}>Tipo de Comprobante</label>
                <select
                  className="form-select"
                  style={{ padding: '0.5rem 0.75rem', fontSize: '0.9rem' }}
                  value={tipoComprobanteSeleccionado}
                  onChange={(e) => setTipoComprobanteSeleccionado(e.target.value)}
                  disabled={cajaCerrada.cerrado}
                >
                  <option value="auto">📄 AFIP Fiscal (Automático A/B/C)</option>
                  <option value="Factura A">Factura A</option>
                  <option value="Factura B">Factura B</option>
                  <option value="Factura C">Factura C</option>
                  <option value="Factura X">❌ Ticket X (No Fiscal / Factura X)</option>
                </select>
              </div>

              {requiereDatosFiscales && (
                <div style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '0.75rem', marginBottom: '0.75rem', backgroundColor: 'var(--bg-secondary)' }}>
                  <strong style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.65rem' }}>Datos fiscales del receptor</strong>
                  <div style={{ display: 'grid', gridTemplateColumns: '0.8fr 1.2fr', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <select
                      className="form-select"
                      value={facturacionTipoDoc}
                      onChange={(e) => setFacturacionTipoDoc(e.target.value)}
                      disabled={cajaCerrada.cerrado || tipoComprobanteSeleccionado === 'Factura A'}
                    >
                      <option value="CUIT">CUIT</option>
                      <option value="DNI">DNI</option>
                      <option value="99">Sin identificar</option>
                    </select>
                    <input
                      className="form-input"
                      placeholder={facturacionTipoDoc === 'CUIT' ? 'CUIT sin guiones' : 'Número documento'}
                      value={facturacionNroDoc}
                      onChange={(e) => setFacturacionNroDoc(e.target.value)}
                      disabled={cajaCerrada.cerrado}
                    />
                  </div>
                  <input
                    className="form-input"
                    placeholder="Razón social / Nombre completo"
                    value={facturacionRazonSocial}
                    onChange={(e) => setFacturacionRazonSocial(e.target.value)}
                    disabled={cajaCerrada.cerrado}
                    style={{ marginBottom: '0.5rem' }}
                  />
                  <select
                    className="form-select"
                    value={facturacionCondicionIva}
                    onChange={(e) => setFacturacionCondicionIva(e.target.value)}
                    disabled={cajaCerrada.cerrado || tipoComprobanteSeleccionado === 'Factura A'}
                    style={{ marginBottom: '0.5rem' }}
                  >
                    <option value="Consumidor Final">Consumidor Final</option>
                    <option value="Responsable Inscripto">Responsable Inscripto</option>
                    <option value="Monotributista">Monotributista</option>
                    <option value="Exento">Exento</option>
                  </select>
                  <input
                    className="form-input"
                    placeholder="Dirección fiscal (opcional)"
                    value={facturacionDireccion}
                    onChange={(e) => setFacturacionDireccion(e.target.value)}
                    disabled={cajaCerrada.cerrado}
                    style={{ marginBottom: '0.5rem' }}
                  />
                  <input
                    className="form-input"
                    type="email"
                    placeholder="Email (opcional)"
                    value={facturacionEmail}
                    onChange={(e) => setFacturacionEmail(e.target.value)}
                    disabled={cajaCerrada.cerrado}
                  />
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '0.5rem' }}>
                    Si el documento ya existe, se usa el cliente registrado; si no existe, se crea automáticamente.
                  </p>
                </div>
              )}

              {/* Tax totals */}
              <div style={{ fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.25rem', color: 'var(--text-muted)', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Neto Gravado:</span>
                  <span>${totals.subtotal.toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>IVA Acumulado:</span>
                  <span>${totals.iva.toFixed(2)}</span>
                </div>
              </div>

              {/* Final total */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '0.25rem 0' }}>
                <strong style={{ fontSize: '1.2rem' }}>Total General:</strong>
                <strong style={{ fontSize: '1.5rem', color: 'var(--primary)' }}>
                  ${totals.total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                </strong>
              </div>

              <button
                onClick={handleCheckout}
                className="btn btn-primary btn-lg pos-checkout-button"
                style={{ width: '100%', padding: '0.85rem' }}
                disabled={submitting || cart.length === 0 || cajaCerrada.cerrado}
              >
                {cajaCerrada.cerrado ? 'Caja cerrada por Cierre Z' : submitting ? 'Emitiendo CAE AFIP...' : 'Emitir Factura y Cobrar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CHECKOUT SUCCESS MODAL */}
      {successResult && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ borderColor: 'var(--primary)' }}>
            <div className="modal-header" style={{ backgroundColor: 'var(--primary-light)' }}>
              <h3 style={{ color: 'var(--primary-hover)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <CheckCircle2 size={20} />
                <span>Comprobante Autorizado</span>
              </h3>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ textAlign: 'center', padding: '1rem 0' }}>
                <span className="badge badge-success" style={{ fontSize: '1rem', padding: '0.5rem 1rem' }}>
                  {successResult.tipoComprobante} Nº {successResult.puntoVenta.toString().padStart(4, '0')}-{successResult.numeroComprobante.toString().padStart(8, '0')}
                </span>
                {successResult.estado === 'DEMO' && (
                  <div className="badge badge-warning" style={{ display: 'block', width: 'fit-content', margin: '0.75rem auto 0', fontSize: '0.75rem' }}>
                    ⚠️ DEMO - NO VALIDO FISCALMENTE
                  </div>
                )}
              </div>

              <div style={{ backgroundColor: 'var(--bg-tertiary)', padding: '1rem', borderRadius: 'var(--radius-md)', fontSize: '0.9rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div>Cliente: <strong>{successResult.cliente?.razonSocial || 'Consumidor Final'}</strong></div>
                <div>Forma de Pago: <strong>{successResult.formaPago}</strong></div>
                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '0.5rem', marginTop: '0.5rem' }}>
                  Total Facturado: <strong style={{ color: 'var(--primary)', fontSize: '1.05rem' }}>${parseFloat(successResult.total).toLocaleString('es-AR')}</strong>
                </div>
              </div>

              {successResult.cae && (
                <div style={{ border: '1px dashed var(--border-color)', padding: '1rem', borderRadius: 'var(--radius-md)', fontSize: '0.85rem' }}>
                  <div>🔑 Código CAE: <strong>{successResult.cae}</strong></div>
                  <div>📅 Vencimiento CAE: <strong>{new Date(successResult.caeVencimiento).toLocaleDateString('es-AR')}</strong></div>
                  {successResult.mensajeAfip && (
                    <div style={{ marginTop: '0.5rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                      Respuesta: {successResult.mensajeAfip}
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="modal-footer" style={{ display: 'flex', gap: '0.5rem' }}>
              <a
                href={`/dashboard/ventas/${successResult.id}/print`}
                target="_blank"
                rel="noreferrer"
                className="btn btn-secondary"
                style={{ flex: 1, textAlign: 'center', textDecoration: 'none', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.25rem' }}
              >
                🖨️ Imprimir
              </a>
              <button
                onClick={() => {
                  setSuccessResult(null);
                  setTipoComprobanteSeleccionado('auto'); // Reset selection
                }}
                className="btn btn-primary"
                style={{ flex: 1 }}
              >
                Continuar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ERROR / REJECTION MODAL */}
      {errorMessage && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ borderColor: '#ef4444' }}>
            <div className="modal-header" style={{ backgroundColor: '#fee2e2' }}>
              <h3 style={{ color: '#b91c1c', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <AlertOctagon size={20} />
                <span>Rechazo de Facturación</span>
              </h3>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <p style={{ fontWeight: 500, fontSize: '0.95rem' }}>
                El comprobante no pudo ser autorizado por la siguiente razón:
              </p>
              <div style={{
                padding: '1.25rem',
                backgroundColor: '#fbf5f5',
                color: '#b91c1c',
                border: '1px solid #fee2e2',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.9rem',
                fontFamily: 'monospace',
                whiteSpace: 'pre-wrap'
              }}>
                {errorMessage}
              </div>

              <div style={{
                fontSize: '0.8rem',
                color: 'var(--text-muted)',
                backgroundColor: 'var(--bg-tertiary)',
                padding: '0.85rem',
                borderRadius: 'var(--radius-md)',
                borderLeft: '4px solid #94a3b8'
              }}>
                💡 Tip: Si el error menciona certificados vencidos o problemas de WSAA, dirigite a la sección <strong>Configuración AFIP</strong> para verificar el estado de las credenciales de tu local.
              </div>
            </div>
            <div className="modal-footer">
              <button
                onClick={() => setErrorMessage('')}
                className="btn btn-danger"
                style={{ width: '100%' }}
              >
                Volver a la Caja
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
