
import React, { useState, useEffect } from 'react';
import { parsePrecio, formatCurrency } from './utils/formatters';
import FieldError from './components/FieldError';

// Utilidad para formatear fecha a 'YYYY-MM-DD'
function toYYYYMMDD(date) {
  if (!date) return '';
  if (typeof date === 'string' && date.length >= 10) return date.slice(0, 10);
  const d = new Date(date);
  return d.toISOString().slice(0, 10);
}

function VentaNueva({ onVentaGuardada }) {
  const [almacenes, setAlmacenes] = useState([]);
  const [almacenesSeleccionados, setAlmacenesSeleccionados] = useState({});
  const usuario = JSON.parse(localStorage.getItem('usuario') || '{}');
  useEffect(() => {
    if (usuario.rol === 'admin') {
      fetch('/almacenes', { headers: { 'Authorization': localStorage.getItem('token') ? `Bearer ${localStorage.getItem('token')}` : '' } })
        .then(res => res.json())
        .then(setAlmacenes);
    }
  }, [usuario.rol]);
  const [clientes, setClientes] = useState([]);
  const [productos, setProductos] = useState([]);
  const [cliente, setCliente] = useState('');
  const [clienteObj, setClienteObj] = useState(null);
  const [productoId, setProductoId] = useState('');
  const [cantidad, setCantidad] = useState(1);
  const [precio, setPrecio] = useState(0);
  const [carrito, setCarrito] = useState([]);
  const [fecha, setFecha] = useState(() => toYYYYMMDD(new Date()));
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});

useEffect(() => {
  fetch('/clientes', { headers: { 'Authorization': localStorage.getItem('token') ? `Bearer ${localStorage.getItem('token')}` : '' } })
    .then(res => res.json())
    .then(data => {
      const usuario = JSON.parse(localStorage.getItem('usuario') || '{}');
      if (usuario.rol === 'vendedor' && usuario.almacenId) {
        const filtrados = data.filter(c => c.almacenId === usuario.almacenId);
        setClientes(filtrados);
      } else {
        setClientes(data);
      }
    });
  fetch('/productos', { headers: { 'Authorization': localStorage.getItem('token') ? `Bearer ${localStorage.getItem('token')}` : '' } })
    .then(res => res.json())
    .then(data => {
      const usuario = JSON.parse(localStorage.getItem('usuario') || '{}');
      if (usuario.rol === 'vendedor' && usuario.almacenId) {
        data.forEach(p => {
          if (Array.isArray(p.almacenes)) {
            const alm = p.almacenes.find(a => Number(a.id) === Number(usuario.almacenId));
            p.stock = alm ? Number(alm.stock || 0) : 0;
          }
        });
        setProductos(data);
      } else {
        setProductos(data);
      }
    });
}, []);

  const agregarProducto = () => {
    setError('');
    if (!productoId) {
      setError('Selecciona un producto');
      return;
    }
    const prod = productos.find(p => p.id === Number(productoId));
    if (!prod) return;

    const esServicio = prod.tipo === 'servicio' || (prod.categoria && prod.categoria.toLowerCase().includes('servicio'));
    const stockDisp = Number(prod.stock || 0);

    if (!esServicio && stockDisp <= 0) {
      setError(`❌ No hay stock disponible para "${prod.nombre}" en tu almacén. Stock actual: 0`);
      return;
    }

    const enCarrito = carrito.find(item => item.id === prod.id);
    const cantSolicitada = Number(cantidad) || 1;
    const cantEnCarrito = enCarrito ? Number(enCarrito.cantidad) : 0;

    if (!esServicio && (cantEnCarrito + cantSolicitada > stockDisp)) {
      setError(`❌ No hay suficiente stock para "${prod.nombre}". Stock disponible: ${stockDisp}, en carrito: ${cantEnCarrito}, intentas agregar: ${cantSolicitada}`);
      return;
    }

    // Seleccionar precio según tipo de cliente
    let precioSel = prod.precio;
    if (clienteObj && clienteObj.tipo_cliente) {
      if (clienteObj.tipo_cliente === 'Mayor') precioSel = prod.precio_mayor;
      else if (clienteObj.tipo_cliente === 'Detal') precioSel = prod.precio_detal;
      else if (clienteObj.tipo_cliente === 'Almacén') precioSel = prod.precio_almacen;
    }
    const precioFinal = precio !== 0 && precio !== '' ? parsePrecio(precio) : parsePrecio(precioSel);
    if (!precioFinal || precioFinal <= 0.01) {
      setError('Precio inválido para el producto seleccionado');
      return;
    }

    setCarrito(prev => {
      const idx = prev.findIndex(item => item.id === prod.id);
      if (idx >= 0) {
        const nuevo = [...prev];
        nuevo[idx].cantidad += cantSolicitada;
        return nuevo;
      }
      return [...prev, { ...prod, cantidad: cantSolicitada, precio: precioFinal }];
    });
    setProductoId('');
    setCantidad(1);
    setPrecio(0);
  };

  const quitarProducto = id => {
    setCarrito(prev => prev.filter(p => p.id !== id));
  };

  const cambiarCantidad = (id, nuevaCantidad) => {
    const prod = productos.find(p => p.id === id);
    if (!prod) return;
    const esServicio = prod.tipo === 'servicio' || (prod.categoria && prod.categoria.toLowerCase().includes('servicio'));
    const stockDisp = Number(prod.stock || 0);

    if (!esServicio && Number(nuevaCantidad) > stockDisp) {
      setError(`❌ No hay suficiente stock para "${prod.nombre}". Stock disponible: ${stockDisp}`);
      setCarrito(prev => prev.map(p => p.id === id ? { ...p, cantidad: stockDisp } : p));
      return;
    }
    setError('');
    setCarrito(prev => prev.map(p => p.id === id ? { ...p, cantidad: Math.max(1, Number(nuevaCantidad) || 1) } : p));
  };

  const subtotal = carrito.reduce((sum, p) => sum + (parsePrecio(p.precio) || 0) * (Number(p.cantidad) || 0), 0);
  const impuestos = 0;
  const total = subtotal + impuestos;

  const handleSubmit = async e => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setFieldErrors({});
    if (!clienteObj) {
      setFieldErrors({ cliente: 'Selecciona un cliente' });
      return setError('Selecciona un cliente');
    }
    if (carrito.length === 0) {
      setFieldErrors(f => ({ ...f, carrito: 'El carrito está vacío' }));
      return setError('Agrega al menos un producto al carrito');
    }

    // Validar stock de todos los items antes de enviar
    for (const p of carrito) {
      const esServ = p.tipo === 'servicio' || (p.categoria && p.categoria.toLowerCase().includes('servicio'));
      const stockDisp = Number(p.stock || 0);
      if (!esServ) {
        if (stockDisp <= 0) {
          setError(`❌ No se puede procesar la venta. El producto "${p.nombre}" no tiene stock disponible.`);
          return;
        }
        if (Number(p.cantidad) > stockDisp) {
          setError(`❌ No hay suficiente stock para "${p.nombre}". Stock disponible: ${stockDisp}, solicitado: ${p.cantidad}`);
          return;
        }
      }
    }

    const invalidPrecio = carrito.some(p => !(parsePrecio(p.precio) && parsePrecio(p.precio) > 0.01));
    if (invalidPrecio) {
      setFieldErrors(f => ({ ...f, carrito: 'Hay productos con precio inválido en el carrito' }));
      return setError('Hay productos con precio inválido en el carrito');
    }
    setLoading(true);
    try {
      const usuario = JSON.parse(localStorage.getItem('usuario') || '{}');
      const venta = {
        cliente: clienteObj.nombre,
        total: carrito.reduce((sum, p) => sum + (parsePrecio(p.precio) || 0) * (Number(p.cantidad) || 0), 0),
        detalles: carrito.map(p => ({ productoId: p.id, cantidad: p.cantidad, precio: parsePrecio(p.precio) || 0 })),
        metodoPago: 'Efectivo',
        fecha
      };
      // Si es admin, enviar almacenesSeleccionados
      if (usuario.rol === 'admin') {
        venta.almacenesSeleccionados = almacenesSeleccionados;
      }
      const token = localStorage.getItem('token');
      const res = await fetch('/ventas', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify(venta)
      });
      if (!res.ok) {
        let msg = 'No se pudo guardar la venta';
        try {
          const text = await res.text();
          let data;
          try {
            data = JSON.parse(text);
          } catch (e) {
            data = null;
          }
          console.error('Respuesta error backend:', data || text);
          if (data && data.error) {
            msg = data.error;
          } else if (data) {
            msg = JSON.stringify(data);
          } else if (text) {
            msg = text;
          }
        } catch (e) {
          console.error('Error parseando respuesta backend:', e);
        }
        setError(msg);
        alert(msg);
        setLoading(false);
        return;
      }
      // Leer respuesta del backend (ahora devuelve la venta completa)
      let data = null;
      try {
        data = await res.json();
      } catch (e) {
        console.error('No se pudo parsear respuesta OK:', e);
      }
      const ventaCreada = data && (data.venta || (data.ventaId ? { id: data.ventaId } : null));
      setSuccess(ventaCreada ? `Venta registrada (ID: ${ventaCreada.id})` : 'Venta registrada');
      setCarrito([]);
      setCliente('');
      setFecha(toYYYYMMDD(new Date()));
      const detalleVenta = ventaCreada || data;
      if (onVentaGuardada) onVentaGuardada(detalleVenta || data);
      try {
        window.dispatchEvent(new CustomEvent('venta:guardada', { detail: detalleVenta }));
      } catch (e) {
        // no crítico si fallan eventos en entornos antiguos
      }
    } catch (err) {
      setError('No se pudo guardar la venta');
    }
      setLoading(false);
    };

  return (
    <div style={{maxWidth:800,margin:'0 auto',padding:24}}>
      {error && (
        <div style={{color:'red',fontWeight:'bold',marginBottom:16,fontSize:18}}>{error}</div>
      )}
      <form className="usuarios-form" onSubmit={handleSubmit} style={{marginBottom:24,display:'grid',gridTemplateColumns:'1fr 100px 140px 120px',gap:'12px 12px',alignItems:'center',background:'#f9f9f9',padding:16,borderRadius:8}}>
        <div className="form-field">
          <label htmlFor="producto-select">Producto</label>
          <select
            id="producto-select"
            value={productoId}
            onChange={e => {
              const val = e.target.value;
              setProductoId(val);
              setError('');
              if (val) {
                const selected = productos.find(p => p.id === Number(val));
                if (selected) {
                  const esServ = selected.tipo === 'servicio' || (selected.categoria && selected.categoria.toLowerCase().includes('servicio'));
                  const stockDisp = Number(selected.stock || 0);
                  if (!esServ && stockDisp <= 0) {
                    setError(`❌ No hay stock disponible para "${selected.nombre}" en este almacén. (Stock actual: 0)`);
                  }
                }
              }
            }}
            className="input"
          >
            <option value=''>Selecciona producto</option>
            {productos.map(p=>(
              <option key={p.id} value={p.id}>{p.nombre} (Stock: {p.stock ?? 0})</option>
            ))}
          </select>
          {fieldErrors.producto && <FieldError>{fieldErrors.producto}</FieldError>}
        </div>

        <div className="form-field">
          <label htmlFor="cantidad-input">Cantidad</label>
          <input
            id="cantidad-input"
            type="number"
            min={1}
            value={cantidad}
            onChange={e => {
              let val = Number(e.target.value);
              const prod = productos.find(p => p.id === Number(productoId));
              if (prod) {
                const esServ = prod.tipo === 'servicio' || (prod.categoria && prod.categoria.toLowerCase().includes('servicio'));
                const stockDisp = Number(prod.stock || 0);
                if (!esServ && val > stockDisp) {
                  setError(`❌ No hay suficiente stock para "${prod.nombre}". Stock disponible: ${stockDisp}`);
                } else {
                  setError('');
                }
              }
              setCantidad(val);
              setFieldErrors(f => ({ ...f, cantidad: undefined }));
            }}
            className="input"
            placeholder="Cantidad"
            aria-invalid={!!fieldErrors.cantidad}
          />
        </div>

        <div className="form-field">
          <label>Almacén</label>
          {usuario.rol === 'admin' && productoId ? (
            <select
              value={almacenesSeleccionados[productoId] || ''}
              onChange={e => setAlmacenesSeleccionados(a => ({ ...a, [productoId]: Number(e.target.value) }))}
              className="input"
            >
              <option value=''>Selecciona almacén</option>
              {almacenes.map(a => (
                <option key={a.id} value={a.id}>{a.nombre}</option>
              ))}
            </select>
          ) : (
            <div style={{height:36}} />
          )}
        </div>

        <div className="form-field">
          <label htmlFor="precio-input">Precio</label>
          <input id="precio-input" type="text" value={precio} onChange={e=>setPrecio(e.target.value)} className="input" placeholder="Precio" />
          {fieldErrors.precio && <FieldError>{fieldErrors.precio}</FieldError>}
        </div>

        <div style={{gridColumn:'1 / -1',display:'flex',justifyContent:'flex-start',gap:8,marginTop:6}}>
          <button
            type="button"
            className="btn-principal"
            onClick={agregarProducto}
            style={{height:36}}
            disabled={!productoId || cantidad < 1}
          >Agregar</button>
        </div>
      </form>
      {carrito.length > 0 ? (
        <>
          <table style={{width:'100%',marginTop:16,background:'#fff',borderRadius:8}}>
            <thead>
              <tr>
                <th>Producto</th>
                <th>Cantidad</th>
                <th>Precio</th>
                <th>Subtotal</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {carrito.map(p=>(
                <tr key={p.id}>
                  <td>{p.nombre}</td>
                  <td>
                    <input type="number" min={1} max={(() => {
                      const prod = productos.find(prod => prod.id === p.id);
                      return prod ? prod.stock : 1;
                    })()} value={p.cantidad} onChange={e=>cambiarCantidad(p.id, Number(e.target.value))} style={{width:60}} />
                  </td>
                  <td>{formatCurrency(p.precio)}</td>
                    <td>{formatCurrency(p.precio * p.cantidad)}</td>
                  <td><button className="btn-peligro" onClick={()=>quitarProducto(p.id)}>Quitar</button></td>
                  {/* Selector de almacén solo para admin */}
                  {(() => {
                    const usuario = JSON.parse(localStorage.getItem('usuario') || '{}');
                    if (usuario.rol === 'admin') {
                      return (
                        <td>
                          <select
                            value={almacenesSeleccionados[p.id] || ''}
                            onChange={e => setAlmacenesSeleccionados(a => ({ ...a, [p.id]: e.target.value }))}
                          >
                            <option value=''>Elige almacén</option>
                            {almacenes.map(a => (
                              <option key={a.id} value={a.id}>{a.nombre}</option>
                            ))}
                          </select>
                        </td>
                      );
                    }
                    return null;
                  })()}
                </tr>
              ))}
            </tbody>
          </table>
          {error && <div style={{color:'red',fontWeight:'bold',marginTop:8}} role="alert" aria-live="polite">{error}</div>}
        </>
      ) : (
        error && <div style={{color:'red',fontWeight:'bold',marginTop:8}} role="alert" aria-live="polite">{error}</div>
      )}
      <div style={{marginTop:16,display:'flex',justifyContent:'flex-end',gap:32,alignItems:'center'}}>
        <div>
          <div>Subtotal: <b>{formatCurrency(subtotal)}</b></div>
          {/* Impuestos: el cálculo puede mostrarse si aplica */}
          <div style={{fontSize:18}}>Total: <b>{formatCurrency(total)}</b></div>
        </div>
        <button type="button" onClick={handleSubmit} className="btn-principal" style={{fontSize:16,padding:'8px 32px'}} disabled={loading || carrito.length===0 || !!error || Object.keys(fieldErrors).some(k=>fieldErrors[k])} aria-disabled={loading || carrito.length===0 || !!error} aria-busy={loading}>Registrar venta</button>
      </div>
    </div>
  );

export default VentaNueva;
