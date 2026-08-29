'use client';

import { useState, useEffect, useRef } from 'react';
import { Plus, ArrowUpDown, AlertCircle, Trash2, Pencil, ScanBarcode, Loader2 } from 'lucide-react';
import { playBeepSuccess, playBeepError } from '@/lib/sound';

export default function ProductosPage() {
  const [productos, setProductos] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  
  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);

  // Form states for Add Product
  const [codigo, setCodigo] = useState('');
  const [addAltCodigos, setAddAltCodigos] = useState<string[]>([]);
  const [addAltInput, setAddAltInput] = useState('');
  const [nombre, setNombre] = useState('');
  const [categoria, setCategoria] = useState('');
  const [unidad, setUnidad] = useState('kg');
  const [precioCosto, setPrecioCosto] = useState('');
  const [precioVenta, setPrecioVenta] = useState('');
  const [ivaPorcentaje, setIvaPorcentaje] = useState('21');
  const [stockActual, setStockActual] = useState('');
  const [stockMinimo, setStockMinimo] = useState('');
  const [addError, setAddError] = useState('');
  const [savingAdd, setSavingAdd] = useState(false);

  // Form states for Adjust Stock
  const [tipoAjuste, setTipoAjuste] = useState('compra');
  const [cantidadAjuste, setCantidadAjuste] = useState('');
  const [nuevoPrecioVenta, setNuevoPrecioVenta] = useState('');
  const [nuevoPrecioCosto, setNuevoPrecioCosto] = useState('');
  const [adjustError, setAdjustError] = useState('');

  // Form state for Edit Product
  const [editForm, setEditForm] = useState<any>(null);
  const [editAltInput, setEditAltInput] = useState('');
  const [editError, setEditError] = useState('');

  const [scanBeat, setScanBeat] = useState(0);

  // Product image upload state (blob URL the client uploaded + local preview)
  const [addImagenUrl, setAddImagenUrl] = useState('');
  const [addImagenPreview, setAddImagenPreview] = useState('');
  const [addImagenUploading, setAddImagenUploading] = useState(false);
  const addImagenInputRef = useRef<HTMLInputElement>(null);
  const [editImagenUploading, setEditImagenUploading] = useState(false);
  const editImagenInputRef = useRef<HTMLInputElement>(null);

  // Upload image file to Vercel Blob (direct from browser), returns public URL
  const uploadImageToBlob = async (file: File, productoId: string): Promise<string> => {
    const { upload } = await import('@vercel/blob/client');
    const newBlob = await upload(file.name, file, {
      access: 'public',
      handleUploadUrl: `/api/tenant/productos/imagen?productoId=${productoId}`,
    });
    return newBlob.url;
  };

  // Keep the selected file for later (after product is created with an id)
  const pendingAddImageRef = useRef<File | null>(null);
  const pendingEditImageRef = useRef<File | null>(null);

  const handleAddImageSelection = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    pendingAddImageRef.current = file;
    setAddImagenPreview(URL.createObjectURL(file));
    setAddImagenUrl('');
    if (addImagenInputRef.current) addImagenInputRef.current.value = '';
  };

  const handleEditImageSelection = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    pendingEditImageRef.current = file;
    setEditForm((f: any) => ({ ...f, previewImagenUrl: URL.createObjectURL(file) }));
    if (editImagenInputRef.current) editImagenInputRef.current.value = '';
  };

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

  const addAltCode = (list: string[], setList: (v: string[]) => void, value: string) => {
    const code = value.trim();
    if (!code) return;
    setList([...list, code]);
  };

  const removeAltCode = (list: string[], setList: (v: string[]) => void, code: string) => {
    setList(list.filter((c) => c !== code));
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

  // Barcode scanner: capture HID-style input anywhere and search by code
  const scanBufferRef = useRef('');
  const scanTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const inField =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.tagName === 'SELECT' ||
        target?.isContentEditable;

      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        scanBufferRef.current += e.key;
        if (scanTimerRef.current) clearTimeout(scanTimerRef.current);
        scanTimerRef.current = setTimeout(() => { scanBufferRef.current = ''; }, 80);
        return;
      }

      if (e.key === 'Enter' && scanBufferRef.current.length >= 4 && !inField) {
        e.preventDefault();
        const code = scanBufferRef.current.trim();
        scanBufferRef.current = '';
        setSearch(code);
        setScanBeat((b) => b + 1);
        const found = productos.find((p) =>
          (p.codigo || '').trim() === code ||
          (p.codigos || []).some((c: any) => (c.codigo || '').trim() === code)
        );
        if (found) playBeepSuccess(); else playBeepError();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productos]);

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError('');
    setSavingAdd(true);

    try {
      const res = await fetch('/api/tenant/productos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          codigo,
          codigosAlternativos: addAltCodigos,
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

      // If the user selected an image, upload it now (product already has an id)
      if (pendingAddImageRef.current) {
        setAddImagenUploading(true);
        try {
          const blobUrl = await uploadImageToBlob(pendingAddImageRef.current, data.id);
          pendingAddImageRef.current = null;
          await fetch('/api/tenant/productos', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: data.id, imagenUrl: blobUrl }),
          });
        } finally {
          setAddImagenUploading(false);
        }
      }

      // Reset form
      setCodigo('');
      setAddAltCodigos([]);
      setAddAltInput('');
      setNombre('');
      setCategoria('');
      setUnidad('kg');
      setPrecioCosto('');
      setPrecioVenta('');
      setIvaPorcentaje('21');
      setStockActual('');
      setStockMinimo('');
      setAddImagenUrl('');
      setAddImagenPreview('');
      pendingAddImageRef.current = null;
      
      setShowAddModal(false);
      loadProducts();
    } catch (err: any) {
      setAddError(err.message);
    } finally {
      setSavingAdd(false);
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

  const handleDeleteProduct = async (product: any) => {
    const confirmed = window.confirm(`Vas a eliminar "${product.nombre}" del catálogo. No se verá más en productos ni en el POS. ¿Continuar?`);
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/tenant/productos?id=${product.id}`, {
        method: 'DELETE',
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || 'No se pudo eliminar el producto.');
      }

      loadProducts();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const openAdjustModal = (product: any) => {
    setSelectedProduct(product);
    setNuevoPrecioVenta(product.precioVenta.toString());
    setNuevoPrecioCosto(product.precioCosto.toString());
    setShowAdjustModal(true);
  };

  const openEditModal = (product: any) => {
    setSelectedProduct(product);
    pendingEditImageRef.current = null;
    setEditAltInput('');
    setEditForm({
      codigo: product.codigo,
      codigosAlternativos: (product.codigos || []).map((c: any) => c.codigo),
      nombre: product.nombre,
      categoria: product.categoria,
      unidad: product.unidad,
      precioCosto: product.precioCosto.toString(),
      precioVenta: product.precioVenta.toString(),
      ivaPorcentaje: parseFloat(product.ivaPorcentaje).toString(),
      stockActual: parseFloat(product.stockActual).toString(),
      stockMinimo: parseFloat(product.stockMinimo).toString(),
      imagenUrl: product.imagenUrl || '',
      previewImagenUrl: product.imagenUrl || '',
    });
    setEditError('');
    setShowEditModal(true);
  };

  const handleEditProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setEditError('');

    try {
      const res = await fetch('/api/tenant/productos', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedProduct.id,
          codigo: editForm.codigo,
          codigosAlternativos: editForm.codigosAlternativos || [],
          nombre: editForm.nombre,
          categoria: editForm.categoria,
          unidad: editForm.unidad,
          precioCosto: parseFloat(editForm.precioCosto) || 0,
          precioVenta: parseFloat(editForm.precioVenta) || 0,
          ivaPorcentaje: parseFloat(editForm.ivaPorcentaje) || 21,
          stockActual: parseFloat(editForm.stockActual) || 0,
          stockMinimo: parseFloat(editForm.stockMinimo) || 0,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'No se pudo actualizar el producto.');
      }

      // If the user selected a new image, upload it and update the URL
      if (pendingEditImageRef.current) {
        setEditImagenUploading(true);
        try {
          const blobUrl = await uploadImageToBlob(pendingEditImageRef.current, selectedProduct.id);
          pendingEditImageRef.current = null;
          await fetch('/api/tenant/productos', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: selectedProduct.id, imagenUrl: blobUrl }),
          });
        } finally {
          setEditImagenUploading(false);
        }
      }

      setSelectedProduct(null);
      setShowEditModal(false);
      loadProducts();
    } catch (err: any) {
      setEditError(err.message);
    }
  };

  const filtered = productos.filter((p) => {
    const term = search.toLowerCase();
    const altCodes = (p.codigos || []).map((c: any) => (c.codigo || '').toLowerCase());
    return (
      p.nombre.toLowerCase().includes(term) ||
      p.codigo.toLowerCase().includes(term) ||
      altCodes.some((c: string) => c.includes(term)) ||
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <ScanBarcode size={18} style={{ color: 'var(--primary)', flex: '0 0 auto' }} />
          <input
            type="text"
            className="form-input"
            placeholder="🔍 Buscar o escanear código de barras (nombre, código o categoría)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onClick={() => { setScanBeat(0); }}
            style={scanBeat && search ? { borderColor: productos.find((p) =>
              (p.codigo || '').trim() === search.trim() ||
              (p.codigos || []).some((c: any) => (c.codigo || '').trim() === search.trim())
            ) ? '#22c55e' : '#ef4444' } : undefined}
          />
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <p style={{ color: 'var(--text-muted)' }}>Cargando inventario...</p>
      ) : (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Imagen</th>
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
                    <td>
                      {prod.imagenUrl ? (
                        <img
                          src={prod.imagenUrl}
                          alt={prod.nombre}
                          style={{ width: '44px', height: '44px', objectFit: 'cover', borderRadius: 'var(--radius-sm)', display: 'block' }}
                        />
                      ) : (
                        <div style={{ width: '44px', height: '44px', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                          sin foto
                        </div>
                      )}
                    </td>
                    <td>
                      <code>{prod.codigo}</code>
                      {(prod.codigos && prod.codigos.length > 0) && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.2rem', marginTop: '0.25rem' }}>
                          {prod.codigos.map((c: any) => (
                            <span key={c.id} className="badge badge-secondary" style={{ fontSize: '0.65rem', padding: '0.1rem 0.35rem' }} title={`Código alternativo: ${c.codigo}`}>
                              {c.codigo}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
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
                      <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <button onClick={() => openEditModal(prod)} className="btn btn-secondary btn-sm" style={{ padding: '0.35rem 0.65rem' }}>
                          <Pencil size={14} />
                          <span>Editar</span>
                        </button>
                        <button onClick={() => openAdjustModal(prod)} className="btn btn-secondary btn-sm" style={{ padding: '0.35rem 0.65rem' }}>
                          <ArrowUpDown size={14} />
                          <span>Ajustar Stock / Precios</span>
                        </button>
                        <button onClick={() => handleDeleteProduct(prod)} className="btn btn-secondary btn-sm" style={{ padding: '0.35rem 0.65rem', color: '#b91c1c' }}>
                          <Trash2 size={14} />
                          <span>Eliminar</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={11} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
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

                {/* Image */}
                <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  {addImagenPreview ? (
                    <img src={addImagenPreview} alt="Vista previa" style={{ width: '72px', height: '72px', objectFit: 'cover', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }} />
                  ) : (
                    <div style={{ width: '72px', height: '72px', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.75rem', textAlign: 'center', padding: '0.25rem' }}>
                      Sin imagen
                    </div>
                  )}
                  <div>
                    <label className="form-label" style={{ marginBottom: '0.3rem' }}>Imagen del producto</label>
                    <input
                      ref={addImagenInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      onChange={handleAddImageSelection}
                      className="form-input"
                      style={{ padding: '0.4rem' }}
                    />
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>Subí una foto de referencia para los empleados (opcional).</p>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Código Único (Barcode / Interno)</label>
                    <input type="text" className="form-input" placeholder="Ej: 77912345" value={codigo} onChange={(e) => setCodigo(e.target.value)} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Unidad de Venta</label>
                    <select className="form-select" value={unidad} onChange={(e) => setUnidad(e.target.value)}>
                      <option value="kg">Por Kilogramo (kg)</option>
                      <option value="g">Por gramo (venta fraccionada)</option>
                      <option value="unidad">Por Unidad</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Códigos de barra alternativos</label>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Escanéalo o escribilo acá (mismo producto, otro proveedor)"
                      value={addAltInput}
                      onChange={(e) => setAddAltInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          addAltCode(addAltCodigos, setAddAltCodigos, addAltInput);
                          setAddAltInput('');
                        }
                      }}
                    />
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => {
                        addAltCode(addAltCodigos, setAddAltCodigos, addAltInput);
                        setAddAltInput('');
                      }}
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                  {addAltCodigos.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.5rem' }}>
                      {addAltCodigos.map((c) => (
                        <span key={c} className="badge badge-secondary" style={{ padding: '0.3rem 0.6rem' }}>
                          {c}
                          <button type="button" onClick={() => removeAltCode(addAltCodigos, setAddAltCodigos, c)} style={{ background: 'none', border: 'none', cursor: 'pointer', marginLeft: '0.3rem', color: '#b91c1c', fontSize: '0.8rem' }}>✕</button>
                        </span>
                      ))}
                    </div>
                  )}
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>
                    Opcional. Si el mismo artículo viene de otro proveedor con otro código de barra, agregalo así al escanear cualquiera se identifica este producto.
                  </p>
                </div>

                <div className="form-group">
                  <label className="form-label">Nombre del Producto</label>
                  <input type="text" className="form-input" placeholder="Ej: Nombre del producto" value={nombre} onChange={(e) => setNombre(e.target.value)} required />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Categoría</label>
                    <input type="text" className="form-input" placeholder="Ej: Categoría del producto" value={categoria} onChange={(e) => setCategoria(e.target.value)} />
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
                <button type="button" onClick={() => setShowAddModal(false)} className="btn btn-secondary" disabled={savingAdd}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={savingAdd}>
                  {savingAdd ? <Loader2 size={16} className="spin" /> : <Plus size={16} />}
                  <span>{savingAdd ? 'Creando...' : 'Crear Producto'}</span>
                </button>
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
      {/* MODAL 3: EDIT PRODUCT */}
      {showEditModal && selectedProduct && editForm && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h3>✏️ Editar Producto</h3>
              <button onClick={() => setShowEditModal(false)} className="btn btn-secondary btn-sm" style={{ padding: '0.25rem 0.5rem' }}>✕</button>
            </div>
            <form onSubmit={handleEditProduct}>
              <div className="modal-body">
                {editError && (
                  <div style={{ padding: '0.75rem', backgroundColor: '#fee2e2', color: '#b91c1c', borderRadius: 'var(--radius-sm)', marginBottom: '1rem', fontSize: '0.9rem' }}>
                    ⚠️ {editError}
                  </div>
                )}

                {/* Image */}
                <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  {editForm.previewImagenUrl ? (
                    <img src={editForm.previewImagenUrl} alt="Vista previa" style={{ width: '72px', height: '72px', objectFit: 'cover', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }} />
                  ) : (
                    <div style={{ width: '72px', height: '72px', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.75rem', textAlign: 'center', padding: '0.25rem' }}>
                      Sin imagen
                    </div>
                  )}
                  <div style={{ flex: 1 }}>
                    <label className="form-label" style={{ marginBottom: '0.3rem' }}>Imagen del producto</label>
                    <input
                      ref={editImagenInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      onChange={handleEditImageSelection}
                      className="form-input"
                      style={{ padding: '0.4rem' }}
                    />
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>Seleccioná una imagen nueva para reemplazar la actual (opcional).</p>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Código Único (Barcode / Interno)</label>
                    <input type="text" className="form-input" value={editForm.codigo} onChange={(e) => setEditForm({ ...editForm, codigo: e.target.value })} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Unidad de Venta</label>
                    <select className="form-select" value={editForm.unidad} onChange={(e) => setEditForm({ ...editForm, unidad: e.target.value })}>
                      <option value="kg">Por Kilogramo (kg)</option>
                      <option value="g">Por gramo (venta fraccionada)</option>
                      <option value="unidad">Por Unidad</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Códigos de barra alternativos</label>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Escanéalo o escribilo acá (mismo producto, otro proveedor)"
                      value={editAltInput}
                      onChange={(e) => setEditAltInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          const current = editForm.codigosAlternativos || [];
                          const code = editAltInput.trim();
                          if (code) setEditForm({ ...editForm, codigosAlternativos: [...current, code] });
                          setEditAltInput('');
                        }
                      }}
                    />
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => {
                        const current = editForm.codigosAlternativos || [];
                        const code = editAltInput.trim();
                        if (code) setEditForm({ ...editForm, codigosAlternativos: [...current, code] });
                        setEditAltInput('');
                      }}
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                  {((editForm.codigosAlternativos || []).length > 0) && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.5rem' }}>
                      {(editForm.codigosAlternativos || []).map((c: string) => (
                        <span key={c} className="badge badge-secondary" style={{ padding: '0.3rem 0.6rem' }}>
                          {c}
                          <button
                            type="button"
                            onClick={() => setEditForm({ ...editForm, codigosAlternativos: (editForm.codigosAlternativos || []).filter((x: string) => x !== c) })}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', marginLeft: '0.3rem', color: '#b91c1c', fontSize: '0.8rem' }}
                          >✕</button>
                        </span>
                      ))}
                    </div>
                  )}
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>
                    Si el mismo artículo viene de otro proveedor con otro código de barra, agregalo así al escanear cualquiera se identifica este producto.
                  </p>
                </div>

                <div className="form-group">
                  <label className="form-label">Nombre del Producto</label>
                  <input type="text" className="form-input" value={editForm.nombre} onChange={(e) => setEditForm({ ...editForm, nombre: e.target.value })} required />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Categoría</label>
                    <input type="text" className="form-input" value={editForm.categoria} onChange={(e) => setEditForm({ ...editForm, categoria: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Alícuota IVA (%)</label>
                    <select className="form-select" value={editForm.ivaPorcentaje} onChange={(e) => setEditForm({ ...editForm, ivaPorcentaje: e.target.value })}>
                      <option value="21">21.0% (Tasa Estándar)</option>
                      <option value="10.5">10.5% (Tasa Reducida)</option>
                      <option value="0">0.0% (Exento)</option>
                    </select>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Precio de Costo ($)</label>
                    <input type="number" step="0.01" className="form-input" value={editForm.precioCosto} onChange={(e) => setEditForm({ ...editForm, precioCosto: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">{editForm.unidad === 'g' ? 'Precio de Venta por kg (Con IVA) ($)' : 'Precio de Venta (Con IVA) ($)'}</label>
                    <input type="number" step="0.01" className="form-input" value={editForm.precioVenta} onChange={(e) => setEditForm({ ...editForm, precioVenta: e.target.value })} required />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Stock Actual {editForm.unidad === 'g' ? '(en gramos)' : editForm.unidad === 'kg' ? '(en kg)' : '(en unidades)'}</label>
                    <input type="number" step="0.001" className="form-input" value={editForm.stockActual} onChange={(e) => setEditForm({ ...editForm, stockActual: e.target.value })} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Stock Mínimo {editForm.unidad === 'g' ? '(en gramos)' : editForm.unidad === 'kg' ? '(en kg)' : '(en unidades)'}</label>
                    <input type="number" step="0.001" className="form-input" value={editForm.stockMinimo} onChange={(e) => setEditForm({ ...editForm, stockMinimo: e.target.value })} required />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" onClick={() => setShowEditModal(false)} className="btn btn-secondary">Cancelar</button>
                <button type="submit" className="btn btn-primary">Guardar Cambios</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
