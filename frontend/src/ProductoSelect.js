import React, { useEffect, useState } from 'react';
import { formatCurrency } from './utils/formatters';

function ProductoSelect({ value, onChange, tipoCliente }) {
  const [productos, setProductos] = useState([]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    fetch('/productos', {
      headers: {
        'Authorization': token ? `Bearer ${token}` : '',
      },
    })
      .then(res => res.json())
      .then(data => setProductos(Array.isArray(data) ? data : []));
  }, []);

  return (
    <select name="productoId" value={value} onChange={onChange} required>
      <option value="">Seleccione un producto</option>
      {productos.map(p => {
  let precio = p.precio;
        if (tipoCliente === 'Detal' && p.precio_detal) precio = p.precio_detal;
        if (tipoCliente === 'Mayor' && p.precio_mayor) precio = p.precio_mayor;
        if (tipoCliente === 'Almacén' && p.precio_almacen) precio = p.precio_almacen;
        const precioFormateado = formatCurrency(precio);
        return (
          <option key={p.id} value={p.id}>
            {p.nombre} - {precioFormateado}
          </option>
        );
      })}
    </select>
  );
}

export default ProductoSelect;
