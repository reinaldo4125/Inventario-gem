import React, { useEffect, useState, useRef } from 'react';
import { formatCurrency, formatNumber, parsePrecio } from './utils/formatters';
import FieldError from './components/FieldError';
import { 
  MdEdit, MdDelete, MdSave, MdCancel, MdSearch, MdContentCopy, 
  MdFileDownload, MdWarning, MdInventory, MdAdd, MdRefresh,
  MdPlace, MdLocalShipping, MdAttachMoney, MdHistory
} from 'react-icons/md';
import { FaWarehouse, FaBoxOpen, FaLayerGroup, FaTag } from 'react-icons/fa';

function Productos({ usuario }) {
  const [productos, setProductos] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [formError, setFormError] = useState('');

  // Form states for Create / Edit
  const initialForm = {
    nombre: '', 
    descripcion: '', 
    categoria: '', 
    marca: '', 
    modelo: '', 
    compatibilidad: '', 
    codigo_oem: '', 
    costo: '',
    stock_minimo: '5',
    ubicacion_bodega: '',
    unidad_medida: 'Unidad',
    proveedor: '',
    precio: '', 
    precio_detal: '', 
    precio_mayor: '', 
    precio_almacen: '', 
    foto: '',
    tipo: 'producto',
    lote: '',
    fecha_vencimiento: ''
  };

  // Kardex modal state
  const [showKardexModal, setShowKardexModal] = useState(false);
  const [productoKardex, setProductoKardex] = useState(null);
  const [kardexList, setKardexList] = useState([]);
  const [kardexLoading, setKardexLoading] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [editId, setEditId] = useState(null);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [productoEdit, setProductoEdit] = useState(null);

  // Filter states
  const [search, setSearch] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('todos'); // 'todos', 'producto', 'servicio'
  const [filtroCategoria, setFiltroCategoria] = useState('');
  const [filtroMarca, setFiltroMarca] = useState('');
  const [filtroStockCritico, setFiltroStockCritico] = useState(false);
  const [selectedAlmacen, setSelectedAlmacen] = useState('');
  const [almacenes, setAlmacenes] = useState([]);

  // Stock assignment per warehouse modal
  const [productoAsignar, setProductoAsignar] = useState(null);
  const [showAsignar, setShowAsignar] = useState(false);
  const [stocksAsignar, setStocksAsignar] = useState({});
  const [asignarLoading, setAsignarLoading] = useState(false);
  const [asignarError, setAsignarError] = useState('');

  // Quick stock adjustment modal
  const [showAjusteModal, setShowAjusteModal] = useState(false);
  const [productoAjuste, setProductoAjuste] = useState(null);
  const [almacenAjusteId, setAlmacenAjusteId] = useState('');
  const [nuevoStockVal, setNuevoStockVal] = useState('');
  const [motivoAjuste, setMotivoAjuste] = useState('Ingreso por compra');
  const [ajusteLoading, setAjusteLoading] = useState(false);

  // Uncontrolled refs for price fields
  const costoRef = useRef(null);
  const precioRef = useRef(null);
  const precioDetalRef = useRef(null);
  const precioMayorRef = useRef(null);
  const precioAlmacenRef = useRef(null);
  const stockRefs = useRef({});

  const isAdmin = usuario?.rol === 'admin';
  const token = usuario?.token || localStorage.getItem('token') || '';

  const cargarProductos = () => {
    setLoading(true);
    const qs = selectedAlmacen ? `?almacenId=${selectedAlmacen}` : '';
    fetch(`/productos${qs}`, {
      headers: { 'Authorization': token ? `Bearer ${token}` : '' }
    })
      .then(res => res.json())
      .then(data => {
        setProductos(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => {
        setError('Error al cargar productos del servidor.');
        setLoading(false);
      });
  };

  useEffect(() => {
    let isMounted = true;
    if (isAdmin) {
      fetch('/almacenes', { headers: { 'Authorization': token ? `Bearer ${token}` : '' } })
        .then(r => r.json())
        .then(data => { if (isMounted) setAlmacenes(Array.isArray(data) ? data : []); })
        .catch(() => { if (isMounted) setAlmacenes([]); });
    }
    cargarProductos();
    const interval = setInterval(cargarProductos, 15000);
    return () => { isMounted = false; clearInterval(interval); };
  }, [usuario, selectedAlmacen]);

  // Filtering Logic
  const almacenIdUsuario = usuario?.almacenId;
  let productosFiltrados = productos;

  const categorias = Array.from(new Set(productos.map(p => p.categoria).filter(Boolean)));
  const marcas = Array.from(new Set(productos.map(p => p.marca).filter(Boolean)));

  productosFiltrados = productosFiltrados.filter(p => {
    const totalStock = Array.isArray(p.almacenes)
      ? p.almacenes.reduce((acc, a) => acc + Number(a.stock || 0), 0)
      : Number(p.stock || 0);

    const minStock = (p.stock_minimo !== undefined && p.stock_minimo !== null && p.stock_minimo !== '') ? Number(p.stock_minimo) : 5;
    const isServ = p.tipo === 'servicio' || (p.categoria && p.categoria.toLowerCase().includes('servicio'));

    const matchSearch = !search || 
      p.nombre?.toLowerCase().includes(search.toLowerCase()) ||
      p.codigo_oem?.toLowerCase().includes(search.toLowerCase()) ||
      p.marca?.toLowerCase().includes(search.toLowerCase()) ||
      p.modelo?.toLowerCase().includes(search.toLowerCase()) ||
      p.proveedor?.toLowerCase().includes(search.toLowerCase()) ||
      p.ubicacion_bodega?.toLowerCase().includes(search.toLowerCase());

    const matchTipo = filtroTipo === 'todos' || (filtroTipo === 'servicio' ? isServ : !isServ);
    const matchCat = !filtroCategoria || p.categoria === filtroCategoria;
    const matchMarca = !filtroMarca || p.marca === filtroMarca;
    const matchCritico = !filtroStockCritico || (!isServ && (totalStock <= minStock || totalStock <= 0));

    return matchSearch && matchTipo && matchCat && matchMarca && matchCritico;
  });

  // KPI Calculations
  const totalProductos = productosFiltrados.length;
  const totalUnidades = productosFiltrados.reduce((acc, p) => {
    const isServ = p.tipo === 'servicio' || (p.categoria && p.categoria.toLowerCase().includes('servicio'));
    if (isServ) return acc;
    const st = Array.isArray(p.almacenes) ? p.almacenes.reduce((sum, a) => sum + Number(a.stock || 0), 0) : Number(p.stock || 0);
    return acc + st;
  }, 0);

  const productosCriticosCount = productos.filter(p => {
    const isServ = p.tipo === 'servicio' || (p.categoria && p.categoria.toLowerCase().includes('servicio'));
    if (isServ) return false;
    const st = Array.isArray(p.almacenes) ? p.almacenes.reduce((sum, a) => sum + Number(a.stock || 0), 0) : Number(p.stock || 0);
    const minStock = (p.stock_minimo !== undefined && p.stock_minimo !== null && p.stock_minimo !== '') ? Number(p.stock_minimo) : 5;
    return st <= minStock || st <= 0;
  }).length;

  const valorInventario = productosFiltrados.reduce((acc, p) => {
    const isServ = p.tipo === 'servicio' || (p.categoria && p.categoria.toLowerCase().includes('servicio'));
    if (isServ) return acc;
    const st = Array.isArray(p.almacenes) ? p.almacenes.reduce((sum, a) => sum + Number(a.stock || 0), 0) : Number(p.stock || 0);
    const priceUnit = Number(p.costo || p.precio_detal || p.precio || 0);
    return acc + (st * priceUnit);
  }, 0);

  // Counts for filter pills
  const cantProdFisicos = productos.filter(p => p.tipo !== 'servicio' && (!p.categoria || !p.categoria.toLowerCase().includes('servicio'))).length;
  const cantServicios = productos.filter(p => p.tipo === 'servicio' || (p.categoria && p.categoria.toLowerCase().includes('servicio'))).length;

  const handleVerKardex = async (producto) => {
    setProductoKardex(producto);
    setShowKardexModal(true);
    setKardexLoading(true);
    try {
      const res = await fetch(`/api/kardex/producto/${producto.id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Error al cargar Kardex');
      const data = await res.json();
      setKardexList(Array.isArray(data) ? data : []);
    } catch (err) {
      setKardexList([]);
    } finally {
      setKardexLoading(false);
    }
  };

  // Form handlers
  const handleEdit = (producto) => {
    const isServ = producto.tipo === 'servicio' || (producto.categoria && producto.categoria.toLowerCase().includes('servicio'));
    setForm({
      nombre: producto.nombre || '',
      descripcion: producto.descripcion || '',
      categoria: producto.categoria || (isServ ? 'Servicios' : ''),
      marca: producto.marca || '',
      modelo: producto.modelo || '',
      compatibilidad: producto.compatibilidad || '',
      codigo_oem: producto.codigo_oem || '',
      costo: producto.costo !== undefined && producto.costo !== null ? String(producto.costo) : '',
      stock_minimo: producto.stock_minimo !== undefined && producto.stock_minimo !== null ? String(producto.stock_minimo) : '5',
      ubicacion_bodega: producto.ubicacion_bodega || '',
      unidad_medida: producto.unidad_medida || (isServ ? 'Servicio' : 'Unidad'),
      proveedor: producto.proveedor || '',
      precio: producto.precio !== undefined && producto.precio !== null ? String(producto.precio) : '',
      precio_detal: producto.precio_detal !== undefined && producto.precio_detal !== null ? String(producto.precio_detal) : '',
      precio_mayor: producto.precio_mayor !== undefined && producto.precio_mayor !== null ? String(producto.precio_mayor) : '',
      precio_almacen: producto.precio_almacen !== undefined && producto.precio_almacen !== null ? String(producto.precio_almacen) : '',
      foto: producto.foto || '',
      tipo: isServ ? 'servicio' : 'producto',
      lote: producto.lote || '',
      fecha_vencimiento: producto.fecha_vencimiento ? String(producto.fecha_vencimiento).split('T')[0] : ''
    });
    setEditId(producto.id || null);
    setProductoEdit(producto);
    setShowModal(true);
  };

  const handleNuevoProducto = () => {
    setForm({ ...initialForm, tipo: 'producto' });
    setEditId(null);
    setFile(null);
    setPreview('');
    setProductoEdit(null);
    setFormError('');
    setShowModal(true);
  };

  const handleNuevoServicio = () => {
    setForm({
      ...initialForm,
      tipo: 'servicio',
      categoria: 'Servicios',
      unidad_medida: 'Servicio',
      stock_minimo: '0'
    });
    setEditId(null);
    setFile(null);
    setPreview('');
    setProductoEdit(null);
    setFormError('');
    setShowModal(true);
  };

  const handleSembrarServicios = async () => {
    if (!window.confirm('¿Desea registrar los 5 servicios estándar de taller multinyectores (Mantenimiento, Ultrasonido, Calibración, Mano de Obra, Escáner)?')) return;
    setLoading(true);
    setError('');
    const serviciosEstandar = [
      { nombre: 'Mantenimiento e Inspección de Inyectores', precio_detal: 120000, costo: 20000, categoria: 'Servicios', unidad_medida: 'Servicio', tipo: 'servicio', descripcion: 'Limpieza, prueba de estanqueidad y cambio de microfiltros.' },
      { nombre: 'Limpieza por Ultrasonido de Inyectores', precio_detal: 80000, costo: 15000, categoria: 'Servicios', unidad_medida: 'Servicio', tipo: 'servicio', descripcion: 'Desincrustación de barnices en tina ultrasónica.' },
      { nombre: 'Calibración y Prueba en Banco Common Rail', precio_detal: 150000, costo: 30000, categoria: 'Servicios', unidad_medida: 'Servicio', tipo: 'servicio', descripcion: 'Medición digital de caudal y entrega en banco.' },
      { nombre: 'Mano de Obra Montaje / Desmontaje', precio_detal: 100000, costo: 0, categoria: 'Servicios', unidad_medida: 'Hora', tipo: 'servicio', descripcion: 'Desarmado e instalación en vehículo.' },
      { nombre: 'Diagnóstico Electrónico por Escáner', precio_detal: 70000, costo: 0, categoria: 'Servicios', unidad_medida: 'Servicio', tipo: 'servicio', descripcion: 'Lectura de códigos de falla y borrado DTC.' }
    ];

    try {
      for (const serv of serviciosEstandar) {
        const existe = productos.some(p => p.nombre.toLowerCase().includes(serv.nombre.toLowerCase().substring(0, 15)));
        if (!existe) {
          await fetch('/productos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ ...serv, stock: 0, stock_minimo: 0 })
          });
        }
      }
      setSuccess('Servicios de taller creados exitosamente');
      cargarProductos();
    } catch (err) {
      setError('Error al crear servicios estándar');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelEdit = () => {
    setForm(initialForm);
    setEditId(null);
    setFile(null);
    setPreview('');
    setProductoEdit(null);
    setShowModal(false);
  };

  const handleDuplicar = async (producto) => {
    if (!window.confirm(`¿Desea duplicar el producto "${producto.nombre}"?`)) return;
    try {
      setLoading(true);
      const res = await fetch(`/productos/${producto.id}/duplicar`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('No se pudo duplicar el producto');
      setSuccess('Producto duplicado correctamente');
      cargarProductos();
    } catch (err) {
      setError('Error al duplicar el producto');
      setLoading(false);
    }
  };

  const handleDelete = (id) => {
    if (window.confirm('¿Desea archivar este producto?')) {
      (async () => {
        setLoading(true);
        setError('');
        const backup = productos;
        setProductos(prev => prev.filter(p => p.id !== id));
        try {
          const res = await fetch(`/productos/${id}/archivar`, {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (!res.ok) throw new Error('Error al archivar');
          setSuccess('Producto archivado correctamente');
        } catch (err) {
          setError('No se pudo archivar el producto.');
          setProductos(backup);
        } finally {
          setLoading(false);
        }
      })();
    }
  };

  // Asignación de stock por almacén
  const handleAsignar = (producto) => {
    (async () => {
      setAsignarLoading(true);
      try {
        const res = await fetch('/almacenes', { headers: { 'Authorization': `Bearer ${token}` } });
        const allAlmacenes = await res.json();
        const initialStocks = {};
        allAlmacenes.forEach(a => {
          const pa = Array.isArray(producto?.almacenes) ? producto.almacenes.find(x => String(x.id) === String(a.id)) : null;
          initialStocks[a.id] = String(pa ? (pa.stock || 0) : 0);
        });
        setStocksAsignar(initialStocks);
        setProductoAsignar({ ...producto, almacenes: allAlmacenes });
        setShowAsignar(true);
      } catch (err) {
        setProductoAsignar(producto);
        setShowAsignar(true);
      }
      setAsignarLoading(false);
    })();
  };

  // Ajuste rápido de stock
  const handleAbrirAjuste = (producto) => {
    setProductoAjuste(producto);
    const targetAlmacen = selectedAlmacen || (almacenes[0] ? almacenes[0].id : 1);
    setAlmacenAjusteId(targetAlmacen);
    const pa = Array.isArray(producto.almacenes) ? producto.almacenes.find(x => String(x.id) === String(targetAlmacen)) : null;
    setNuevoStockVal(pa ? String(pa.stock) : String(producto.stock || 0));
    setMotivoAjuste('Ingreso por compra');
    setShowAjusteModal(true);
  };

  const handleGuardarAjuste = async (e) => {
    e.preventDefault();
    if (!productoAjuste || !almacenAjusteId) return;
    try {
      setAjusteLoading(true);
      const res = await fetch(`/productos/${productoAjuste.id}/ajuste-stock`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          almacenId: almacenAjusteId,
          nuevoStock: Number(nuevoStockVal),
          motivo: motivoAjuste
        })
      });
      if (!res.ok) throw new Error('Error al ajustar stock');
      setSuccess(`Stock de ${productoAjuste.nombre} actualizado correctamente.`);
      setShowAjusteModal(false);
      cargarProductos();
    } catch (err) {
      setError('Error al actualizar el stock');
    } finally {
      setAjusteLoading(false);
    }
  };

  // Exportar inventario a CSV
  const exportarCSV = () => {
    if (!productosFiltrados.length) return;
    const headers = ["ID", "Nombre", "Categoría", "Marca", "Modelo", "Código OEM", "Ubicación Bodega", "Stock Total", "Stock Mínimo", "Costo", "Precio Detal", "Precio Mayor", "Precio Almacén"];
    const rows = productosFiltrados.map(p => {
      const st = Array.isArray(p.almacenes) ? p.almacenes.reduce((acc,a)=>acc+Number(a.stock||0),0) : p.stock;
      return [
        p.id,
        `"${(p.nombre || '').replace(/"/g, '""')}"`,
        `"${p.categoria || ''}"`,
        `"${p.marca || ''}"`,
        `"${p.modelo || ''}"`,
        `"${p.codigo_oem || ''}"`,
        `"${p.ubicacion_bodega || ''}"`,
        st,
        p.stock_minimo || 0,
        p.costo || 0,
        p.precio_detal || 0,
        p.precio_mayor || 0,
        p.precio_almacen || 0
      ];
    });

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Inventario_Multinyectores_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSubmit = async e => {
    e.preventDefault();
    setLoading(true);
    setFormError('');
    setSuccess('');

    const costoParsed = parsePrecio(costoRef.current ? costoRef.current.value : form.costo);
    const precioParsed = parsePrecio(precioRef.current ? precioRef.current.value : form.precio);
    const precioDetalParsed = parsePrecio(precioDetalRef.current ? precioDetalRef.current.value : form.precio_detal);
    const precioMayorParsed = parsePrecio(precioMayorRef.current ? precioMayorRef.current.value : form.precio_mayor);
    const precioAlmacenParsed = parsePrecio(precioAlmacenRef.current ? precioAlmacenRef.current.value : form.precio_almacen);

    if (!form.nombre || !String(form.nombre).trim()) {
      setFormError('El nombre del producto es obligatorio');
      setLoading(false);
      return;
    }

    try {
      let fotoUrl = form.foto;
      if (file) {
        const data = new FormData();
        data.append('file', file);
        const resUpload = await fetch('/productos/upload', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
          body: data
        });
        if (!resUpload.ok) throw new Error('Error al subir imagen');
        const { url } = await resUpload.json();
        fotoUrl = url;
      }

      const outgoing = {
        ...form,
        costo: Number(costoParsed),
        precio: Number(precioParsed || precioDetalParsed || 0),
        precio_detal: Number(precioDetalParsed),
        precio_mayor: Number(precioMayorParsed),
        precio_almacen: Number(precioAlmacenParsed),
        stock_minimo: Number(form.stock_minimo || 5),
        foto: fotoUrl
      };

      let res;
      if (editId) {
        res = await fetch(`/productos/${editId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(outgoing)
        });
      } else {
        res = await fetch('/productos', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(outgoing)
        });
      }

      if (!res.ok) throw new Error('Error al guardar el producto');
      setSuccess(editId ? 'Producto modificado exitosamente' : 'Producto creado exitosamente');
      handleCancelEdit();
      cargarProductos();
    } catch (err) {
      setFormError('No se pudo procesar la solicitud.');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = e => {
    const { name, value } = e.target;
    if (["precio", "precio_detal", "precio_mayor", "precio_almacen", "costo"].includes(name)) {
      const raw = String(value).replace(/[^0-9\.]/g, '');
      setForm(f => ({ ...f, [name]: raw }));
    } else {
      setForm(f => ({ ...f, [name]: value }));
    }
  };

  const handleFile = e => {
    const f = e.target.files[0];
    setFile(f);
    if (f) {
      const reader = new FileReader();
      reader.onloadend = () => setPreview(reader.result);
      reader.readAsDataURL(f);
    } else {
      setPreview('');
    }
  };

  // Calculate profit margin for form feedback
  const calcMargin = () => {
    const c = parsePrecio(costoRef.current ? costoRef.current.value : form.costo);
    const d = parsePrecio(precioDetalRef.current ? precioDetalRef.current.value : form.precio_detal);
    if (c > 0 && d > 0) {
      const margin = ((d - c) / d) * 100;
      return margin.toFixed(1);
    }
    return null;
  };
  const marginVal = calcMargin();

  return (
    <div style={{ padding: '4px 0' }}>
      {/* HEADER SECTION */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#1a202c', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FaBoxOpen color="#3182ce" /> Catálogo e Inventario de Productos
          </h1>
          <p style={{ margin: '4px 0 0 0', color: '#718096', fontSize: '14px' }}>
            Gestión completa de inyectores, toberas, bombas diésel y repuestos multimarca.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button 
            onClick={exportarCSV} 
            className="btn btn-secundario" 
            style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#edf2f7', color: '#2d3748', border: '1px solid #cbd5e0' }}
            title="Exportar catálogo filtrado a Excel CSV"
          >
            <MdFileDownload size={18} /> Exportar CSV
          </button>
          {isAdmin && (
            <>
              <button 
                onClick={handleSembrarServicios} 
                className="btn" 
                style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: '#805ad5', color: '#fff', border: 'none' }}
                title="Generar automáticamente los 5 servicios típicos de taller multinyectores"
              >
                ⚡ Cargar Servicios Estándar
              </button>
              <button 
                onClick={handleNuevoServicio} 
                className="btn" 
                style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: '#6b46c1', color: '#fff', border: 'none' }}
                title="Registrar nuevo servicio o mano de obra sin control de stock"
              >
                🛠️ + Nuevo Servicio
              </button>
              <button 
                onClick={handleNuevoProducto} 
                className="btn btn-principal" 
                style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: '#3182ce' }}
              >
                <MdAdd size={20} /> + Nuevo Producto
              </button>
            </>
          )}
        </div>
      </div>

      {/* KPI DASHBOARD METRICS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '20px' }}>
        <div className="card" style={{ padding: '16px', background: '#ffffff', borderRadius: '10px', borderLeft: '4px solid #3182ce', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: '12px', color: '#718096', textTransform: 'uppercase', fontWeight: 600 }}>Total Referencias</div>
          <div style={{ fontSize: '26px', fontWeight: 700, color: '#2d3748', marginTop: '4px' }}>{totalProductos}</div>
          <div style={{ fontSize: '12px', color: '#4a5568', marginTop: '2px' }}>Items en catálogo</div>
        </div>

        <div className="card" style={{ padding: '16px', background: '#ffffff', borderRadius: '10px', borderLeft: '4px solid #38a169', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: '12px', color: '#718096', textTransform: 'uppercase', fontWeight: 600 }}>Stock Físico Total</div>
          <div style={{ fontSize: '26px', fontWeight: 700, color: '#276749', marginTop: '4px' }}>{formatNumber(totalUnidades)} <span style={{ fontSize: '14px', fontWeight: 400 }}>unds</span></div>
          <div style={{ fontSize: '12px', color: '#4a5568', marginTop: '2px' }}>Unidades almacenadas</div>
        </div>

        <div 
          onClick={() => setFiltroStockCritico(!filtroStockCritico)}
          className="card" 
          style={{ 
            padding: '16px', 
            background: filtroStockCritico ? '#fff5f5' : '#ffffff', 
            borderRadius: '10px', 
            borderLeft: '4px solid #e53e3e', 
            cursor: 'pointer',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            transition: 'all 0.2s'
          }}
          title="Haz clic para filtrar productos en alerta de stock"
        >
          <div style={{ fontSize: '12px', color: '#718096', textTransform: 'uppercase', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            Stock Crítico <MdWarning color="#e53e3e" size={16} />
          </div>
          <div style={{ fontSize: '26px', fontWeight: 700, color: '#c53030', marginTop: '4px' }}>{productosCriticosCount}</div>
          <div style={{ fontSize: '12px', color: filtroStockCritico ? '#e53e3e' : '#718096', fontWeight: filtroStockCritico ? 600 : 400, marginTop: '2px' }}>
            {filtroStockCritico ? '⚡ Mostrando solo en alerta' : 'Haz clic para ver alertas'}
          </div>
        </div>

        {usuario?.rol !== 'vendedor' && (
          <div className="card" style={{ padding: '16px', background: '#ffffff', borderRadius: '10px', borderLeft: '4px solid #805ad5', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <div style={{ fontSize: '12px', color: '#718096', textTransform: 'uppercase', fontWeight: 600 }}>Valor Inventario</div>
            <div style={{ fontSize: '22px', fontWeight: 700, color: '#553c9a', marginTop: '4px' }}>{formatCurrency(valorInventario)}</div>
            <div style={{ fontSize: '12px', color: '#4a5568', marginTop: '2px' }}>Valoración de existencias</div>
          </div>
        )}
      </div>

      {/* NOTIFICATIONS */}
      {error && <div className="alert alert-error" style={{ marginBottom: '16px' }}>{error}</div>}
      {success && <div className="alert alert-success" style={{ marginBottom: '16px' }}>{success}</div>}

      {/* FILTERS TOOLBAR */}
      <div className="card" style={{ padding: '16px', marginBottom: '20px', borderRadius: '8px', background: '#f7fafc', border: '1px solid #e2e8f0' }}>
        
        {/* TIPO FILTER PILLS */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '14px', flexWrap: 'wrap' }}>
          <button 
            type="button" 
            onClick={() => setFiltroTipo('todos')} 
            className="btn" 
            style={{ 
              fontSize: '13px', 
              padding: '6px 14px', 
              fontWeight: 600,
              borderRadius: '20px',
              backgroundColor: filtroTipo === 'todos' ? '#2b6cb0' : '#edf2f7',
              color: filtroTipo === 'todos' ? '#ffffff' : '#4a5568',
              border: 'none'
            }}
          >
            📋 Todos ({productos.length})
          </button>
          <button 
            type="button" 
            onClick={() => setFiltroTipo('producto')} 
            className="btn" 
            style={{ 
              fontSize: '13px', 
              padding: '6px 14px', 
              fontWeight: 600,
              borderRadius: '20px',
              backgroundColor: filtroTipo === 'producto' ? '#3182ce' : '#edf2f7',
              color: filtroTipo === 'producto' ? '#ffffff' : '#4a5568',
              border: 'none'
            }}
          >
            📦 Repuestos / Productos ({cantProdFisicos})
          </button>
          <button 
            type="button" 
            onClick={() => setFiltroTipo('servicio')} 
            className="btn" 
            style={{ 
              fontSize: '13px', 
              padding: '6px 14px', 
              fontWeight: 600,
              borderRadius: '20px',
              backgroundColor: filtroTipo === 'servicio' ? '#6b46c1' : '#edf2f7',
              color: filtroTipo === 'servicio' ? '#ffffff' : '#4a5568',
              border: 'none'
            }}
          >
            🛠️ Servicios / Mano de Obra ({cantServicios})
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', alignItems: 'center' }}>
          
          {/* SEARCH INPUT */}
          <div style={{ position: 'relative', gridColumn: 'span 2' }}>
            <MdSearch style={{ position: 'absolute', left: '10px', top: '10px', color: '#a0aec0' }} size={20} />
            <input 
              type="text" 
              placeholder="Buscar por Nombre, OEM, Marca, Modelo, Bodega..." 
              value={search} 
              onChange={e => setSearch(e.target.value)} 
              className="input" 
              style={{ paddingLeft: '36px', width: '100%' }} 
            />
          </div>

          {/* CATEGORY FILTER */}
          <select value={filtroCategoria} onChange={e => setFiltroCategoria(e.target.value)} className="input">
            <option value="">Todas las categorías</option>
            {categorias.map(c => <option key={c} value={c}>{c}</option>)}
          </select>

          {/* BRAND FILTER */}
          <select value={filtroMarca} onChange={e => setFiltroMarca(e.target.value)} className="input">
            <option value="">Todas las marcas</option>
            {marcas.map(m => <option key={m} value={m}>{m}</option>)}
          </select>

          {/* WAREHOUSE SELECTOR (ADMIN) */}
          {isAdmin && (
            <select value={selectedAlmacen} onChange={e => setSelectedAlmacen(e.target.value)} className="input">
              <option value="">Todos los Almacenes</option>
              {almacenes.map(a => <option key={a.id} value={a.id}>{a.nombre || `Almacén ${a.id}`}</option>)}
            </select>
          )}

          {/* CRITICAL STOCK TOGGLE BUTTON */}
          <button 
            onClick={() => setFiltroStockCritico(!filtroStockCritico)}
            className="btn"
            style={{ 
              backgroundColor: filtroStockCritico ? '#fed7d7' : '#edf2f7', 
              color: filtroStockCritico ? '#9b2c2c' : '#4a5568',
              border: filtroStockCritico ? '1px solid #feb2b2' : '1px solid #cbd5e0',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
            }}
          >
            <MdWarning color={filtroStockCritico ? '#c53030' : '#718096'} size={16} /> 
            {filtroStockCritico ? 'Alertas Activas' : 'Stock Crítico'}
          </button>
        </div>
      </div>

      {/* PRODUCTS DATA TABLE */}
      <div className="card" style={{ padding: '0', borderRadius: '8px', overflow: 'hidden', border: '1px solid #e2e8f0' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="usuarios-table" style={{ width: '100%', fontSize: '14px', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#edf2f7', color: '#2d3748', textAlign: 'left' }}>
                <th style={{ padding: '12px 16px' }}>Producto / OEM</th>
                <th style={{ padding: '12px' }}>Categoría / Marca</th>
                <th style={{ padding: '12px' }}>Bodega</th>
                <th style={{ padding: '12px', textAlign: 'center' }}>Stock Total</th>
                <th style={{ padding: '12px', textAlign: 'right' }}>Precio Detal</th>
                <th style={{ padding: '12px', textAlign: 'right' }}>Precio Mayor</th>
                <th style={{ padding: '12px', textAlign: 'right' }}>Precio Almacén</th>
                {Array.isArray(productosFiltrados) && productosFiltrados.length > 0 && Array.isArray(productosFiltrados[0].almacenes) && productosFiltrados[0].almacenes.map(a => (
                  <th key={a.id} style={{ padding: '12px', textAlign: 'center', background: '#e2e8f0' }}>{a.nombre}</th>
                ))}
                {isAdmin && <th style={{ padding: '12px 16px', textAlign: 'center' }}>Acciones</th>}
              </tr>
            </thead>
            <tbody>
              {loading && productosFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={10} style={{ textAlign: 'center', padding: '30px', color: '#718096' }}>
                    <span className="loader" style={{ marginRight: '8px' }}></span> Cargando catálogo de productos...
                  </td>
                </tr>
              ) : productosFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={10} style={{ textAlign: 'center', padding: '30px', color: '#a0aec0' }}>
                    No se encontraron productos con los filtros seleccionados.
                  </td>
                </tr>
              ) : (
                productosFiltrados.map(p => {
                  const isServ = p.tipo === 'servicio' || (p.categoria && p.categoria.toLowerCase().includes('servicio'));
                  const stockTotal = Array.isArray(p.almacenes)
                    ? p.almacenes.reduce((acc, a) => acc + Number(a.stock || 0), 0)
                    : Number(p.stock || 0);

                  const minStock = (p.stock_minimo !== undefined && p.stock_minimo !== null && p.stock_minimo !== '') ? Number(p.stock_minimo) : 5;
                  const isCritico = !isServ && (stockTotal <= minStock || stockTotal <= 0);
                  const isBajo = !isServ && !isCritico && stockTotal <= (minStock * 1.5);

                  return (
                    <tr key={p.id} style={{ borderBottom: '1px solid #edf2f7', transition: 'background 0.15s' }}>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontWeight: 600, color: '#2d3748', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          {isServ ? <span style={{ color: '#6b46c1' }}>🛠️</span> : <span style={{ color: '#3182ce' }}>📦</span>}
                          {p.nombre}
                        </div>
                        <div style={{ fontSize: '12px', color: '#718096', display: 'flex', gap: '8px', marginTop: '2px' }}>
                          {p.codigo_oem && <span>OEM: <b>{p.codigo_oem}</b></span>}
                          {p.modelo && <span>Mod: {p.modelo}</span>}
                        </div>
                      </td>

                      <td style={{ padding: '12px' }}>
                        {isServ ? (
                          <span className="badge" style={{ backgroundColor: '#faf5ff', color: '#6b46c1', border: '1px solid #d6bcfa', fontSize: '11px', padding: '3px 8px', marginRight: '4px', fontWeight: 600 }}>
                            🛠️ Servicio
                          </span>
                        ) : (
                          <span className="badge badge-info" style={{ fontSize: '11px', padding: '3px 8px', marginRight: '4px' }}>
                            {p.categoria || 'Sin Cat.'}
                          </span>
                        )}
                        <div style={{ fontSize: '12px', color: '#4a5568', marginTop: '2px' }}>{p.marca || '-'}</div>
                      </td>

                      <td style={{ padding: '12px', fontSize: '13px', color: '#4a5568' }}>
                        {p.ubicacion_bodega ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <MdPlace size={14} color="#e53e3e" /> {p.ubicacion_bodega}
                          </span>
                        ) : isServ ? 'N/A (Taller)' : '-'}
                      </td>

                      <td style={{ padding: '12px', textAlign: 'center' }}>
                        {isServ ? (
                          <span style={{ 
                            fontSize: '12px', 
                            fontWeight: 600, 
                            color: '#6b46c1',
                            backgroundColor: '#faf5ff',
                            padding: '3px 10px',
                            borderRadius: '12px',
                            border: '1px solid #e9d8fd'
                          }}>
                            🛠️ Ilimitado
                          </span>
                        ) : (
                          <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center' }}>
                            <span style={{ 
                              fontSize: '15px', 
                              fontWeight: 700, 
                              color: isCritico ? '#e53e3e' : isBajo ? '#dd6b20' : '#28a745',
                              backgroundColor: isCritico ? '#fff5f5' : isBajo ? '#fffaf0' : '#f0fff4',
                              padding: '2px 10px',
                              borderRadius: '12px',
                              border: `1px solid ${isCritico ? '#feb2b2' : isBajo ? '#fbd38d' : '#c6f6d5'}`
                            }}>
                              {formatNumber(stockTotal)} {p.unidad_medida || 'und'}
                            </span>
                            {minStock > 0 && <span style={{ fontSize: '10px', color: '#a0aec0', marginTop: '2px' }}>Mín: {minStock}</span>}
                          </div>
                        )}
                      </td>

                      <td style={{ padding: '12px', textAlign: 'right', fontWeight: 600, color: '#2b6cb0' }}>
                        {formatCurrency(p.precio_detal ?? 0)}
                      </td>

                      <td style={{ padding: '12px', textAlign: 'right', color: '#2d3748' }}>
                        {formatCurrency(p.precio_mayor ?? 0)}
                      </td>

                      <td style={{ padding: '12px', textAlign: 'right', color: '#2d3748' }}>
                        {formatCurrency(p.precio_almacen ?? 0)}
                      </td>

                      {Array.isArray(p.almacenes) && p.almacenes.map(a => (
                        <td key={a.id} style={{ padding: '12px', textAlign: 'center', background: '#f8fafc' }}>
                          <span style={{ fontWeight: 600, color: a.stock <= minStock ? '#e53e3e' : '#2d3748' }}>
                            {formatNumber(a.stock)}
                          </span>
                        </td>
                      ))}

                      {isAdmin && (
                        <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                          <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                            <button 
                              className="btn" 
                              style={{ padding: '6px', background: '#ebf8ff', color: '#3182ce', border: '1px solid #bee3f8' }} 
                              onClick={() => handleEdit(p)} 
                              title="Editar información general"
                            >
                              <MdEdit size={16} />
                            </button>

                            <button 
                              className="btn" 
                              style={{ padding: '6px', background: '#feebc8', color: '#dd6b20', border: '1px solid #fbd38d' }} 
                              onClick={() => handleAsignar(p)} 
                              title="Asignar stock por almacén"
                            >
                              <FaWarehouse size={15} />
                            </button>

                            <button 
                              className="btn" 
                              style={{ padding: '6px', background: '#ebf8ff', color: '#2b6cb0', border: '1px solid #cbd5e0' }} 
                              onClick={() => handleVerKardex(p)} 
                              title="Ver Bitácora Kardex / Historial de Movimientos"
                            >
                              <MdHistory size={16} />
                            </button>

                            <button 
                              className="btn" 
                              style={{ padding: '6px', background: '#ebf8ff', color: '#2b6cb0', border: '1px solid #cbd5e0' }} 
                              onClick={() => handleAbrirAjuste(p)} 
                              title="Ajuste rápido de inventario"
                            >
                              <MdInventory size={16} />
                            </button>

                            <button 
                              className="btn" 
                              style={{ padding: '6px', background: '#e2e8f0', color: '#4a5568', border: '1px solid #cbd5e0' }} 
                              onClick={() => handleDuplicar(p)} 
                              title="Duplicar / Clonar producto"
                            >
                              <MdContentCopy size={16} />
                            </button>

                            <button 
                              className="btn" 
                              style={{ padding: '6px', background: '#fff5f5', color: '#e53e3e', border: '1px solid #fed7d7' }} 
                              onClick={() => handleDelete(p.id)} 
                              title="Archivar producto"
                            >
                              <MdDelete size={16} />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL EDITAR / CREAR PRODUCTO */}
      {isAdmin && showModal && (
        <div className="modal-backdrop">
          <div className="modal-card card" style={{ maxWidth: '800px', width: '100%', boxSizing: 'border-box' }}>
            <h3 style={{ marginTop: 0, color: form.tipo === 'servicio' ? '#6b46c1' : '#2b6cb0', borderBottom: '2px solid #ebf8ff', paddingBottom: '10px' }}>
              {productoEdit 
                ? (form.tipo === 'servicio' ? '✏️ Editar Servicio / Mano de Obra' : '✏️ Editar Producto') 
                : (form.tipo === 'servicio' ? '🛠️ Nuevo Servicio / Mano de Obra' : '📦 Nuevo Producto en Catálogo')}
            </h3>

            <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '14px', marginTop: '16px', width: '100%', boxSizing: 'border-box' }}>
              
              {/* TIPO PRODUCTO VS SERVICIO RADIO SELECTOR */}
              <div style={{ gridColumn: '1 / -1', display: 'flex', flexWrap: 'wrap', gap: '10px 16px', background: '#f7fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0', alignItems: 'center', width: '100%', boxSizing: 'border-box' }}>
                <span style={{ fontWeight: 600, fontSize: '13px', color: '#2d3748' }}>Tipo de Item:</span>
                <label style={{ fontWeight: 600, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', color: '#2b6cb0' }}>
                  <input 
                    type="radio" 
                    name="tipo" 
                    value="producto" 
                    checked={form.tipo !== 'servicio'} 
                    onChange={() => setForm(f => ({ ...f, tipo: 'producto' }))} 
                  />
                  📦 Producto Físico (Repuesto, Inyector, Bomba)
                </label>
                <label style={{ fontWeight: 600, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', color: '#6b46c1' }}>
                  <input 
                    type="radio" 
                    name="tipo" 
                    value="servicio" 
                    checked={form.tipo === 'servicio'} 
                    onChange={() => setForm(f => ({ ...f, tipo: 'servicio', categoria: 'Servicios', unidad_medida: 'Servicio', stock_minimo: '0' }))} 
                  />
                  🛠️ Servicio / Mano de Obra
                </label>
              </div>

              {/* SERVICIO PRESETS CHIPS */}
              {form.tipo === 'servicio' && (
                <div style={{ gridColumn: 'span 2', background: '#faf5ff', padding: '10px 14px', borderRadius: '8px', border: '1px solid #e9d8fd' }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: '#6b46c1', marginBottom: '6px' }}>⚡ Plantillas rápidas de servicios de taller:</div>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <button type="button" className="btn" style={{ fontSize: '12px', padding: '4px 10px', background: '#e9d8fd', color: '#553c9a', border: 'none', borderRadius: '14px', fontWeight: 600 }} onClick={() => setForm(f => ({ ...f, nombre: 'Mantenimiento e Inspección de Inyectores', precio_detal: '120000', costo: '20000', categoria: 'Servicios', unidad_medida: 'Servicio' }))}>🛠️ Mantenimiento Inyectores ($120k)</button>
                    <button type="button" className="btn" style={{ fontSize: '12px', padding: '4px 10px', background: '#e9d8fd', color: '#553c9a', border: 'none', borderRadius: '14px', fontWeight: 600 }} onClick={() => setForm(f => ({ ...f, nombre: 'Limpieza por Ultrasonido', precio_detal: '80000', costo: '15000', categoria: 'Servicios', unidad_medida: 'Servicio' }))}>🧪 Limpieza Ultrasonido ($80k)</button>
                    <button type="button" className="btn" style={{ fontSize: '12px', padding: '4px 10px', background: '#e9d8fd', color: '#553c9a', border: 'none', borderRadius: '14px', fontWeight: 600 }} onClick={() => setForm(f => ({ ...f, nombre: 'Calibración Banco Common Rail', precio_detal: '150000', costo: '30000', categoria: 'Servicios', unidad_medida: 'Servicio' }))}>📊 Calibración Banco ($150k)</button>
                    <button type="button" className="btn" style={{ fontSize: '12px', padding: '4px 10px', background: '#e9d8fd', color: '#553c9a', border: 'none', borderRadius: '14px', fontWeight: 600 }} onClick={() => setForm(f => ({ ...f, nombre: 'Mano de Obra Montaje/Desmontaje', precio_detal: '100000', costo: '0', categoria: 'Servicios', unidad_medida: 'Hora' }))}>👨‍🔧 Mano de Obra ($100k)</button>
                    <button type="button" className="btn" style={{ fontSize: '12px', padding: '4px 10px', background: '#e9d8fd', color: '#553c9a', border: 'none', borderRadius: '14px', fontWeight: 600 }} onClick={() => setForm(f => ({ ...f, nombre: 'Diagnóstico Electrónico Escáner', precio_detal: '70000', costo: '0', categoria: 'Servicios', unidad_medida: 'Servicio' }))}>💻 Escáner ($70k)</button>
                  </div>
                </div>
              )}

              <div className="form-field" style={{ gridColumn: 'span 2' }}>
                <label style={{ fontWeight: 600 }}>{form.tipo === 'servicio' ? 'Nombre del Servicio / Trabajo *' : 'Nombre del Producto *'}</label>
                <input name="nombre" className="input" value={form.nombre} onChange={handleChange} placeholder={form.tipo === 'servicio' ? 'Ej: Mantenimiento de Inyectores Bosch' : 'Ej: Inyector Bosch Common Rail Toyota Hilux 3.0'} required />
              </div>

              <div className="form-field">
                <label style={{ fontWeight: 600 }}>Categoría *</label>
                <select name="categoria" className="input" value={form.categoria} onChange={handleChange} required>
                  <option value="">Seleccionar Categoría</option>
                  <option value="Servicios">🛠️ Servicios y Mano de Obra</option>
                  <option value="Inyector">Inyector</option>
                  <option value="Bomba">Bomba de Alta Presión</option>
                  <option value="Microfiltro">Microfiltro / Filtro</option>
                  <option value="Bujías">Bujías Incandescentes</option>
                  <option value="Tobera">Tobera / Boquilla</option>
                  <option value="Válvula">Válvula Reguladora (SCV)</option>
                  <option value="Repuestos">Repuestos Generales</option>
                </select>
              </div>

              <div className="form-field">
                <label style={{ fontWeight: 600 }}>Código OEM / Referencia</label>
                <input name="codigo_oem" className="input" value={form.codigo_oem} onChange={handleChange} placeholder={form.tipo === 'servicio' ? 'Ej: SERV-001' : 'Ej: 0445110305'} />
              </div>

              <div className="form-field">
                <label style={{ fontWeight: 600 }}>Marca / Sistema</label>
                <input name="marca" className="input" value={form.marca} onChange={handleChange} placeholder="Ej: Bosch, Denso, Delphi, Stanadyne, Multinyectores" />
              </div>

              <div className="form-field">
                <label style={{ fontWeight: 600 }}>Modelo / Aplicación</label>
                <input name="modelo" className="input" value={form.modelo} onChange={handleChange} placeholder="Ej: Hilux 1KD-FTV / General" />
              </div>

              <div className="form-field" style={{ gridColumn: '1 / -1' }}>
                <label style={{ fontWeight: 600 }}>Compatibilidad de Vehículos / Observaciones</label>
                <input name="compatibilidad" className="input" value={form.compatibilidad} onChange={handleChange} placeholder="Ej: Válido para todos los motores Diesel Common Rail" />
              </div>

              {/* BODEGA & UNIDAD & PROVEEDOR */}
              {form.tipo !== 'servicio' ? (
                <>
                  <div className="form-field">
                    <label style={{ fontWeight: 600 }}>Ubicación en Bodega</label>
                    <input name="ubicacion_bodega" className="input" value={form.ubicacion_bodega} onChange={handleChange} placeholder="Ej: Estante B-12 / Pasillo 3" />
                  </div>

                  <div className="form-field">
                    <label style={{ fontWeight: 600 }}>Stock Mínimo Alerta</label>
                    <input name="stock_minimo" type="number" className="input" value={form.stock_minimo} onChange={handleChange} placeholder="Ej: 5" min="0" />
                  </div>

                  <div className="form-field">
                    <label style={{ fontWeight: 600 }}>Número de Lote (Opcional)</label>
                    <input name="lote" className="input" value={form.lote} onChange={handleChange} placeholder="Ej: LOTE-2026-08A" />
                  </div>

                  <div className="form-field">
                    <label style={{ fontWeight: 600 }}>Fecha de Vencimiento (Opcional)</label>
                    <input name="fecha_vencimiento" type="date" className="input" value={form.fecha_vencimiento} onChange={handleChange} />
                  </div>
                </>
              ) : (
                <div style={{ gridColumn: 'span 2', background: '#faf5ff', padding: '8px 12px', borderRadius: '6px', color: '#6b46c1', fontSize: '13px', fontWeight: 600 }}>
                  🛠️ Nota: Este servicio se registra como disponible ilimitado sin afectar existencias de inventario físico en bodega.
                </div>
              )}

              <div className="form-field">
                <label style={{ fontWeight: 600 }}>Unidad de Medida</label>
                <select name="unidad_medida" className="input" value={form.unidad_medida} onChange={handleChange}>
                  <option value="Servicio">Servicio (Serv)</option>
                  <option value="Hora">Hora (Hr)</option>
                  <option value="Trabajo">Trabajo (Trab)</option>
                  <option value="Unidad">Unidad (und)</option>
                  <option value="Juego">Juego (Jgo)</option>
                  <option value="Kit">Kit</option>
                  <option value="Caja">Caja</option>
                  <option value="Par">Par</option>
                </select>
              </div>

              <div className="form-field">
                <label style={{ fontWeight: 600 }}>Proveedor / Responsable</label>
                <input name="proveedor" className="input" value={form.proveedor} onChange={handleChange} placeholder={form.tipo === 'servicio' ? 'Ej: Taller Interno Multinyectores' : 'Ej: Importadora Diesel Corp'} />
              </div>

              {/* SECCIÓN DE PRECIOS & COSTOS */}
              <div style={{ gridColumn: '1 / -1', background: '#f7fafc', padding: '14px', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '12px', width: '100%', boxSizing: 'border-box' }}>
                <div style={{ width: '100%', boxSizing: 'border-box' }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: '#4a5568', display: 'block', marginBottom: '4px' }}>Costo Compra ($)</label>
                  <input ref={costoRef} name="costo" className="input" defaultValue={form.costo} placeholder="Costo" type="text" inputMode="numeric" style={{ width: '100%', boxSizing: 'border-box' }} />
                </div>
                <div style={{ width: '100%', boxSizing: 'border-box' }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: '#2b6cb0', display: 'block', marginBottom: '4px' }}>Precio Detal ($)</label>
                  <input ref={precioDetalRef} name="precio_detal" className="input" defaultValue={form.precio_detal} placeholder="Detal" type="text" inputMode="numeric" style={{ width: '100%', boxSizing: 'border-box' }} />
                </div>
                <div style={{ width: '100%', boxSizing: 'border-box' }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: '#2d3748', display: 'block', marginBottom: '4px' }}>Precio Mayor ($)</label>
                  <input ref={precioMayorRef} name="precio_mayor" className="input" defaultValue={form.precio_mayor} placeholder="Mayorista" type="text" inputMode="numeric" style={{ width: '100%', boxSizing: 'border-box' }} />
                </div>
                <div style={{ width: '100%', boxSizing: 'border-box' }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: '#2d3748', display: 'block', marginBottom: '4px' }}>Precio Almacén ($)</label>
                  <input ref={precioAlmacenRef} name="precio_almacen" className="input" defaultValue={form.precio_almacen} placeholder="Almacén" type="text" inputMode="numeric" style={{ width: '100%', boxSizing: 'border-box' }} />
                </div>
              </div>

              {marginVal !== null && (
                <div style={{ gridColumn: '1 / -1', fontSize: '13px', color: Number(marginVal) >= 20 ? '#276749' : '#c53030', fontWeight: 600 }}>
                  📈 Margen estimado al detal: {marginVal}%
                </div>
              )}

              {/* FOTO */}
              <div style={{ gridColumn: '1 / -1', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px', width: '100%', boxSizing: 'border-box' }}>
                <div>
                  <label style={{ fontWeight: 600, display: 'block' }}>Fotografía del Repuesto</label>
                  <input type="file" accept="image/*" onChange={handleFile} />
                </div>
                {preview && <img src={preview} alt="Vista Previa" style={{ height: '50px', borderRadius: '6px', border: '1px solid #cbd5e0' }} />}
              </div>

              {formError && <div className="alert alert-error" style={{ gridColumn: '1 / -1' }}>{formError}</div>}

              <div style={{ gridColumn: '1 / -1', display: 'flex', flexWrap: 'wrap', gap: '12px', justifyContent: 'flex-end', marginTop: '12px', width: '100%', boxSizing: 'border-box' }}>
                <button type="button" className="btn btn-secundario" onClick={handleCancelEdit}>Cancelar</button>
                <button type="submit" disabled={loading} className="btn btn-principal" style={{ backgroundColor: '#3182ce' }}>
                  {loading ? 'Guardando...' : 'Guardar Producto'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* MODAL ASIGNAR STOCK POR ALMACÉN */}
      {isAdmin && showAsignar && productoAsignar && (
        <div className="modal-backdrop">
          <div className="modal-card card" style={{ maxWidth: '550px', width: '90%' }}>
            <h3 style={{ marginTop: 0, color: '#2b6cb0' }}>🏢 Distribución de Stock por Almacén</h3>
            <p style={{ fontSize: '14px', color: '#4a5568', margin: '4px 0 16px 0' }}>
              <b>Producto:</b> {productoAsignar.nombre}
            </p>

            <form onSubmit={async (e) => {
              e.preventDefault();
              setAsignarError('');
              const asignaciones = [];
              const list = productoAsignar?.almacenes || [];
              for (const a of list) {
                const el = stockRefs.current[a.id];
                const raw = el ? el.value : stocksAsignar[a.id];
                const n = Number(String(raw || 0).replace(/[^0-9]/g, ''));
                asignaciones.push({ almacenId: a.id, stock: Math.floor(n) });
              }

              try {
                setAsignarLoading(true);
                const res = await fetch(`/productos/${productoAsignar.id}/asignar-almacenes`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                  },
                  body: JSON.stringify({ asignaciones })
                });
                if (!res.ok) throw new Error('Error al asignar');
                setShowAsignar(false);
                setSuccess('Stock por almacén actualizado exitosamente.');
                cargarProductos();
              } catch (err) {
                setAsignarError('Error al guardar existencias');
              } finally {
                setAsignarLoading(false);
              }
            }}>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '300px', overflowY: 'auto' }}>
                {(productoAsignar.almacenes || []).map(a => (
                  <div key={a.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px', background: '#f7fafc', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                    <span style={{ fontWeight: 600, color: '#2d3748' }}>{a.nombre || `Almacén ${a.id}`}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <label style={{ fontSize: '12px', color: '#718096' }}>Stock:</label>
                      <input 
                        ref={el => { stockRefs.current[a.id] = el; }}
                        type="number"
                        min="0"
                        defaultValue={stocksAsignar[a.id] !== undefined ? stocksAsignar[a.id] : (a.stock || 0)}
                        className="input"
                        style={{ width: '90px', textAlign: 'center' }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              {asignarError && <div className="alert alert-error" style={{ marginTop: '12px' }}>{asignarError}</div>}

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '20px' }}>
                <button type="button" className="btn btn-secundario" onClick={() => setShowAsignar(false)}>Cancelar</button>
                <button type="submit" disabled={asignarLoading} className="btn btn-principal">
                  {asignarLoading ? 'Guardando...' : 'Guardar Inventario'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL AJUSTE RÁPIDO DE INVENTARIO */}
      {isAdmin && showAjusteModal && productoAjuste && (
        <div className="modal-backdrop">
          <div className="modal-card card" style={{ maxWidth: '480px', width: '90%' }}>
            <h3 style={{ marginTop: 0, color: '#2b6cb0' }}>📊 Ajuste Rápido de Stock</h3>
            <p style={{ fontSize: '14px', color: '#4a5568', margin: '4px 0 16px 0' }}>
              <b>Producto:</b> {productoAjuste.nombre}
            </p>

            <form onSubmit={handleGuardarAjuste} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className="form-field">
                <label style={{ fontWeight: 600 }}>Almacén a ajustar</label>
                <select 
                  className="input" 
                  value={almacenAjusteId} 
                  onChange={e => {
                    setAlmacenAjusteId(e.target.value);
                    const pa = Array.isArray(productoAjuste.almacenes) ? productoAjuste.almacenes.find(x => String(x.id) === String(e.target.value)) : null;
                    setNuevoStockVal(pa ? String(pa.stock) : '0');
                  }}
                >
                  {almacenes.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
                </select>
              </div>

              <div className="form-field">
                <label style={{ fontWeight: 600 }}>Nueva Cantidad en Stock</label>
                <input 
                  type="number" 
                  min="0" 
                  className="input" 
                  value={nuevoStockVal} 
                  onChange={e => setNuevoStockVal(e.target.value)} 
                  required 
                />
              </div>

              <div className="form-field">
                <label style={{ fontWeight: 600 }}>Motivo del Ajuste</label>
                <select className="input" value={motivoAjuste} onChange={e => setMotivoAjuste(e.target.value)}>
                  <option value="Ingreso por compra">Ingreso por compra de lote</option>
                  <option value="Conteo físico e inventario">Conteo físico e inventario</option>
                  <option value="Ajuste por garantía o daño">Ajuste por garantía o daño</option>
                  <option value="Devolución de cliente">Devolución de cliente</option>
                  <option value="Ajuste administrativo">Ajuste administrativo</option>
                </select>
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '12px' }}>
                <button type="button" className="btn btn-secundario" onClick={() => setShowAjusteModal(false)}>Cancelar</button>
                <button type="submit" disabled={ajusteLoading} className="btn btn-principal">
                  {ajusteLoading ? 'Procesando...' : 'Confirmar Ajuste'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL KARDEX / HISTORIAL DE MOVIMIENTOS */}
      {showKardexModal && productoKardex && (
        <div className="modal-backdrop">
          <div className="modal-card card" style={{ maxWidth: '850px', width: '90%', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #ebf8ff', paddingBottom: '10px' }}>
              <div>
                <h3 style={{ margin: 0, color: '#2b6cb0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  📋 Bitácora Kardex - {productoKardex.nombre}
                </h3>
                <span style={{ fontSize: '13px', color: '#718096' }}>
                  OEM: {productoKardex.codigo_oem || 'N/A'} | Marca: {productoKardex.marca || 'N/A'}
                </span>
              </div>
              <button onClick={() => setShowKardexModal(false)} className="btn btn-secundario" style={{ padding: '4px 8px' }}>
                ✕
              </button>
            </div>

            <div style={{ marginTop: '16px' }}>
              <div style={{ overflowX: 'auto' }}>
                <table className="usuarios-table" style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#edf2f7', color: '#2d3748' }}>
                      <th style={{ padding: '10px' }}>Fecha / Hora</th>
                      <th style={{ padding: '10px' }}>Tipo Movimiento</th>
                      <th style={{ padding: '10px', textAlign: 'center' }}>Cantidad</th>
                      <th style={{ padding: '10px', textAlign: 'center' }}>Stock Resultante</th>
                      <th style={{ padding: '10px' }}>Almacén / Bodega</th>
                      <th style={{ padding: '10px' }}>Descripción / Referencia</th>
                      <th style={{ padding: '10px' }}>Usuario</th>
                    </tr>
                  </thead>
                  <tbody>
                    {kardexLoading ? (
                      <tr>
                        <td colSpan={7} style={{ textAlign: 'center', padding: '24px', color: '#718096' }}>
                          Cargando movimientos de Kardex...
                        </td>
                      </tr>
                    ) : kardexList.length === 0 ? (
                      <tr>
                        <td colSpan={7} style={{ textAlign: 'center', padding: '24px', color: '#a0aec0' }}>
                          No hay movimientos registrados aún para este producto.
                        </td>
                      </tr>
                    ) : (
                      kardexList.map(k => {
                        const isEntrada = k.tipo_movimiento === 'entrada' || k.cantidad > 0;
                        return (
                          <tr key={k.id} style={{ borderBottom: '1px solid #edf2f7' }}>
                            <td style={{ padding: '10px', whiteSpace: 'nowrap', color: '#4a5568' }}>
                              {k.fecha ? new Date(k.fecha).toLocaleString('es-CO') : '-'}
                            </td>
                            <td style={{ padding: '10px' }}>
                              <span style={{
                                fontSize: '11px',
                                fontWeight: 600,
                                padding: '3px 8px',
                                borderRadius: '10px',
                                background: isEntrada ? '#f0fff4' : '#fff5f5',
                                color: isEntrada ? '#276749' : '#c53030',
                                border: `1px solid ${isEntrada ? '#c6f6d5' : '#feb2b2'}`
                              }}>
                                {isEntrada ? '📥 ' : '📤 '}{k.tipo_movimiento || 'movimiento'}
                              </span>
                            </td>
                            <td style={{ padding: '10px', textAlign: 'center', fontWeight: 700, color: isEntrada ? '#276749' : '#c53030' }}>
                              {isEntrada ? `+${k.cantidad}` : k.cantidad}
                            </td>
                            <td style={{ padding: '10px', textAlign: 'center', fontWeight: 600 }}>
                              {k.stock_resultante !== undefined ? k.stock_resultante : '-'}
                            </td>
                            <td style={{ padding: '10px', color: '#4a5568' }}>
                              {k.almacen ? k.almacen.nombre : `Almacén #${k.almacen_id}`}
                            </td>
                            <td style={{ padding: '10px', color: '#2d3748' }}>
                              {k.descripcion || k.referencia || '-'}
                            </td>
                            <td style={{ padding: '10px', color: '#718096' }}>
                              {k.usuario ? k.usuario.nombre : (k.usuario_nombre || '-')}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn btn-secundario" onClick={() => setShowKardexModal(false)}>Cerrar Bitácora</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default Productos;
