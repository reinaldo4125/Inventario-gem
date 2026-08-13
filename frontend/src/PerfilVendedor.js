import React, { useState, useEffect } from 'react';

function PerfilVendedor({ usuario }) {
  const [almacenes, setAlmacenes] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchAlmacenes = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch('/almacenes', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setAlmacenes(data);
        }
      } catch (err) {
        console.error('Error cargando almacenes:', err);
      }
    };
    fetchAlmacenes();
  }, []);

  const miAlmacen = almacenes.find(a => a.id === usuario.almacenId) || usuario.almacen;

  return (
    <div style={{ maxWidth: 650, margin: '24px auto', padding: 24, background: '#ffffff', borderRadius: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24, paddingBottom: 16, borderBottom: '1px solid #f1f5f9' }}>
        <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#2563eb', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, fontWeight: 'bold' }}>
          {usuario.nombre ? usuario.nombre.charAt(0).toUpperCase() : 'U'}
        </div>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, color: '#0f172a' }}>{usuario.nombre}</h2>
          <span style={{ fontSize: 13, color: '#64748b', textTransform: 'capitalize' }}>Rol: {usuario.rol}</span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div style={{ padding: 16, background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: 12, color: '#64748b', fontWeight: '600', marginBottom: 4 }}>CORREO ELECTRÓNICO</div>
          <div style={{ fontSize: 14, fontWeight: '500', color: '#1e293b' }}>{usuario.correo || 'No especificado'}</div>
        </div>

        <div style={{ padding: 16, background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: 12, color: '#64748b', fontWeight: '600', marginBottom: 4 }}>ALMACÉN ASIGNADO</div>
          <div style={{ fontSize: 14, fontWeight: '500', color: '#1e293b' }}>
            {miAlmacen ? (typeof miAlmacen === 'object' ? miAlmacen.nombre : miAlmacen) : 'Almacén Principal'}
          </div>
        </div>
      </div>

      <div style={{ marginTop: 24, padding: 16, backgroundColor: '#eff6ff', borderRadius: 8, border: '1px solid #bfdbfe', color: '#1e3a8a', fontSize: 13, lineHeight: '1.5' }}>
        ℹ️ Como usuario con rol <strong>Vendedor</strong>, tienes acceso a la creación de ventas, gestión de clientes, consulta de catálogo de productos e informes de tus ventas en tu almacén asignado.
      </div>
    </div>
  );
}

export default PerfilVendedor;
