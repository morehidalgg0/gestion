'use client';

import { useState, useEffect } from 'react';
import { Package, Plus, Pencil, ArrowUpDown, AlertCircle } from 'lucide-react';

export default function ProductosPage() {
  const [productos, setProductos] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  
  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);

  // Form states for Add Product
  const [codigo, setCodigo] = useState('');
  const [nombre, setNombre] = useState('');
  const [categoria, setCategoria] = useState('');
  const [unidad, setUnidad] = useState('kg');
  const [precioCosto, setPrecioCosto] = useState('');
  const [precioVenta, setPrecioVenta] = useState('');
  const [ivaPorcentaje, setIvaPorcentaje] = useState('21');
  const [stockActual, setStockActual] = useState('');
  const [stockMinimo, setStockMinimo] = useState('');
  const [addError, setAddError] = useState('');

  // Form states for Adjust Stock
  const [tipoAjuste, setTipoAjuste] = useState('compra');
  const [cantidadAjuste, setCantidadAjuste] = useState('');
  const [nuevoPrecioVenta, setNuevoPrecioVenta] = useState('');
  const [nuevoPrecioCosto, setNuevoPrecioCosto] = useState('');
  const [adjustError, setAdjustError] = useState('');

  const loadProducts = async () => {
    try {
      const res = await fetch('/api/tenant/productos');
      const data = await res.json();
      setProductos(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load products:', err);
    } finally {
      setLoading(false);
    }
  };

  const getPriceLabel = (product: any) => {
    const price = parseFloat(product.precioVenta).toLocaleString('es-AR');
    if (product.unidad === 'g') return `$${price} / kg`;
    if (product.unidad === 'kg') return `$${price} / kg`;
    return `$${price} / unidad`;
  };

  useEffect(() => {
    loadProducts();
  }, []);

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError('');

    try {
      const res = await fetch('/api/tenant/productos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          codigo,
          nombre,
          categoria,
          unidad,
          precioCosto: parseFloat(precioCosto) || 0,
          precioVenta: parseFloat(precioVenta) || 0,
          ivaPorcentaje: parseFloat(ivaPorcentaje) || 21,
          stockActual: parseFloat(stockActual) || 0,
          stockMinimo: parseFloat(stockMinimo) || 0,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'No se pudo crear el producto.');
      }

      // Reset form
      setCodigo('');
      setNombre('');
      setCategoria('');
      setUnidad('kg');
      setPrecioCosto('');
      setPrecioVenta('');
      setIvaPorcentaje('21');
      setStockActual('');
      setStockMinimo('');
      
      setShowAddModal(false);
      loadProducts();
    } catch (err: any) {
      setAddError(err.message);
    }
  };

  const handleAdjustStock = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdjustError('');

    try {
      const res = await fetch('/api/tenant/productos', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedProduct.id,
          tipoAjuste,
          cantidad: parseFloat(cantidadAjuste) || 0,
          precioVenta: nuevoPrecioVenta ? parseFloat(nuevoPrecioVenta) : undefined,
          precioCosto: nuevoPrecioCosto ? parseFloat(nuevoPrecioCosto) : undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'No se pudo registrar el ajuste.');
      }

      setCantidadAjuste('');
      setNuevoPrecioCosto('');
      setNuevoPrecioVenta('');
      setSelectedProduct(null);
      setShowAdjustModal(false);
      loadProducts();
    } catch (err: any) {
      setAdjustError(err.message);
    }
  };

  const openAdjustModal = (product: any) => {
    setSelectedProduct(product);
    setNuevoPrecioVenta(product.precioVenta.toString());
    setNuevoPrecioCosto(product.precioCosto.toString());
    setShowAdjustModal(true);
  };

  const filtered = productos.filter((p) => {
    const term = search.toLowerCase();
    return (
      p.nombre.toLowerCase().includes(term) ||
      p.codigo.toLowerCase().includes(term) ||
      p.categoria.toLowerCase().includes(term)
    );
  });

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h2 style={{ fontSize: '1.75rem', marginBottom: '0.25rem' }}>Control de Productos e Inventario</h2>
          <p style={{ color: 'var(--text-muted)' }}>Gestioná tus productos, precios y niveles de stock.</p>
        </div>
        <button onClick={() => setShowAddModal(true)} className="btn btn-primary">
          <Plus size={16} />
          <span>Nuevo Producto</span>
        </button>
      </div>

      {/* Search and Filters */}
      <div className="card" style={{ marginBottom: '1.5rem', padding: '1rem' }}>
        <input
          type="text"
          className="form-input"
          placeholder="🔍 Buscar por nombre, código o categoría..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Table */}
      {loading ? (
        <p style={{ color: 'var(--text-muted)' }}>Cargando inventario...</p>
      ) : (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Código</th>
                <th>Nombre</th>
                <th>Categoría</th>
                <th>Unidad</th>
                <th>Costo</th>
                <th>Venta (Final)</th>
                <th>% IVA</th>
                <th>Stock</th>
                <th>Estado</th>
                <th style={{ textAlign: 'center' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((prod) => {
                const stock = parseFloat(prod.stockActual);
                const min = parseFloat(prod.stockMinimo);
                const isUnderMin = stock <= min;

                return (
                  <tr key={prod.id} style={{ backgroundColor: isUnderMin ? '#fffefc' : undefined }}>
                    <td><code>{prod.codigo}</code></td>
                    <td style={{ fontWeight: 600 }}>{prod.nombre}</td>
                    <td><span className="badge badge-secondary" style={{ backgroundColor: 'var(--bg-tertiary)' }}>{prod.categoria}</span></td>
                    <td>{prod.unidad}</td>
                    <td style={{ color: 'var(--text-muted)' }}>${parseFloat(prod.precioCosto).toLocaleString('es-AR')}</td>
                    <td style={{ fontWeight: 600 }}>{getPriceLabel(prod)}</td>
                    <td>{parseFloat(prod.ivaPorcentaje)}%</td>
                    <td style={{ fontWeight: 600, color: isUnderMin ? '#ef4444' : 'inherit' }}>
                      {stock.toFixed(3).replace(/\.?0+$/, '')}
                    </td>
                    <td>
                      {isUnderMin ? (
                        <span className="badge badge-danger" style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', width: 'fit-content' }}>
                          <AlertCircle size={12} />
                          <span>Bajo Mínimo</span>
                        </span>
                      ) : (
                        <span className="badge badge-success">Suficiente</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button onClick={() => openAdjustModal(prod)} className="btn btn-secondary btn-sm" style={{ padding: '0.35rem 0.65rem' }}>
                        <ArrowUpDown size={14} />
                        <span>Ajustar Stock / Precios</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={10} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                    No se encontraron productos en el catálogo.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* MODAL 1: ADD PRODUCT */}
      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h3>📦 Crear Nuevo Producto</h3>
              <button onClick={() => setShowAddModal(false)} className="btn btn-secondary btn-sm" style={{ padding: '0.25rem 0.5rem' }}>✕</button>
            </div>
            <form onSubmit={handleAddProduct}>
              <div className="modal-body">
                {addError && (
                  <div style={{ padding: '0.75rem', backgroundColor: '#fee2e2', color: '#b91c1c', borderRadius: 'var(--radius-sm)', marginBottom: '1rem', fontSize: '0.9rem' }}>
                    ⚠️ {addError}
                  </div>
                )}

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Código Único (Barcode / Interno)</label>
                    <input type="text" className="form-input" placeholder="Ej: 77912345" value={codigo} onChange={(e) => setCodigo(e.target.value)} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Unidad de Venta</label>
                    <select className="form-select" value={unidad} onChange={(e) => setUnidad(e.target.value)}>
                      <option value="kg">Por Kilogramo (kg)</option>
                      <option value="g">Por kilogramo, venta fraccionada en gramos</option>
                      <option value="unidad">Por Unidad</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Nombre del Producto</label>
                  <input type="text" className="form-input" placeholder="Ej: Mix de Frutos Secos Premium" value={nombre} onChange={(e) => setNombre(e.target.value)} required />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Categoría</label>
                    <input type="text" className="form-input" placeholder="Ej: Frutos Secos" value={categoria} onChange={(e) => setCategoria(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Alícuota IVA (%)</label>
                    <select className="form-select" value={ivaPorcentaje} onChange={(e) => setIvaPorcentaje(e.target.value)}>
                      <option value="21">21.0% (Tasa Estándar)</option>
                      <option value="10.5">10.5% (Tasa Reducida)</option>
                      <option value="0">0.0% (Exento)</option>
                    </select>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Precio de Costo ($)</label>
                    <input type="number" step="0.01" className="form-input" placeholder="0.00" value={precioCosto} onChange={(e) => setPrecioCosto(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">{unidad === 'g' ? 'Precio de Venta por kg (Con IVA) ($)' : 'Precio de Venta (Con IVA) ($)'}</label>
                    <input type="number" step="0.01" className="form-input" placeholder="0.00" value={precioVenta} onChange={(e) => setPrecioVenta(e.target.value)} required />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Stock Inicial {unidad === 'g' ? '(en gramos)' : unidad === 'kg' ? '(en kg)' : '(en unidades)'}</label>
                    <input type="number" step="0.001" className="form-input" placeholder="0" value={stockActual} onChange={(e) => setStockActual(e.target.value)} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Stock Mínimo {unidad === 'g' ? '(en gramos)' : unidad === 'kg' ? '(en kg)' : '(en unidades)'}</label>
                    <input type="number" step="0.001" className="form-input" placeholder="0" value={stockMinimo} onChange={(e) => setStockMinimo(e.target.value)} required />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" onClick={() => setShowAddModal(false)} className="btn btn-secondary">Cancelar</button>
                <button type="submit" className="btn btn-primary">Crear Producto</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: ADJUST STOCK / PRICES */}
      {showAdjustModal && selectedProduct && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>🔄 Ajustar Stock y Precios</h3>
              <button onClick={() => setShowAdjustModal(false)} className="btn btn-secondary btn-sm" style={{ padding: '0.25rem 0.5rem' }}>✕</button>
            </div>
            <form onSubmit={handleAdjustStock}>
              <div className="modal-body">
                <p style={{ marginBottom: '1rem', fontSize: '0.95rem' }}>
                  Ajustando: <strong>{selectedProduct.nombre}</strong> (Stock actual: {parseFloat(selectedProduct.stockActual).toFixed(3).replace(/\.?0+$/, '')} {selectedProduct.unidad})
                </p>

                {adjustError && (
                  <div style={{ padding: '0.75rem', backgroundColor: '#fee2e2', color: '#b91c1c', borderRadius: 'var(--radius-sm)', marginBottom: '1rem', fontSize: '0.9rem' }}>
                    ⚠️ {adjustError}
                  </div>
                )}

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Tipo de Movimiento</label>
                    <select className="form-select" value={tipoAjuste} onChange={(e) => setTipoAjuste(e.target.value)}>
                      <option value="compra">Ingreso por Compra (+)</option>
                      <option value="merma">Merma / Desperdicio (-)</option>
                      <option value="ajuste">Re-calibración (Setear Stock Fijo)</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Cantidad ({selectedProduct.unidad})</label>
                    <input type="number" step="0.001" className="form-input" placeholder="0" value={cantidadAjuste} onChange={(e) => setCantidadAjuste(e.target.value)} required />
                  </div>
                </div>

                <div className="form-row" style={{ marginTop: '0.5rem' }}>
                  <div className="form-group">
                    <label className="form-label">Actualizar Costo ($)</label>
                    <input type="number" step="0.01" className="form-input" value={nuevoPrecioCosto} onChange={(e) => setNuevoPrecioCosto(e.target.value)} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">{selectedProduct.unidad === 'g' ? 'Actualizar Venta por kg (IVA Incl) ($)' : 'Actualizar Venta (IVA Incl) ($)'}</label>
                    <input type="number" step="0.01" className="form-input" value={nuevoPrecioVenta} onChange={(e) => setNuevoPrecioVenta(e.target.value)} required />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" onClick={() => setShowAdjustModal(false)} className="btn btn-secondary">Cancelar</button>
                <button type="submit" className="btn btn-primary">Guardar Ajuste</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
