import React, { useEffect, useState } from 'react';
import { formatCurrency, formatNumber } from './utils/formatters';
import { 
  MdAdd, MdEdit, MdDelete, MdSearch, MdRefresh, 
  MdLocationOn, MdPerson, MdPhone, MdEmail, MdStore,
  MdInventory, MdPeople, MdWarning, MdAttachMoney, MdClose
} from 'react-icons/md';
import { FaWarehouse, FaCity, FaMapMarkerAlt } from 'react-icons/fa';

function Almacenes({ usuario }) {
  const [almacenes, setAlmacenes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Search & Filter
  const [search, setSearch] = useState('');

  // Modal Crear / Editar
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({
    codigo: '',
    nombre: '',
    ubicacion: '',
    ciudad: '',
    direccion: '',
    telefono: '',
    email: '',
    responsable: ''
  });
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  // Modal Inventario Detallado de Almacén
  const [showInventarioModal, setShowInventarioModal] = useState(false);
  const [almacenDetalle, setAlmacenDetalle] = useState(null);
  const [inventarioList, setInventarioList] = useState([]);
  const [inventarioLoading, setInventarioLoading] = useState(false);
  const [searchInventario, setSearchInventario] = useState('');

  // Modal Traslados entre Bodegas
  const [showTrasladoModal, setShowTrasladoModal] = useState(false);
  const [productosCatalogo, setProductosCatalogo] = useState([]);
  const [busquedaProductoTraslado, setBusquedaProductoTraslado] = useState('');
  const [trasladoForm, setTrasladoForm] = useState({
    almacenOrigenId: '1',
    almacenDestinoId: '',
    observaciones: '',
    items: []
  });
  const [trasladoError, setTrasladoError] = useState('');
  const [procesandoTraslado, setProcesandoTraslado] = useState(false);

  // Modal Historial de Traslados
  const [showHistorialTraslados, setShowHistorialTraslados] = useState(false);
  const [listaTraslados, setListaTraslados] = useState([]);
  const [loadingTraslados, setLoadingTraslados] = useState(false);

  const isAdmin = usuario?.rol === 'admin';
  const token = usuario?.token || localStorage.getItem('token') || '';

  const cargarAlmacenes = () => {
    setLoading(true);
    setError('');
    fetch('/almacenes', {
      headers: { 'Authorization': token ? `Bearer ${token}` : '' }
    })
      .then(res => {
        if (!res.ok) throw new Error('Error al cargar almacenes');
        return res.json();
      })
      .then(data => {
        setAlmacenes(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(err => {
        setError('No se pudo conectar con el servidor para obtener los almacenes.');
        setLoading(false);
      });
  };

  useEffect(() => {
    cargarAlmacenes();
  }, [usuario]);

  // Filtrado de almacenes
  const almacenesFiltrados = almacenes.filter(a => {
    if (!search) return true;
    const term = search.toLowerCase();
    return (
      a.nombre?.toLowerCase().includes(term) ||
      a.codigo?.toLowerCase().includes(term) ||
      a.ubicacion?.toLowerCase().includes(term) ||
      a.ciudad?.toLowerCase().includes(term) ||
      a.responsable?.toLowerCase().includes(term) ||
      a.direccion?.toLowerCase().includes(term)
    );
  });

  // KPIs globales
  const totalSedes = almacenes.length;
  const totalStockConsolidado = almacenes.reduce((acc, a) => acc + Number(a.totalStock || 0), 0);
  const valorizacionConsolidada = almacenes.reduce((acc, a) => acc + Number(a.totalValoracion || 0), 0);
  const totalPersonalAsignado = almacenes.reduce((acc, a) => acc + Number(a.usuariosAsignados || 0), 0);

  // Handlers
  const handleNuevoAlmacen = () => {
    setForm({
      codigo: `BOD-0${almacenes.length + 1}`,
      nombre: '',
      ubicacion: '',
      ciudad: '',
      direccion: '',
      telefono: '',
      email: '',
      responsable: ''
    });
    setEditId(null);
    setFormError('');
    setShowModal(true);
  };

  const handleEditAlmacen = (almacen) => {
    setForm({
      codigo: almacen.codigo || '',
      nombre: almacen.nombre || '',
      ubicacion: almacen.ubicacion || '',
      ciudad: almacen.ciudad || '',
      direccion: almacen.direccion || '',
      telefono: almacen.telefono || '',
      email: almacen.email || '',
      responsable: almacen.responsable || ''
    });
    setEditId(almacen.id);
    setFormError('');
    setShowModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.nombre.trim()) {
      setFormError('El nombre del almacén es obligatorio');
      return;
    }

    setSaving(true);
    setFormError('');
    try {
      const url = editId ? `/almacenes/${editId}` : '/almacenes';
      const method = editId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(form)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al guardar el almacén');

      setSuccess(editId ? 'Almacén actualizado correctamente' : 'Almacén creado exitosamente');
      setShowModal(false);
      cargarAlmacenes();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (almacen) => {
    if (almacen.id === 1) {
      alert('El Almacén Principal del sistema no puede ser eliminado.');
      return;
    }

    if (!window.confirm(`¿Está seguro de eliminar el almacén "${almacen.nombre}"?`)) return;

    try {
      setLoading(true);
      const res = await fetch(`/almacenes/${almacen.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'No se pudo eliminar el almacén');

      setSuccess('Almacén eliminado exitosamente');
      cargarAlmacenes();
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  const handleVerInventario = async (almacen) => {
    setAlmacenDetalle(almacen);
    setShowInventarioModal(true);
    setInventarioLoading(true);
    setSearchInventario('');

    try {
      const res = await fetch(`/almacenes/${almacen.id}/inventario`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Error al consultar inventario');
      const data = await res.json();
      setInventarioList(Array.isArray(data.inventario) ? data.inventario : []);
    } catch (err) {
      setInventarioList([]);
    } finally {
      setInventarioLoading(false);
    }
  };

  const cargarProductosCatalogo = () => {
    fetch('/productos', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        setProductosCatalogo(Array.isArray(data) ? data : []);
      })
      .catch(() => {});
  };

  const cargarHistorialTraslados = () => {
    setLoadingTraslados(true);
    fetch('/api/traslados', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        setListaTraslados(Array.isArray(data) ? data : []);
      })
      .catch(() => {})
      .finally(() => setLoadingTraslados(false));
  };

  useEffect(() => {
    if (showTrasladoModal) {
      cargarProductosCatalogo();
    }
  }, [showTrasladoModal]);

  const handleAgregarProductoTraslado = (producto) => {
    if (!producto) return;
    const existe = trasladoForm.items.find(x => x.productoId === producto.id);
    if (existe) {
      setTrasladoForm({
        ...trasladoForm,
        items: trasladoForm.items.map(x => x.productoId === producto.id ? { ...x, cantidad: x.cantidad + 1 } : x)
      });
    } else {
      setTrasladoForm({
        ...trasladoForm,
        items: [...trasladoForm.items, { productoId: producto.id, producto, cantidad: 1 }]
      });
    }
    setBusquedaProductoTraslado('');
  };

  const handleGuardarTraslado = async (e) => {
    e.preventDefault();
    setTrasladoError('');
    if (!trasladoForm.almacenOrigenId || !trasladoForm.almacenDestinoId) {
      setTrasladoError('Seleccione los almacenes de origen y destino.');
      return;
    }
    if (trasladoForm.almacenOrigenId === trasladoForm.almacenDestinoId) {
      setTrasladoError('El almacén de origen y destino deben ser diferentes.');
      return;
    }
    if (trasladoForm.items.length === 0) {
      setTrasladoError('Agregue al menos un producto al traslado.');
      return;
    }

    setProcesandoTraslado(true);
    try {
      const payload = {
        almacenOrigenId: Number(trasladoForm.almacenOrigenId),
        almacenDestinoId: Number(trasladoForm.almacenDestinoId),
        observaciones: trasladoForm.observaciones,
        items: trasladoForm.items.map(x => ({ productoId: x.productoId, cantidad: Number(x.cantidad) }))
      };

      const res = await fetch('/api/traslados', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al procesar el traslado');

      setSuccess('Traslado de mercancía entre bodegas completado exitosamente.');
      setShowTrasladoModal(false);
      cargarAlmacenes();
    } catch (err) {
      setTrasladoError(err.message);
    } finally {
      setProcesandoTraslado(false);
    }
  };
  const inventarioFiltradoModal = inventarioList.filter(item => {
    if (!searchInventario) return true;
    const term = searchInventario.toLowerCase();
    return (
      item.nombre?.toLowerCase().includes(term) ||
      item.codigo_oem?.toLowerCase().includes(term) ||
      item.categoria?.toLowerCase().includes(term) ||
      item.marca?.toLowerCase().includes(term)
    );
  });

  return (
    <div style={{ padding: '4px 0' }}>
      {/* HEADER SECTION */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#1a202c', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FaWarehouse color="#3182ce" /> Gestión de Almacenes y Bodegas
          </h1>
          <p style={{ margin: '4px 0 0 0', color: '#718096', fontSize: '14px' }}>
            Administración centralizada de sedes, inventarios físicos por punto y personal de logística.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button 
            onClick={cargarAlmacenes} 
            className="btn btn-secundario" 
            style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#edf2f7', color: '#2d3748' }}
            title="Actualizar listado de almacenes"
          >
            <MdRefresh size={18} /> Actualizar
          </button>
          <button 
            onClick={() => { setShowTrasladoModal(true); setTrasladoForm({ almacenOrigenId: '1', almacenDestinoId: '', observaciones: '', items: [] }); }} 
            className="btn btn-principal" 
            style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: '#805ad5' }}
            title="Registrar transferencia de stock entre bodegas"
          >
            🚚 Nuevo Traslado
          </button>
          {isAdmin && (
            <button 
              onClick={handleNuevoAlmacen} 
              className="btn btn-principal" 
              style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: '#3182ce' }}
            >
              <MdAdd size={20} /> Nuevo Almacén
            </button>
          )}
        </div>
      </div>

      {/* KPI METRICS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '20px' }}>
        <div className="card" style={{ padding: '16px', background: '#ffffff', borderRadius: '10px', borderLeft: '4px solid #3182ce', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: '12px', color: '#718096', textTransform: 'uppercase', fontWeight: 600 }}>Sedes / Almacenes</div>
          <div style={{ fontSize: '26px', fontWeight: 700, color: '#2d3748', marginTop: '4px' }}>{totalSedes}</div>
          <div style={{ fontSize: '12px', color: '#4a5568', marginTop: '2px' }}>Puntos de almacenamiento</div>
        </div>

        <div className="card" style={{ padding: '16px', background: '#ffffff', borderRadius: '10px', borderLeft: '4px solid #38a169', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: '12px', color: '#718096', textTransform: 'uppercase', fontWeight: 600 }}>Stock Total Unidades</div>
          <div style={{ fontSize: '26px', fontWeight: 700, color: '#276749', marginTop: '4px' }}>{formatNumber(totalStockConsolidado)} <span style={{ fontSize: '14px', fontWeight: 400 }}>unds</span></div>
          <div style={{ fontSize: '12px', color: '#4a5568', marginTop: '2px' }}>Distribuidas en bodegas</div>
        </div>

        <div className="card" style={{ padding: '16px', background: '#ffffff', borderRadius: '10px', borderLeft: '4px solid #805ad5', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: '12px', color: '#718096', textTransform: 'uppercase', fontWeight: 600 }}>Valoración Total</div>
          <div style={{ fontSize: '22px', fontWeight: 700, color: '#553c9a', marginTop: '4px' }}>{formatCurrency(valorizacionConsolidada)}</div>
          <div style={{ fontSize: '12px', color: '#4a5568', marginTop: '2px' }}>Valor en inventario físico</div>
        </div>

        <div className="card" style={{ padding: '16px', background: '#ffffff', borderRadius: '10px', borderLeft: '4px solid #dd6b20', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: '12px', color: '#718096', textTransform: 'uppercase', fontWeight: 600 }}>Personal Asignado</div>
          <div style={{ fontSize: '26px', fontWeight: 700, color: '#c05621', marginTop: '4px' }}>{totalPersonalAsignado} <span style={{ fontSize: '14px', fontWeight: 400 }}>usuarios</span></div>
          <div style={{ fontSize: '12px', color: '#4a5568', marginTop: '2px' }}>Asociados a sedes</div>
        </div>
      </div>

      {/* NOTIFICATIONS */}
      {error && <div className="alert alert-error" style={{ marginBottom: '16px' }}>{error}</div>}
      {success && <div className="alert alert-success" style={{ marginBottom: '16px' }}>{success}</div>}

      {/* SEARCH TOOLBAR */}
      <div className="card" style={{ padding: '14px', marginBottom: '20px', borderRadius: '8px', background: '#f7fafc', border: '1px solid #e2e8f0' }}>
        <div style={{ position: 'relative', width: '100%' }}>
          <MdSearch style={{ position: 'absolute', left: '12px', top: '10px', color: '#a0aec0' }} size={20} />
          <input 
            type="text" 
            placeholder="Buscar almacén por Nombre, Código, Ciudad, Dirección o Responsable..." 
            value={search} 
            onChange={e => setSearch(e.target.value)} 
            className="input" 
            style={{ paddingLeft: '38px', width: '100%' }} 
          />
        </div>
      </div>

      {/* TABLE OF WAREHOUSES */}
      <div className="card" style={{ padding: '0', borderRadius: '8px', overflow: 'hidden', border: '1px solid #e2e8f0' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="usuarios-table" style={{ width: '100%', fontSize: '14px', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#edf2f7', color: '#2d3748', textAlign: 'left' }}>
                <th style={{ padding: '12px 16px' }}>Código / Almacén</th>
                <th style={{ padding: '12px' }}>Ubicación / Dirección</th>
                <th style={{ padding: '12px' }}>Responsable / Contacto</th>
                <th style={{ padding: '12px', textAlign: 'center' }}>Referencias</th>
                <th style={{ padding: '12px', textAlign: 'center' }}>Stock Total</th>
                <th style={{ padding: '12px', textAlign: 'right' }}>Valoración</th>
                <th style={{ padding: '12px', textAlign: 'center' }}>Personal</th>
                <th style={{ padding: '12px 16px', textAlign: 'center' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading && almacenesFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '30px', color: '#718096' }}>
                    Cargando información de almacenes...
                  </td>
                </tr>
              ) : almacenesFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '30px', color: '#a0aec0' }}>
                    No se encontraron almacenes registrados o coincidentes con la búsqueda.
                  </td>
                </tr>
              ) : (
                almacenesFiltrados.map(a => (
                  <tr key={a.id} style={{ borderBottom: '1px solid #edf2f7', transition: 'background 0.15s' }}>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ padding: '8px', background: '#ebf8ff', borderRadius: '6px', color: '#3182ce' }}>
                          <MdStore size={20} />
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, color: '#2d3748' }}>{a.nombre}</div>
                          <div style={{ fontSize: '12px', color: '#718096' }}>
                            {a.codigo ? <b>{a.codigo}</b> : `ID: ${a.id}`}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td style={{ padding: '12px' }}>
                      <div style={{ color: '#2d3748', fontWeight: 500 }}>{a.ciudad || a.ubicacion || 'Sede Principal'}</div>
                      <div style={{ fontSize: '12px', color: '#718096', marginTop: '2px' }}>
                        {a.direccion || a.ubicacion || '-'}
                      </div>
                    </td>

                    <td style={{ padding: '12px' }}>
                      <div style={{ color: '#2d3748', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <MdPerson color="#4a5568" size={15} /> {a.responsable || 'No asignado'}
                      </div>
                      <div style={{ fontSize: '12px', color: '#718096', marginTop: '2px' }}>
                        {a.telefono && <span>📞 {a.telefono} </span>}
                        {a.email && <span>✉️ {a.email}</span>}
                      </div>
                    </td>

                    <td style={{ padding: '12px', textAlign: 'center', fontWeight: 600, color: '#2b6cb0' }}>
                      {formatNumber(a.totalReferencias || 0)} <span style={{ fontSize: '11px', fontWeight: 400, color: '#718096' }}>SKUs</span>
                    </td>

                    <td style={{ padding: '12px', textAlign: 'center' }}>
                      <span className="badge badge-success" style={{ fontSize: '13px', padding: '4px 10px' }}>
                        {formatNumber(a.totalStock || 0)} unds
                      </span>
                    </td>

                    <td style={{ padding: '12px', textAlign: 'right', fontWeight: 700, color: '#276749' }}>
                      {formatCurrency(a.totalValoracion || 0)}
                    </td>

                    <td style={{ padding: '12px', textAlign: 'center' }}>
                      <span style={{ fontSize: '13px', padding: '2px 8px', background: '#edf2f7', borderRadius: '10px', color: '#4a5568', fontWeight: 600 }}>
                        👥 {a.usuariosAsignados || 0}
                      </span>
                    </td>

                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                        <button 
                          className="btn" 
                          style={{ padding: '6px', background: '#ebf8ff', color: '#3182ce', border: '1px solid #bee3f8' }} 
                          onClick={() => handleVerInventario(a)} 
                          title="Ver inventario de productos en este almacén"
                        >
                          <MdInventory size={16} />
                        </button>

                        {isAdmin && (
                          <button 
                            className="btn" 
                            style={{ padding: '6px', background: '#edf2f7', color: '#4a5568', border: '1px solid #cbd5e0' }} 
                            onClick={() => handleEditAlmacen(a)} 
                            title="Editar datos de este almacén"
                          >
                            <MdEdit size={16} />
                          </button>
                        )}

                        {isAdmin && a.id !== 1 && (
                          <button 
                            className="btn" 
                            style={{ padding: '6px', background: '#fff5f5', color: '#e53e3e', border: '1px solid #fed7d7' }} 
                            onClick={() => handleDelete(a)} 
                            title="Eliminar almacén"
                          >
                            <MdDelete size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL CREAR / EDITAR ALMACÉN */}
      {isAdmin && showModal && (
        <div className="modal-backdrop">
          <div className="modal-card card" style={{ maxWidth: '600px', width: '90%' }}>
            <h3 style={{ marginTop: 0, color: '#2b6cb0', borderBottom: '2px solid #ebf8ff', paddingBottom: '10px' }}>
              {editId ? '✏️ Editar Almacén / Bodega' : '🏢 Registrar Nuevo Almacén'}
            </h3>

            <form onSubmit={handleSave} style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '14px', marginTop: '16px' }}>
              
              <div className="form-field">
                <label style={{ fontWeight: 600 }}>Código Interno</label>
                <input 
                  type="text" 
                  className="input" 
                  value={form.codigo} 
                  onChange={e => setForm({ ...form, codigo: e.target.value })} 
                  placeholder="Ej: BOD-TULUA" 
                />
              </div>

              <div className="form-field">
                <label style={{ fontWeight: 600 }}>Nombre del Almacén *</label>
                <input 
                  type="text" 
                  className="input" 
                  value={form.nombre} 
                  onChange={e => setForm({ ...form, nombre: e.target.value })} 
                  placeholder="Ej: Bodega Tuluá - Centro" 
                  required 
                />
              </div>

              <div className="form-field">
                <label style={{ fontWeight: 600 }}>Ciudad / Municipio</label>
                <input 
                  type="text" 
                  className="input" 
                  value={form.ciudad} 
                  onChange={e => setForm({ ...form, ciudad: e.target.value })} 
                  placeholder="Ej: Tuluá, Valle" 
                />
              </div>

              <div className="form-field">
                <label style={{ fontWeight: 600 }}>Ubicación / Sector</label>
                <input 
                  type="text" 
                  className="input" 
                  value={form.ubicacion} 
                  onChange={e => setForm({ ...form, ubicacion: e.target.value })} 
                  placeholder="Ej: Sede Principal / Zona Industrial" 
                />
              </div>

              <div className="form-field" style={{ gridColumn: 'span 2' }}>
                <label style={{ fontWeight: 600 }}>Dirección Física</label>
                <input 
                  type="text" 
                  className="input" 
                  value={form.direccion} 
                  onChange={e => setForm({ ...form, direccion: e.target.value })} 
                  placeholder="Ej: Cra 26 # 28-45 Barrio Centro" 
                />
              </div>

              <div className="form-field">
                <label style={{ fontWeight: 600 }}>Teléfono de Contacto</label>
                <input 
                  type="text" 
                  className="input" 
                  value={form.telefono} 
                  onChange={e => setForm({ ...form, telefono: e.target.value })} 
                  placeholder="Ej: (602) 224-5000" 
                />
              </div>

              <div className="form-field">
                <label style={{ fontWeight: 600 }}>Correo Electrónico</label>
                <input 
                  type="email" 
                  className="input" 
                  value={form.email} 
                  onChange={e => setForm({ ...form, email: e.target.value })} 
                  placeholder="Ej: bodega.tulua@multinyectores.com" 
                />
              </div>

              <div className="form-field" style={{ gridColumn: 'span 2' }}>
                <label style={{ fontWeight: 600 }}>Encargado / Responsable de Bodega</label>
                <input 
                  type="text" 
                  className="input" 
                  value={form.responsable} 
                  onChange={e => setForm({ ...form, responsable: e.target.value })} 
                  placeholder="Ej: Carlos Alberto Gómez" 
                />
              </div>

              {formError && <div className="alert alert-error" style={{ gridColumn: 'span 2' }}>{formError}</div>}

              <div style={{ gridColumn: 'span 2', display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '12px' }}>
                <button type="button" className="btn btn-secundario" onClick={() => setShowModal(false)}>Cancelar</button>
                <button type="submit" disabled={saving} className="btn btn-principal" style={{ backgroundColor: '#3182ce' }}>
                  {saving ? 'Guardando...' : 'Guardar Almacén'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* MODAL DETALLE DE INVENTARIO DEL ALMACÉN */}
      {showInventarioModal && almacenDetalle && (
        <div className="modal-backdrop">
          <div className="modal-card card" style={{ maxWidth: '850px', width: '90%', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #ebf8ff', paddingBottom: '10px' }}>
              <div>
                <h3 style={{ margin: 0, color: '#2b6cb0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <FaWarehouse /> Inventario Físico en {almacenDetalle.nombre}
                </h3>
                <span style={{ fontSize: '13px', color: '#718096' }}>
                  {almacenDetalle.ciudad || almacenDetalle.ubicacion || 'Sede Local'} — Código: {almacenDetalle.codigo || almacenDetalle.id}
                </span>
              </div>
              <button onClick={() => setShowInventarioModal(false)} className="btn btn-secundario" style={{ padding: '4px 8px' }}>
                <MdClose size={20} />
              </button>
            </div>

            {/* BUSCADOR DENTRO DEL MODAL */}
            <div style={{ marginTop: '16px', marginBottom: '14px', position: 'relative' }}>
              <MdSearch style={{ position: 'absolute', left: '10px', top: '10px', color: '#a0aec0' }} size={20} />
              <input 
                type="text" 
                placeholder="Buscar productos en este almacén por nombre, OEM, categoría o marca..." 
                value={searchInventario} 
                onChange={e => setSearchInventario(e.target.value)} 
                className="input" 
                style={{ paddingLeft: '36px', width: '100%' }} 
              />
            </div>

            {/* TABLA DE INVENTARIO DEL ALMACÉN */}
            <div style={{ overflowX: 'auto' }}>
              <table className="usuarios-table" style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#edf2f7', color: '#2d3748' }}>
                    <th style={{ padding: '10px' }}>Producto / OEM</th>
                    <th style={{ padding: '10px' }}>Categoría</th>
                    <th style={{ padding: '10px', textAlign: 'center' }}>Stock en Bodega</th>
                    <th style={{ padding: '10px', textAlign: 'right' }}>Costo Compra</th>
                    <th style={{ padding: '10px', textAlign: 'right' }}>Precio Detal</th>
                    <th style={{ padding: '10px', textAlign: 'right' }}>Subtotal Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {inventarioLoading ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: '24px', color: '#718096' }}>
                        Cargando productos de este almacén...
                      </td>
                    </tr>
                  ) : inventarioFiltradoModal.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: '24px', color: '#a0aec0' }}>
                        No hay productos registrados con stock en este almacén.
                      </td>
                    </tr>
                  ) : (
                    inventarioFiltradoModal.map(p => {
                      const isServ = p.tipo === 'servicio' || (p.categoria && p.categoria.toLowerCase().includes('servicio'));
                      const minSt = (p.stock_minimo !== undefined && p.stock_minimo !== null && p.stock_minimo !== '') ? Number(p.stock_minimo) : 5;
                      const isCritico = !isServ && (p.stock <= minSt || p.stock <= 0);
                      const subtotal = isServ ? 0 : (p.stock * Number(p.costo || p.precio_detal || 0));

                      return (
                        <tr key={p.id} style={{ borderBottom: '1px solid #edf2f7' }}>
                          <td style={{ padding: '10px' }}>
                            <div style={{ fontWeight: 600, color: '#2d3748', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              {isServ ? <span style={{ color: '#6b46c1' }}>🛠️</span> : <span style={{ color: '#3182ce' }}>📦</span>}
                              {p.nombre}
                            </div>
                            <div style={{ fontSize: '11px', color: '#718096' }}>OEM: {p.codigo_oem || '-'} | Marca: {p.marca || '-'}</div>
                          </td>
                          <td style={{ padding: '10px' }}>
                            <span className="badge badge-info" style={{ fontSize: '11px', backgroundColor: isServ ? '#faf5ff' : undefined, color: isServ ? '#6b46c1' : undefined }}>
                              {isServ ? '🛠️ Servicio' : p.categoria}
                            </span>
                          </td>
                          <td style={{ padding: '10px', textAlign: 'center' }}>
                            {isServ ? (
                              <span style={{ fontWeight: 600, color: '#6b46c1', background: '#faf5ff', padding: '2px 8px', borderRadius: '10px', border: '1px solid #e9d8fd', fontSize: '11px' }}>
                                🛠️ Servicio
                              </span>
                            ) : (
                              <span style={{ 
                                fontWeight: 700, 
                                color: isCritico ? '#e53e3e' : '#276749',
                                background: isCritico ? '#fff5f5' : '#f0fff4',
                                padding: '2px 8px',
                                borderRadius: '10px',
                                border: `1px solid ${isCritico ? '#feb2b2' : '#c6f6d5'}`
                              }}>
                                {p.stock} {p.unidad_medida}
                              </span>
                            )}
                          </td>
                          <td style={{ padding: '10px', textAlign: 'right', color: '#4a5568' }}>
                            {formatCurrency(p.costo || 0)}
                          </td>
                          <td style={{ padding: '10px', textAlign: 'right', fontWeight: 600, color: '#2b6cb0' }}>
                            {formatCurrency(p.precio_detal || 0)}
                          </td>
                          <td style={{ padding: '10px', textAlign: 'right', fontWeight: 700, color: isServ ? '#a0aec0' : '#276749' }}>
                            {isServ ? '-' : formatCurrency(subtotal)}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn btn-secundario" onClick={() => setShowInventarioModal(false)}>Cerrar</button>
            </div>

          </div>
        </div>
      )}

      {/* MODAL NUEVO TRASLADO ENTRE BODEGAS */}
      {showTrasladoModal && (
        <div className="modal-backdrop">
          <div className="modal-card card" style={{ maxWidth: '800px', width: '90%', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #e9d8fd', paddingBottom: '10px' }}>
              <h3 style={{ margin: 0, color: '#6b46c1', display: 'flex', alignItems: 'center', gap: '8px' }}>
                🚚 Registro de Traslado entre Almacenes / Bodegas
              </h3>
              <button onClick={() => setShowTrasladoModal(false)} className="btn btn-secundario" style={{ padding: '4px 8px' }}>
                <MdClose size={20} />
              </button>
            </div>

            <form onSubmit={handleGuardarTraslado} style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-field">
                  <label style={{ fontWeight: 600, color: '#4a5568' }}>Almacén Origen (Sale Mercancía) *</label>
                  <select 
                    className="input" 
                    value={trasladoForm.almacenOrigenId} 
                    onChange={e => setTrasladoForm({ ...trasladoForm, almacenOrigenId: e.target.value })}
                    required
                  >
                    {almacenes.map(a => (
                      <option key={a.id} value={a.id}>{a.nombre} ({a.ciudad || 'Sede'})</option>
                    ))}
                  </select>
                </div>

                <div className="form-field">
                  <label style={{ fontWeight: 600, color: '#4a5568' }}>Almacén Destino (Ingresa Mercancía) *</label>
                  <select 
                    className="input" 
                    value={trasladoForm.almacenDestinoId} 
                    onChange={e => setTrasladoForm({ ...trasladoForm, almacenDestinoId: e.target.value })}
                    required
                  >
                    <option value="">-- Seleccionar Almacén Destino --</option>
                    {almacenes.filter(a => String(a.id) !== String(trasladoForm.almacenOrigenId)).map(a => (
                      <option key={a.id} value={a.id}>{a.nombre} ({a.ciudad || 'Sede'})</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* BUSCADOR Y AGREGAR PRODUCTOS */}
              <div style={{ background: '#f7fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <label style={{ fontWeight: 600, fontSize: '13px', color: '#2d3748', display: 'block', marginBottom: '6px' }}>
                  🔎 Seleccionar Productos para Trasladar
                </label>
                <div style={{ position: 'relative' }}>
                  <input 
                    type="text" 
                    className="input" 
                    placeholder="Escriba el nombre, marca u OEM del producto..." 
                    value={busquedaProductoTraslado} 
                    onChange={e => setBusquedaProductoTraslado(e.target.value)} 
                  />
                  {busquedaProductoTraslado.trim() && (
                    <div style={{ 
                      position: 'absolute', top: '100%', left: 0, right: 0, 
                      background: '#ffffff', border: '1px solid #cbd5e0', 
                      borderRadius: '0 0 6px 6px', maxHeight: '200px', overflowY: 'auto', zIndex: 100, boxShadow: '0 4px 6px rgba(0,0,0,0.1)' 
                    }}>
                      {productosCatalogo
                        .filter(p => p.tipo !== 'servicio' && (
                          p.nombre.toLowerCase().includes(busquedaProductoTraslado.toLowerCase()) ||
                          (p.codigo_oem && p.codigo_oem.toLowerCase().includes(busquedaProductoTraslado.toLowerCase()))
                        ))
                        .slice(0, 10)
                        .map(prod => (
                          <div 
                            key={prod.id} 
                            onClick={() => handleAgregarProductoTraslado(prod)} 
                            style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid #edf2f7', fontSize: '13px' }}
                            className="hover:bg-blue-50"
                          >
                            <strong>{prod.nombre}</strong> <span style={{ color: '#718096' }}>(OEM: {prod.codigo_oem || 'N/A'}) - Stock: {prod.stock}</span>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              </div>

              {/* LISTA DE ÍTEMS DEL TRASLADO */}
              <div>
                <label style={{ fontWeight: 600, fontSize: '13px', color: '#2d3748', marginBottom: '6px', display: 'block' }}>
                  📦 Lista de Productos a Trasladar ({trasladoForm.items.length})
                </label>
                <table className="usuarios-table" style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#edf2f7' }}>
                      <th style={{ padding: '8px' }}>Producto</th>
                      <th style={{ padding: '8px', textAlign: 'center' }}>Cantidad a Trasladar</th>
                      <th style={{ padding: '8px', textAlign: 'center' }}>Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trasladoForm.items.length === 0 ? (
                      <tr>
                        <td colSpan={3} style={{ textAlign: 'center', padding: '16px', color: '#a0aec0' }}>
                          No se han seleccionado productos para el traslado.
                        </td>
                      </tr>
                    ) : (
                      trasladoForm.items.map((item, idx) => (
                        <tr key={item.productoId} style={{ borderBottom: '1px solid #edf2f7' }}>
                          <td style={{ padding: '8px' }}>
                            <strong>{item.producto?.nombre}</strong>
                            <div style={{ fontSize: '11px', color: '#718096' }}>OEM: {item.producto?.codigo_oem || '-'}</div>
                          </td>
                          <td style={{ padding: '8px', textAlign: 'center' }}>
                            <input 
                              type="number" 
                              min="1" 
                              className="input" 
                              style={{ width: '80px', textAlign: 'center', padding: '4px' }} 
                              value={item.cantidad} 
                              onChange={e => {
                                const val = Number(e.target.value);
                                setTrasladoForm({
                                  ...trasladoForm,
                                  items: trasladoForm.items.map((x, i) => i === idx ? { ...x, cantidad: val } : x)
                                });
                              }}
                            />
                          </td>
                          <td style={{ padding: '8px', textAlign: 'center' }}>
                            <button 
                              type="button" 
                              className="btn btn-peligro" 
                              style={{ padding: '2px 8px', fontSize: '12px' }}
                              onClick={() => {
                                setTrasladoForm({
                                  ...trasladoForm,
                                  items: trasladoForm.items.filter((_, i) => i !== idx)
                                });
                              }}
                            >
                              Quitar
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="form-field">
                <label style={{ fontWeight: 600 }}>Observaciones / Comprobante de Traslado</label>
                <textarea 
                  className="input" 
                  rows={2} 
                  value={trasladoForm.observaciones} 
                  onChange={e => setTrasladoForm({ ...trasladoForm, observaciones: e.target.value })} 
                  placeholder="Ej: Traslado de stock por alta demanda en punto de venta secundario. Conductor: Juan Pérez."
                />
              </div>

              {trasladoError && <div className="alert alert-error">{trasladoError}</div>}

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '10px' }}>
                <button type="button" className="btn btn-secundario" onClick={() => setShowTrasladoModal(false)}>Cancelar</button>
                <button type="submit" disabled={procesandoTraslado} className="btn btn-principal" style={{ backgroundColor: '#805ad5' }}>
                  {procesandoTraslado ? 'Procesando Traslado...' : '🚚 Confirmar Traslado de Stock'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

export default Almacenes;
