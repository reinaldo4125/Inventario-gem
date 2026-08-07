import React, { useEffect, useState } from 'react';

function ClienteSelect({ value, onChange }) {
  const [clientes, setClientes] = useState([]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    fetch('/clientes', {
      headers: {
        'Authorization': token ? `Bearer ${token}` : '',
      },
    })
      .then(res => res.json())
      .then(data => setClientes(Array.isArray(data) ? data : []));
  }, []);

  return (
    <select name="cliente" value={value} onChange={onChange} required>
      <option value="">Seleccione un cliente</option>
      {clientes.map(c => (
        <option key={c.id} value={c.id}>{c.nombre} ({c.tipo_cliente})</option>
      ))}
    </select>
  );
}

export default ClienteSelect;
