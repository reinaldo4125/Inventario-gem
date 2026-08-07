import React, { useEffect, useState, useContext } from 'react';
import './multinyectores.css';
import FieldError from './components/FieldError';
import { AuthContext } from './AuthContext';

function ProductoCostosAdmin() {
  const { user } = useContext(AuthContext);
  const [items, setItems] = useState([]);
  const [productoId, setProductoId] = useState('');
  const [almacenId, setAlmacenId] = useState('');
  const [costo, setCosto] = useState('');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');

  useEffect(() => {
    fetchItems();
  }, []);

  function fetchItems() {
    const token = localStorage.getItem('token');
    fetch('/api/producto-costos', { headers: { 'Authorization': token ? `Bearer ${token}` : '' } })
      .then(r => {
        if (r.status === 403) throw { code: 403 };
        return r.json();
      })
      .then(data => setItems(Array.isArray(data) ? data : []))
      .catch(err => {
        if (err && err.code === 403) {
          setItems([]);
          return;
        }
        setItems([]);
      });
  }

  function handleCreate(e) {
    e.preventDefault();
    const token = localStorage.getItem('token');
    fetch('/api/producto-costos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': token ? `Bearer ${token}` : '' },
      body: JSON.stringify({ productoId, almacenId: almacenId || null, costo, fecha_inicio: fechaInicio, fecha_fin: fechaFin || null })
    }).then(res => res.json()).then(() => { fetchItems(); setProductoId(''); setAlmacenId(''); setCosto(''); setFechaInicio(''); setFechaFin(''); });
  }

  function handleDelete(id) {
    const token = localStorage.getItem('token');
    fetch('/api/producto-costos/' + id, { method: 'DELETE', headers: { 'Authorization': token ? `Bearer ${token}` : '' } })
      .then(() => fetchItems());
  }

  return (
    <div className="card">
      <h3>Administrar costos por producto</h3>
      {user?.rol !== 'admin' && (
        <div className="alert alert-warning">No autorizado: sólo administradores pueden ver este panel.</div>
      )}
      {user?.rol === 'admin' && (
      <form onSubmit={handleCreate} style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:8}}>
        <input placeholder="productoId" value={productoId} onChange={e=>setProductoId(e.target.value)} required />
        <input placeholder="almacenId (opcional)" value={almacenId} onChange={e=>setAlmacenId(e.target.value)} />
        <input placeholder="costo" value={costo} onChange={e=>setCosto(e.target.value)} required />
        <input type="date" placeholder="fecha inicio" value={fechaInicio} onChange={e=>setFechaInicio(e.target.value)} required />
        <input type="date" placeholder="fecha fin" value={fechaFin} onChange={e=>setFechaFin(e.target.value)} />
        <button type="submit">Crear</button>
      </form>
      )}

      <div style={{marginTop:12, overflowX:'auto'}}>
        <table className="table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Producto</th>
              <th>Almacén</th>
              <th>Costo</th>
              <th>Desde</th>
              <th>Hasta</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {items.map(it => (
              <tr key={it.id}>
                <td>{it.id}</td>
                <td>{it.productoId}</td>
                <td>{it.almacenId}</td>
                <td>{it.costo}</td>
                <td>{it.fecha_inicio}</td>
                <td>{it.fecha_fin || ''}</td>
                <td>{user?.rol === 'admin' ? <button onClick={()=>handleDelete(it.id)}>Eliminar</button> : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default ProductoCostosAdmin;
