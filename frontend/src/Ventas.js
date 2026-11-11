import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { parsePrecio, formatCurrency, formatNumber, hoyColombia } from './utils/formatters';
import { toast } from 'react-toastify';
import FieldError from './components/FieldError';

// Icons
import { 
  MdAddShoppingCart, MdRemoveShoppingCart, MdSave, MdCancel, MdPerson,
  MdSearch, MdRefresh, MdReceipt, MdCheckCircle, MdBlock, MdFilterList,
  MdPrint, MdStore, MdAttachMoney, MdShowChart, MdDateRange, MdMoreVert,
  MdClose, MdInfo, MdLocalShipping, MdCreditCard, MdAccountBalanceWallet
} from 'react-icons/md';
import { FaFileExcel, FaFilePdf, FaPlus, FaShoppingBag, FaUserCheck, FaWarehouse, FaFileInvoiceDollar, FaWhatsapp } from 'react-icons/fa';

import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { createDoc, tableToPdf, savePdf } from './utils/pdfUtils';
import WhatsAppModal from './components/WhatsAppModal';
import { buildWhatsAppDocumentMessage } from './utils/whatsapp';
import { puede } from './config/permisos';

function Ventas({ usuario, onNavigate }) {
  // Main Data States
  const [ventas, setVentas] = useState([]);
  const [productos, setProductos] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [almacenes, setAlmacenes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Filtering States
  const [search, setSearch] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('Todos');
  const [filtroAlmacen, setFiltroAlmacen] = useState('Todos');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');

  // Modal Nueva Venta / POS State
  const [showNuevaVentaModal, setShowNuevaVentaModal] = useState(false);
  const [form, setForm] = useState({
    clienteId: '',
    clienteNombre: '',
    productoId: '',
    productoNombre: '',
    cantidad: 1,
    precioServicio: '',
    descuento: 0,
    impuestos: 0,
    metodoPago: 'Efectivo',
    almacenId: usuario?.almacenId || 1,
    notas: '',
    vendedor: usuario?.nombre || '',
    estado: 'Pendiente',
    fecha: hoyColombia()
  });
  const [carrito, setCarrito] = useState([]);
  const [fieldErrors, setFieldErrors] = useState({});
  const [modalError, setModalError] = useState('');
  const [savingVenta, setSavingVenta] = useState(false);

  // Modal Comprobante / Ticket
  const [showComprobanteModal, setShowComprobanteModal] = useState(false);
  const [comprobanteData, setComprobanteData] = useState(null);
  const [loadingComprobante, setLoadingComprobante] = useState(false);

  // Modal WhatsApp Directo
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [whatsAppData, setWhatsAppData] = useState(null);

  // Modal Anulación Venta
  const [showAnularModal, setShowAnularModal] = useState(false);
  const [ventaAAnular, setVentaAAnular] = useState(null);
  const [motivoAnulacion, setMotivoAnulacion] = useState('');
  const [anulando, setAnulando] = useState(false);

  const isAdmin = puede(usuario, 'almacenes.gestionar');
  const tokenHeader = useMemo(() => `Bearer ${usuario?.token || localStorage.getItem('token') || ''}`, [usuario?.token]);

  // Fetch Ventas con Filtros
  const fetchVentas = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      let url = '/ventas?';
      const params = new URLSearchParams();

      if (filtroEstado !== 'Todos') params.append('estado', filtroEstado);
      if (filtroAlmacen !== 'Todos') params.append('almacenId', filtroAlmacen);
      else if (!isAdmin && usuario?.almacenId) params.append('almacenId', usuario.almacenId);

      if (fechaInicio) params.append('fechaInicio', fechaInicio);
      if (fechaFin) params.append('fechaFin', fechaFin);
      if (search.trim()) params.append('q', search.trim());

      url += params.toString();

      const res = await fetch(url, { headers: { 'Authorization': tokenHeader } });
      if (!res.ok) throw new Error('Error al consultar el historial de ventas');
      const data = await res.json();
      setVentas(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || 'Error de conexión al obtener ventas');
      setVentas([]);
    } finally {
      setLoading(false);
    }
  }, [filtroEstado, filtroAlmacen, fechaInicio, fechaFin, search, isAdmin, usuario?.almacenId, tokenHeader]);

  // Cargar catalogos auxiliares
  useEffect(() => {
    fetchVentas();

    // Cargar productos
    fetch('/productos', { headers: { 'Authorization': tokenHeader } })
      .then(r => r.json())
      .then(data => setProductos(Array.isArray(data) ? data : []))
      .catch(() => {});

    // Cargar clientes
    fetch('/clientes', { headers: { 'Authorization': tokenHeader } })
      .then(r => r.json())
      .then(data => setClientes(Array.isArray(data) ? data : []))
      .catch(() => {});

    // Cargar almacenes
    fetch('/almacenes', { headers: { 'Authorization': tokenHeader } })
      .then(r => r.json())
      .then(data => setAlmacenes(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, [fetchVentas, tokenHeader]);

  // Autocompletar vendedor
  useEffect(() => {
    if (usuario?.nombre) {
      setForm(f => ({ ...f, vendedor: usuario.nombre, almacenId: usuario.almacenId || 1 }));
    }
  }, [usuario]);

  // Datos del cliente seleccionado en el formulario de nueva venta
  const clienteSeleccionado = useMemo(() => {
    return clientes.find(c => String(c.id) === String(form.clienteId));
  }, [clientes, form.clienteId]);

  // Producto o servicio actualmente enfocado/seleccionado en el buscador
  const productoSeleccionado = useMemo(() => {
    if (!form.productoNombre && !form.productoId) return null;
    let found = productos.find(p => String(p.id) === String(form.productoId));
    if (!found && form.productoNombre) {
      const searchVal = form.productoNombre.trim().toLowerCase();
      found = productos.find(p => 
        p.nombre.toLowerCase() === searchVal || 
        (p.codigo_oem && p.codigo_oem.toLowerCase() === searchVal)
      );
    }
    return found;
  }, [productos, form.productoId, form.productoNombre]);

  const esServicioSeleccionado = useMemo(() => {
    if (!productoSeleccionado) return false;
    return productoSeleccionado.tipo === 'servicio' || 
      (productoSeleccionado.categoria && productoSeleccionado.categoria.toLowerCase().includes('servicio'));
  }, [productoSeleccionado]);

  // Selección de Producto o Servicio para agregar al carrito
  const handleAgregarProducto = () => {
    setModalError('');
    const errs = {};

    if (!form.productoNombre || !form.productoNombre.trim()) {
      errs.producto = 'Escriba o seleccione un producto o servicio';
      setFieldErrors(errs);
      setModalError('❌ Debe seleccionar o escribir el nombre de un producto o servicio.');
      return;
    }

    if (!form.cantidad || Number(form.cantidad) <= 0) {
      errs.cantidad = 'Cantidad debe ser mayor a 0';
      setFieldErrors(errs);
      setModalError('❌ Ingrese una cantidad válida mayor a 0.');
      return;
    }

    // Buscar producto o servicio en catálogo
    let prod = productoSeleccionado;
    if (!prod) {
      const searchVal = form.productoNombre.trim().toLowerCase();
      prod = productos.find(p => 
        p.nombre.toLowerCase() === searchVal || 
        (p.codigo_oem && p.codigo_oem.toLowerCase() === searchVal) ||
        searchVal.startsWith(p.nombre.toLowerCase())
      );
    }

    if (!prod) {
      setFieldErrors({ producto: 'Ítem no encontrado' });
      setModalError(`❌ No se encontró el ítem "${form.productoNombre}". Selecciónelo de la lista emergente.`);
      return;
    }

    const isServicio = prod.tipo === 'servicio' || (prod.categoria && prod.categoria.toLowerCase().includes('servicio'));

    // Si es un SERVICIO: Es obligatorio colocar el valor del trabajo
    if (isServicio) {
      const valorNum = Number(form.precioServicio);
      if (!form.precioServicio || isNaN(valorNum) || valorNum <= 0) {
        setFieldErrors({ precioServicio: 'Debe colocar el valor del servicio' });
        setModalError(`❌ El ítem "${prod.nombre}" es un SERVICIO. Ingrese el valor a cobrar por este trabajo (ej: mantenimiento o calibración).`);
        return;
      }
    }

    // Verificar stock según almacén solo si es un repuesto físico
    const almacenAct = form.almacenId || 1;
    let stockBodega = prod.stock || 0;
    if (Array.isArray(prod.almacenes)) {
      const almMatch = prod.almacenes.find(a => Number(a.id) === Number(almacenAct));
      if (almMatch && almMatch.stock !== undefined) {
        stockBodega = Number(almMatch.stock || 0);
      }
    }

    const enCarrito = carrito.find(item => item.productoId === prod.id && Number(item.almacenId) === Number(almacenAct));
    const cantExistente = enCarrito ? Number(enCarrito.cantidad) : 0;
    const cantSolicitada = cantExistente + Number(form.cantidad);

    if (!isServicio) {
      if (stockBodega <= 0) {
        setModalError(`❌ No se puede agregar "${prod.nombre}". No hay stock disponible en esta bodega (Stock actual: 0).`);
        return;
      }
      if (cantSolicitada > stockBodega) {
        setModalError(`❌ Stock insuficiente para "${prod.nombre}" en esta bodega. Stock disponible: ${stockBodega}, en carrito: ${cantExistente}, intentas agregar: ${form.cantidad}.`);
        return;
      }
    }

    // Determinar precio final: Si es servicio se usa el valor ingresado; si es repuesto físico se toma de lista
    let precioFinal = 0;
    if (isServicio) {
      precioFinal = Number(form.precioServicio);
    } else {
      let precioBase = prod.precio_detal || prod.precio || 0;
      if (clienteSeleccionado) {
        if (clienteSeleccionado.tipo_cliente === 'Mayor' && prod.precio_mayor) precioBase = prod.precio_mayor;
        else if (clienteSeleccionado.tipo_cliente === 'Almacén' && prod.precio_almacen) precioBase = prod.precio_almacen;
        else if (clienteSeleccionado.tipo_cliente === 'Detal' && prod.precio_detal) precioBase = prod.precio_detal;
      }
      precioFinal = parsePrecio(precioBase) || Number(precioBase) || 0;
    }

    setCarrito(prev => {
      // Para repuestos físicos agrupamos por productoId y almacén.
      // Para servicios agrupamos si tienen el mismo valor unitario.
      const idx = prev.findIndex(item => 
        item.productoId === prod.id && 
        Number(item.almacenId) === Number(almacenAct) &&
        (!isServicio || item.precio === precioFinal)
      );

      if (idx >= 0) {
        const copy = [...prev];
        copy[idx].cantidad += Number(form.cantidad);
        return copy;
      }

      return [
        ...prev,
        {
          productoId: prod.id,
          nombre: prod.nombre,
          codigo_oem: prod.codigo_oem,
          precio: precioFinal,
          cantidad: Number(form.cantidad),
          almacenId: almacenAct,
          stockDisponible: stockBodega,
          isServicio: isServicio
        }
      ];
    });

    setForm(f => ({ ...f, productoId: '', productoNombre: '', cantidad: 1, precioServicio: '' }));
    setFieldErrors({});
    setModalError('');
  };

  const handleQuitarProducto = (index) => {
    setCarrito(prev => prev.filter((_, idx) => idx !== index));
  };

  const handleCambiarCantidad = (index, nuevaCant) => {
    const num = Math.max(1, Number(nuevaCant) || 1);
    setCarrito(prev => prev.map((item, idx) => {
      if (idx === index) {
        if (!item.isServicio && num > item.stockDisponible) {
          setModalError(`❌ No hay suficiente stock para "${item.nombre}". Stock disponible: ${item.stockDisponible}`);
          return { ...item, cantidad: item.stockDisponible };
        }
        return { ...item, cantidad: num };
      }
      return item;
    }));
  };

  const handleCambiarPrecio = (index, nuevoPrecio) => {
    const val = Math.max(0, Number(nuevoPrecio) || 0);
    setCarrito(prev => prev.map((item, idx) => {
      if (idx === index) {
        return { ...item, precio: val };
      }
      return item;
    }));
  };

  // Totales de la Venta actual en Formulario
  const subtotalCarrito = carrito.reduce((acc, item) => acc + (item.precio * item.cantidad), 0);
  const montoDescuento = subtotalCarrito * (Number(form.descuento) || 0) / 100;
  const montoImpuestos = subtotalCarrito * (Number(form.impuestos) || 0) / 100;
  const totalCarrito = subtotalCarrito - montoDescuento + montoImpuestos;

  // Guardar Venta
  const handleGuardarVenta = async (e) => {
    e.preventDefault();
    if (!form.clienteId) {
      toast.error('Debe seleccionar un cliente para registrar la venta');
      return;
    }
    if (carrito.length === 0) {
      toast.error('El carrito de la venta está vacío');
      return;
    }

    setSavingVenta(true);
    try {
      const clienteObj = clientes.find(c => String(c.id) === String(form.clienteId));
      const isCotiz = form.estado === 'Cotizacion';
      const body = {
        clienteId: form.clienteId,
        cliente: clienteObj ? clienteObj.nombre : form.clienteNombre,
        detalles: carrito.map(item => ({
          productoId: item.productoId,
          cantidad: item.cantidad,
          precio: item.precio,
          almacenId: item.almacenId
        })),
        descuento: Number(form.descuento) || 0,
        impuestos: Number(form.impuestos) || 0,
        metodoPago: form.metodoPago,
        almacenId: form.almacenId,
        notas: form.notas,
        vendedor: form.vendedor || usuario?.nombre || 'Vendedor',
        estado: isCotiz ? 'Pendiente' : form.estado,
        esCotizacion: isCotiz,
        fecha: form.fecha
      };

      const res = await fetch('/ventas', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': tokenHeader
        },
        body: JSON.stringify(body)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al procesar la venta');

      const msg = form.estado === 'Pendiente'
        ? '¡Venta registrada como PENDIENTE! Lista en el módulo Facturación para validar y certificar ingreso de dinero.'
        : '¡Venta registrada con éxito!';
      toast.success(msg, { autoClose: 4000 });
      setShowNuevaVentaModal(false);
      setCarrito([]);
      setForm(f => ({
        ...f,
        clienteId: '',
        clienteNombre: '',
        productoId: '',
        productoNombre: '',
        cantidad: 1,
        descuento: 0,
        impuestos: 0,
        estado: 'Pendiente',
        notas: ''
      }));

      fetchVentas();

      // Mostrar comprobante automáticamente
      if (data.venta && data.venta.id) {
        handleVerComprobante(data.venta.id);
      }
    } catch (err) {
      setModalError(err.message);
      toast.error(err.message);
    } finally {
      setSavingVenta(false);
    }
  };

  // Marcar Pagada
  const handleMarcarPagada = async (ventaId) => {
    try {
      const res = await fetch(`/ventas/${ventaId}/pagar`, {
        method: 'PUT',
        headers: { 'Authorization': tokenHeader }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'No se pudo actualizar la venta');

      toast.success('Venta marcada como pagada');
      fetchVentas();
    } catch (err) {
      toast.error(err.message);
    }
  };

  // Convertir Cotización a Factura/Venta
  const handleConvertirCotizacion = async (ventaId) => {
    try {
      const res = await fetch(`/ventas/${ventaId}/convertir-factura`, {
        method: 'POST',
        headers: { 'Authorization': tokenHeader }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'No se pudo convertir la cotización a factura');

      toast.success('¡Cotización convertida a Venta/Factura y stock descontado exitosamente!');
      fetchVentas();
    } catch (err) {
      toast.error(err.message);
    }
  };

  // Abrir Modal de Anulación
  const handleAbrirAnular = (venta) => {
    if (venta.estado === 'Anulada') {
      toast.info('La venta ya está anulada.');
      return;
    }
    setVentaAAnular(venta);
    setMotivoAnulacion('');
    setShowAnularModal(true);
  };

  // Confirmar Anulación
  const handleConfirmarAnulacion = async () => {
    if (!ventaAAnular) return;
    if (!motivoAnulacion || !motivoAnulacion.trim()) {
      toast.warning('El motivo de anulación es obligatorio');
      return;
    }
    setAnulando(true);
    try {
      const res = await fetch(`/ventas/${ventaAAnular.id}/anular`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': tokenHeader
        },
        body: JSON.stringify({ motivoAnulacion: motivoAnulacion.trim() })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al anular la venta');

      toast.success('Venta anulada y stock devuelto a bodega.');
      setShowAnularModal(false);
      fetchVentas();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setAnulando(false);
    }
  };

  // Ver Comprobante / Ticket
  const handleVerComprobante = async (ventaId) => {
    setLoadingComprobante(true);
    setShowComprobanteModal(true);
    try {
      const res = await fetch(`/ventas/${ventaId}/comprobante`, {
        headers: { 'Authorization': tokenHeader }
      });
      if (!res.ok) throw new Error('No se pudo obtener el comprobante');
      const data = await res.json();
      setComprobanteData(data);
    } catch (err) {
      toast.error(err.message);
      setShowComprobanteModal(false);
    } finally {
      setLoadingComprobante(false);
    }
  };

  // Imprimir Ticket
  const handleImprimirTicket = () => {
    window.print();
  };

  // Abrir Modal de Envío por WhatsApp
  const handleAbrirWhatsAppVenta = async (v, empData) => {
    if (!v) return;
    let ventaFull = v;
    let emp = empData;

    // Si no tiene los detalles cargados, consultar endpoint de comprobante
    if (!ventaFull.DetalleVentas || ventaFull.DetalleVentas.length === 0) {
      try {
        const res = await fetch(`/ventas/${v.id}/comprobante`, {
          headers: { 'Authorization': tokenHeader }
        });
        if (res.ok) {
          const data = await res.json();
          if (data.venta) ventaFull = data.venta;
          if (data.empresa && !emp) emp = data.empresa;
        }
      } catch (e) {
        console.warn('Error al cargar datos completos para WhatsApp:', e);
      }
    }

    const isCotiz = ventaFull.es_cotizacion || ventaFull.estado === 'Cotizacion' || (ventaFull.notas && ventaFull.notas.toLowerCase().includes('cotiz'));
    const tipoDoc = isCotiz ? 'Cotización' : 'Comprobante de Venta';
    const numero = isCotiz ? `COT-${ventaFull.id}` : `VEN-${ventaFull.id}`;
    const clienteNombre = ventaFull.Cliente?.nombre || ventaFull.cliente || 'Cliente General';
    const clienteTel = ventaFull.Cliente?.telefono || ventaFull.Cliente?.celular || ventaFull.telefono || '';
    const tokenVenta = ventaFull.token_publico || ventaFull.id;
    const publicUrl = `${window.location.origin}/ventas/public/${tokenVenta}`;
    const empFinal = emp || { nombre: 'Multinyectores Colombia', direccion: 'Tuluá - Valle del Cauca', telefono: '(602) 224-5000' };

    const mensaje = buildWhatsAppDocumentMessage({
      tipoDoc,
      numero,
      cliente: clienteNombre,
      fecha: ventaFull.fecha,
      total: ventaFull.total,
      metodoPago: ventaFull.metodoPago || 'Efectivo',
      estado: ventaFull.estado || 'Completada',
      items,
      empresa: empFinal,
      notas: ventaFull.notas,
      publicUrl
    });

    setWhatsAppData({
      tipoDoc,
      numero,
      cliente: clienteNombre,
      documento: ventaFull.Cliente?.documento || ventaFull.documento || '',
      direccion: ventaFull.direccion || ventaFull.Cliente?.direccion || '',
      telefono: clienteTel,
      bodega: ventaFull.almacen?.nombre || 'Sede Principal',
      metodoPago: ventaFull.metodoPago || 'Efectivo',
      fecha: ventaFull.fecha,
      items,
      total: ventaFull.total,
      descuento: ventaFull.descuento || 0,
      impuestos: ventaFull.impuestos || 0,
      notas: ventaFull.notas,
      empresa: empFinal,
      publicUrl,
      mensaje
    });
    setShowWhatsAppModal(true);
  };

  // Exportar Excel
  const exportExcel = () => {
    const data = ventas.map(v => {
      const detalles = v.DetalleVentas || v.DetalleVenta || [];
      return {
        'No. Venta': `VEN-${v.id}`,
        'Fecha': v.fecha ? new Date(v.fecha).toLocaleString('es-CO', { timeZone: 'America/Bogota' }) : '',
        'Cliente': v.Cliente?.nombre || v.clienteId,
        'Documento': v.Cliente?.documento || '',
        'Almacén': v.almacen?.nombre || 'Sede Principal',
        'Vendedor': v.vendedor || 'Sistema',
        'Método Pago': v.metodoPago || 'Efectivo',
        'Estado': v.estado || 'Pagada',
        'Artículos': detalles.reduce((acc, d) => acc + Number(d.cantidad || 0), 0),
        'Total Neto': Number(v.total || 0)
      };
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Historial_Ventas');
    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { type: 'application/octet-stream' });
    saveAs(blob, `Reporte_Ventas_${hoyColombia()}.xlsx`);
  };

  // Exportar PDF
  const exportPDF = () => {
    const doc = createDoc();
    doc.text('MULTINYECTORES - HISTORIAL DE VENTAS', 14, 16);
    tableToPdf(doc, {
      startY: 22,
      head: [['No.', 'Fecha', 'Cliente', 'Bodega', 'Método', 'Estado', 'Total']],
      body: ventas.map(v => [
        `#${v.id}`,
        v.fecha ? v.fecha.slice(0, 10) : '',
        v.Cliente?.nombre || 'Cliente General',
        v.almacen?.nombre || 'Bodega General',
        v.metodoPago || 'Efectivo',
        v.estado || 'Pagada',
        formatCurrency(v.total || 0)
      ])
    });
    savePdf(doc, `Ventas_${hoyColombia()}.pdf`);
  };

  // Cálculos estadísticos (KPIs)
  const totalVendidoCalculado = ventas
    .filter(v => v.estado !== 'Anulada')
    .reduce((acc, v) => acc + Number(v.total || 0), 0);

  const totalTransacciones = ventas.length;
  const ventasPagadasCount = ventas.filter(v => v.estado === 'Pagada').length;
  const ventasPendientesCount = ventas.filter(v => v.estado === 'Pendiente').length;
  const ventasAnuladasCount = ventas.filter(v => v.estado === 'Anulada').length;
  const ticketPromedio = totalTransacciones > 0 ? totalVendidoCalculado / Math.max(1, (totalTransacciones - ventasAnuladasCount)) : 0;

  return (
    <div style={{ padding: '4px 0' }}>
      
      {/* HEADER PRINCIPAL */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#1a202c', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FaShoppingBag color="#3182ce" /> Punto de Venta & Facturación
          </h1>
          <p style={{ margin: '4px 0 0 0', color: '#718096', fontSize: '14px' }}>
            Gestión de transacciones comerciales, caja en tiempo real, anulación con reintegro de stock e impresión de comprobantes.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button 
            type="button"
            onClick={fetchVentas} 
            style={{ 
              display: 'flex', alignItems: 'center', gap: '6px', 
              background: '#ffffff', color: '#2d3748', border: '1px solid #cbd5e0',
              padding: '8px 14px', borderRadius: '8px', fontWeight: 600, fontSize: '13px',
              cursor: 'pointer', boxShadow: '0 1px 2px rgba(0,0,0,0.05)', transition: 'all 0.15s ease'
            }}
            title="Actualizar listado de ventas"
          >
            <MdRefresh size={18} color="#4a5568" /> Actualizar
          </button>
          
          <button 
            type="button"
            onClick={() => setShowNuevaVentaModal(true)} 
            style={{ 
              display: 'flex', alignItems: 'center', gap: '8px', 
              backgroundColor: '#2b6cb0', color: '#ffffff', border: 'none',
              padding: '8px 16px', borderRadius: '8px', fontWeight: 700, fontSize: '13px',
              cursor: 'pointer', boxShadow: '0 2px 4px rgba(43, 108, 176, 0.3)', transition: 'all 0.15s ease'
            }}
          >
            <MdAddShoppingCart size={19} color="#ffffff" /> Registrar Nueva Venta
          </button>
        </div>
      </div>

      {/* KPI METRICS BAR */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '20px' }}>
        
        <div className="card" style={{ padding: '16px', background: '#ffffff', borderRadius: '10px', borderLeft: '4px solid #3182ce', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: '12px', color: '#718096', textTransform: 'uppercase', fontWeight: 600 }}>Total Facturado</div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#2b6cb0', marginTop: '4px' }}>{formatCurrency(totalVendidoCalculado)}</div>
          <div style={{ fontSize: '12px', color: '#4a5568', marginTop: '2px' }}>Ventas efectivas activas</div>
        </div>

        <div className="card" style={{ padding: '16px', background: '#ffffff', borderRadius: '10px', borderLeft: '4px solid #38a169', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: '12px', color: '#718096', textTransform: 'uppercase', fontWeight: 600 }}>Ticket Promedio</div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#276749', marginTop: '4px' }}>{formatCurrency(ticketPromedio)}</div>
          <div style={{ fontSize: '12px', color: '#4a5568', marginTop: '2px' }}>Promedio por transacción</div>
        </div>

        <div className="card" style={{ padding: '16px', background: '#ffffff', borderRadius: '10px', borderLeft: '4px solid #805ad5', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: '12px', color: '#718096', textTransform: 'uppercase', fontWeight: 600 }}>Total Transacciones</div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#553c9a', marginTop: '4px' }}>{totalTransacciones} <span style={{ fontSize: '14px', fontWeight: 400 }}>ventas</span></div>
          <div style={{ fontSize: '12px', color: '#4a5568', marginTop: '2px' }}>{ventasPagadasCount} completadas</div>
        </div>

        <div className="card" style={{ padding: '16px', background: '#ffffff', borderRadius: '10px', borderLeft: '4px solid #dd6b20', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: '12px', color: '#718096', textTransform: 'uppercase', fontWeight: 600 }}>Pendientes / Anuladas</div>
          <div style={{ fontSize: '20px', fontWeight: 700, color: '#c05621', marginTop: '4px' }}>
            <span style={{ color: '#d69e2e' }}>{ventasPendientesCount} Pnd</span> / <span style={{ color: '#e53e3e' }}>{ventasAnuladasCount} Anul</span>
          </div>
          <div style={{ fontSize: '12px', color: '#4a5568', marginTop: '2px' }}>Seguimiento de caja</div>
        </div>

      </div>

      {/* TOOLBAR DE FILTROS Y BÚSQUEDA */}
      <div className="card" style={{ padding: '16px', marginBottom: '20px', borderRadius: '8px', background: '#f7fafc', border: '1px solid #e2e8f0' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', alignItems: 'center' }}>
          
          <div style={{ position: 'relative' }}>
            <MdSearch style={{ position: 'absolute', left: '10px', top: '10px', color: '#a0aec0' }} size={20} />
            <input 
              type="text" 
              placeholder="Buscar por cliente, No. o notas..." 
              value={search} 
              onChange={e => setSearch(e.target.value)} 
              className="input" 
              style={{ paddingLeft: '36px', width: '100%' }} 
            />
          </div>

          <div>
            <select 
              value={filtroEstado} 
              onChange={e => setFiltroEstado(e.target.value)} 
              className="input" 
              style={{ width: '100%' }}
            >
              <option value="Todos">Todos los Estados</option>
              <option value="Pagada">Pagada</option>
              <option value="Pendiente">Pendiente</option>
              <option value="Anulada">Anulada</option>
            </select>
          </div>

          {isAdmin && (
            <div>
              <select 
                value={filtroAlmacen} 
                onChange={e => setFiltroAlmacen(e.target.value)} 
                className="input" 
                style={{ width: '100%' }}
              >
                <option value="Todos">Todas las Bodegas</option>
                {almacenes.map(a => (
                  <option key={a.id} value={a.id}>{a.nombre}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <input 
              type="date" 
              value={fechaInicio} 
              onChange={e => setFechaInicio(e.target.value)} 
              className="input" 
              style={{ width: '100%' }} 
              placeholder="Desde" 
            />
          </div>

          <div>
            <input 
              type="date" 
              value={fechaFin} 
              onChange={e => setFechaFin(e.target.value)} 
              className="input" 
              style={{ width: '100%' }} 
              placeholder="Hasta" 
            />
          </div>

        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
          <button 
            onClick={() => { setSearch(''); setFiltroEstado('Todos'); setFiltroAlmacen('Todos'); setFechaInicio(''); setFechaFin(''); }} 
            className="btn btn-secundario" 
            style={{ fontSize: '12px', padding: '4px 10px' }}
          >
            Limpiar Filtros
          </button>
          
          <button onClick={exportExcel} className="btn" style={{ background: '#276749', color: '#fff', fontSize: '12px', padding: '4px 10px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <FaFileExcel /> Excel
          </button>
          
          <button onClick={exportPDF} className="btn" style={{ background: '#c53030', color: '#fff', fontSize: '12px', padding: '4px 10px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <FaFilePdf /> PDF
          </button>
        </div>
      </div>

      {/* NOTIFICACIONES */}
      {error && <div className="alert alert-error" style={{ marginBottom: '16px' }}>{error}</div>}

      {/* TABLA PRINCIPAL DE VENTAS */}
      <div className="card" style={{ padding: '0', borderRadius: '8px', overflow: 'hidden', border: '1px solid #e2e8f0' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="usuarios-table" style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#edf2f7', color: '#2d3748', textAlign: 'left' }}>
                <th style={{ padding: '12px 16px' }}>No. Venta</th>
                <th style={{ padding: '12px' }}>Fecha y Hora</th>
                <th style={{ padding: '12px' }}>Cliente</th>
                <th style={{ padding: '12px' }}>Bodega / Sede</th>
                <th style={{ padding: '12px' }}>Vendedor</th>
                <th style={{ padding: '12px', textAlign: 'center' }}>Método</th>
                <th style={{ padding: '12px', textAlign: 'center' }}>Estado</th>
                <th style={{ padding: '12px', textAlign: 'right' }}>Total Neto</th>
                <th style={{ padding: '12px 16px', textAlign: 'center' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading && ventas.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '30px', color: '#718096' }}>
                    Cargando historial de ventas...
                  </td>
                </tr>
              ) : ventas.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '30px', color: '#a0aec0' }}>
                    No se encontraron registros de ventas coincidentes con los filtros.
                  </td>
                </tr>
              ) : (
                ventas.map(v => {
                  const isAnulada = v.estado === 'Anulada';
                  const isPendiente = v.estado === 'Pendiente';

                  return (
                    <tr key={v.id} style={{ borderBottom: '1px solid #edf2f7', opacity: isAnulada ? 0.65 : 1 }}>
                      <td style={{ padding: '12px 16px', fontWeight: 700, color: '#2b6cb0' }}>
                        #{v.id}
                      </td>

                      <td style={{ padding: '12px', color: '#4a5568' }}>
                        {v.fecha ? new Date(v.fecha).toLocaleDateString('es-CO', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'America/Bogota' }) : '-'}
                      </td>

                      <td style={{ padding: '12px' }}>
                        <div style={{ fontWeight: 600, color: '#2d3748' }}>
                          {v.Cliente?.nombre || 'Cliente General'}
                        </div>
                        {v.Cliente?.tipo_cliente && (
                          <span style={{ fontSize: '11px', padding: '1px 6px', background: '#eaf1fb', borderRadius: '4px', color: '#2b6cb0', fontWeight: 500 }}>
                            {v.Cliente.tipo_cliente}
                          </span>
                        )}
                      </td>

                      <td style={{ padding: '12px', color: '#4a5568' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <FaWarehouse size={12} color="#718096" /> {v.almacen?.nombre || 'Sede Principal'}
                        </span>
                      </td>

                      <td style={{ padding: '12px', color: '#4a5568' }}>
                        {v.vendedor || 'Sistema'}
                      </td>

                      <td style={{ padding: '12px', textAlign: 'center' }}>
                        <span style={{ fontSize: '12px', background: '#edf2f7', padding: '2px 8px', borderRadius: '12px', color: '#2d3748', fontWeight: 500 }}>
                          {v.metodoPago || 'Efectivo'}
                        </span>
                      </td>

                      <td style={{ padding: '12px', textAlign: 'center' }}>
                        {v.estado === 'Pagada' && (
                          <span className="badge badge-success" style={{ padding: '4px 8px', fontSize: '11px' }}>
                            <MdCheckCircle size={13} style={{ marginRight: '3px' }} /> Pagada
                          </span>
                        )}
                        {v.estado === 'En Cartera' && (
                          <span style={{ background: '#f3e8ff', color: '#6b21a8', border: '1px solid #c084fc', padding: '4px 8px', borderRadius: '12px', fontWeight: 700, fontSize: '11px' }}>
                            📑 En Cartera
                          </span>
                        )}
                        {v.estado === 'Pendiente' && (
                          <span style={{ background: '#feebc8', color: '#744210', padding: '4px 8px', borderRadius: '12px', fontWeight: 600, fontSize: '11px' }}>
                            Pendiente
                          </span>
                        )}
                        {v.estado === 'Anulada' && (
                          <span className="badge badge-danger" style={{ padding: '4px 8px', fontSize: '11px' }}>
                            <MdBlock size={13} style={{ marginRight: '3px' }} /> Anulada
                          </span>
                        )}
                      </td>

                      <td style={{ padding: '12px', textAlign: 'right', fontWeight: 700, color: isAnulada ? '#a0aec0' : '#276749', fontSize: '14px' }}>
                        {formatCurrency(v.total || 0)}
                      </td>

                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                          
                          <button 
                            className="btn" 
                            style={{ padding: '6px', background: '#ebf8ff', color: '#3182ce', border: '1px solid #bee3f8' }}
                            onClick={() => handleVerComprobante(v.id)} 
                            title="Ver e imprimir ticket comprobante"
                          >
                            <MdReceipt size={16} />
                          </button>

                          <button 
                            className="btn" 
                            style={{ padding: '6px', background: '#f0fff4', color: '#25D366', border: '1px solid #bbf7d0' }}
                            onClick={() => handleAbrirWhatsAppVenta(v)} 
                            title="Enviar orden o cotización por WhatsApp al cliente"
                          >
                            <FaWhatsapp size={16} />
                          </button>

                          {(v.es_cotizacion || isPendiente) && (
                            <button 
                              className="btn" 
                              style={{ padding: '6px', background: '#e6fffa', color: '#234e52', border: '1px solid #b2f5ea' }}
                              onClick={() => handleConvertirCotizacion(v.id)} 
                              title="Convertir cotización a Factura y descontar stock"
                            >
                              <FaFileInvoiceDollar size={16} />
                            </button>
                          )}

                          {isPendiente && (
                            <button 
                              className="btn" 
                              style={{ padding: '6px', background: '#f0fff4', color: '#38a169', border: '1px solid #c6f6d5' }}
                              onClick={() => handleMarcarPagada(v.id)} 
                              title="Marcar venta como pagada"
                            >
                              <MdCheckCircle size={16} />
                            </button>
                          )}

                          {puede(usuario, 'ventas.anular') && !isAnulada && (
                            <button 
                              className="btn" 
                              style={{ padding: '6px', background: '#fff5f5', color: '#e53e3e', border: '1px solid #fed7d7' }}
                              onClick={() => handleAbrirAnular(v)} 
                              title="Anular venta y reponer stock a la bodega"
                            >
                              <MdBlock size={16} />
                            </button>
                          )}

                        </div>
                      </td>

                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL NUEVA VENTA / POS */}
      {showNuevaVentaModal && (
        <div className="modal-backdrop">
          <div className="modal-card card" style={{ maxWidth: '950px', width: '95%', maxHeight: '92vh', overflowY: 'auto' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #ebf8ff', paddingBottom: '12px', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, color: '#2b6cb0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <MdAddShoppingCart /> Registrar Nueva Venta / Caja
              </h3>
              <button onClick={() => setShowNuevaVentaModal(false)} className="btn btn-secundario" style={{ padding: '4px 8px' }}>
                <MdClose size={20} />
              </button>
            </div>

            <form onSubmit={handleGuardarVenta}>
              {modalError && (
                <div style={{
                  backgroundColor: '#fff5f5',
                  color: '#e53e3e',
                  border: '1px solid #feb2b2',
                  padding: '12px 16px',
                  borderRadius: '8px',
                  marginBottom: '16px',
                  fontWeight: 600,
                  fontSize: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  flexWrap: 'wrap'
                }}>
                  <span style={{ fontSize: '18px' }}>⚠️</span>
                  <span style={{ flex: 1 }}>{modalError}</span>
                  {modalError.toLowerCase().includes('caja') && onNavigate && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowNuevaVentaModal(false);
                        onNavigate('caja');
                      }}
                      className="btn"
                      style={{
                        backgroundColor: '#3182ce',
                        color: '#ffffff',
                        padding: '6px 14px',
                        fontSize: '13px',
                        fontWeight: 700,
                        borderRadius: '6px',
                        border: 'none',
                        cursor: 'pointer'
                      }}
                    >
                      Ir a Arqueo de Caja ➔
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setModalError('')}
                    style={{ background: 'none', border: 'none', color: '#e53e3e', cursor: 'pointer', fontWeight: 'bold', fontSize: '16px' }}
                  >
                    ✕
                  </button>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginBottom: '16px' }}>
                
                {/* BLOQUE CLIENTE */}
                <div style={{ background: '#f7fafc', padding: '14px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <label style={{ fontWeight: 600, color: '#2d3748', display: 'block', marginBottom: '6px' }}>Cliente *</label>
                  <select 
                    value={form.clienteId} 
                    onChange={e => setForm({ ...form, clienteId: e.target.value })} 
                    className="input" 
                    style={{ width: '100%' }}
                    required
                  >
                    <option value="">-- Seleccionar Cliente --</option>
                    {clientes.map(c => (
                      <option key={c.id} value={c.id}>{c.nombre} ({c.documento || 'Sin doc'}) - Tier: {c.tipo_cliente || 'Detal'}</option>
                    ))}
                  </select>

                  {clienteSeleccionado && (
                    <div style={{ marginTop: '10px', fontSize: '12px', background: '#ebf8ff', padding: '8px', borderRadius: '6px', color: '#2b6cb0' }}>
                      <div><b>Tipo Cliente:</b> {clienteSeleccionado.tipo_cliente || 'Detal'}</div>
                      <div><b>Teléfono:</b> {clienteSeleccionado.telefono || 'N/A'}</div>
                      <div><b>Dirección:</b> {clienteSeleccionado.direccion || 'N/A'}</div>
                    </div>
                  )}
                </div>

                {/* BLOQUE DATOS VENTA */}
                <div style={{ background: '#f7fafc', padding: '14px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    
                    <div>
                      <label style={{ fontWeight: 600, color: '#2d3748', fontSize: '12px' }}>Bodega de Despacho *</label>
                      <select 
                        value={form.almacenId} 
                        onChange={e => setForm({ ...form, almacenId: e.target.value })} 
                        className="input" 
                        style={{ width: '100%', fontSize: '13px' }}
                      >
                        {almacenes.map(a => (
                          <option key={a.id} value={a.id}>{a.nombre}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label style={{ fontWeight: 600, color: '#2d3748', fontSize: '12px' }}>Método de Pago</label>
                      <select 
                        value={form.metodoPago} 
                        onChange={e => setForm({ ...form, metodoPago: e.target.value })} 
                        className="input" 
                        style={{ width: '100%', fontSize: '13px' }}
                      >
                        <option value="Efectivo">Efectivo</option>
                        <option value="Transferencia">Transferencia</option>
                        <option value="Tarjeta">Tarjeta Débito/Crédito</option>
                        <option value="Nequi/Daviplata">Nequi / Daviplata</option>
                        <option value="Cheque">Cheque</option>
                        <option value="Crédito">Crédito Comercial</option>
                      </select>
                    </div>

                    <div>
                      <label style={{ fontWeight: 600, color: '#2d3748', fontSize: '12px' }}>Estado / Tipo</label>
                      <select 
                        value={form.estado} 
                        onChange={e => setForm({ ...form, estado: e.target.value })} 
                        className="input" 
                        style={{ width: '100%', fontSize: '13px' }}
                      >
                        <option value="Pendiente">⏳ Pendiente (Por cobrar y facturar en caja)</option>
                        <option value="Pagada">Pagada (Venta Directa de Contado)</option>
                        <option value="Cotizacion">Cotización / Presupuesto</option>
                      </select>
                    </div>

                    <div>
                      <label style={{ fontWeight: 600, color: '#2d3748', fontSize: '12px' }}>Fecha Venta</label>
                      <input 
                        type="date" 
                        value={form.fecha} 
                        onChange={e => setForm({ ...form, fecha: e.target.value })} 
                        className="input" 
                        style={{ width: '100%', fontSize: '13px' }}
                      />
                    </div>

                  </div>
                </div>

              </div>

              {/* SECCIÓN AGREGAR PRODUCTOS O SERVICIOS */}
              <div style={{ background: '#edf2f7', padding: '14px', borderRadius: '8px', marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <div style={{ fontWeight: 600, color: '#2d3748' }}>Buscador y Selección de Repuestos / Servicios</div>
                  {esServicioSeleccionado && (
                    <span style={{ background: '#ebf8ff', color: '#2b6cb0', padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 700, border: '1px solid #bee3f8' }}>
                      🛠️ SERVICIO DETECTADO (PRECIO VARIABLE)
                    </span>
                  )}
                </div>

                {esServicioSeleccionado && (
                  <div style={{
                    background: '#ebf8ff',
                    border: '1px solid #bee3f8',
                    borderLeft: '4px solid #3182ce',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    marginBottom: '10px',
                    fontSize: '12px',
                    color: '#2b6cb0',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    <span style={{ fontSize: '16px' }}>💡</span>
                    <span>
                      <b>Servicio: "{productoSeleccionado?.nombre}"</b>. El costo de mano de obra, mantenimiento o diagnóstico varía según el trabajo. <b>Por favor ingrese a continuación el valor exacto a cobrar.</b>
                    </span>
                  </div>
                )}
                
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: esServicioSeleccionado ? '2fr 80px 140px 100px' : '2fr 100px 100px', 
                  gap: '10px', 
                  alignItems: 'flex-end' 
                }}>
                  
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: 600, color: '#4a5568', display: 'block', marginBottom: '2px' }}>
                      Repuesto o Servicio *
                    </label>
                    <input 
                      type="text" 
                      placeholder="Escriba el nombre del repuesto o servicio (ej: Mantenimiento inyector)..." 
                      value={form.productoNombre} 
                      onChange={e => {
                        const val = e.target.value;
                        setForm(f => ({ ...f, productoNombre: val }));
                        setModalError('');
                        if (!val) {
                          setForm(f => ({ ...f, productoId: '', precioServicio: '' }));
                          return;
                        }
                        const searchVal = val.trim().toLowerCase();
                        const match = productos.find(p => 
                          p.nombre.toLowerCase() === searchVal || 
                          (p.codigo_oem && p.codigo_oem.toLowerCase() === searchVal)
                        );
                        if (match) {
                          const isServ = match.tipo === 'servicio' || (match.categoria && match.categoria.toLowerCase().includes('servicio'));
                          setForm(f => ({ 
                            ...f, 
                            productoId: String(match.id),
                            precioServicio: isServ ? (f.precioServicio || (match.precio > 0 ? String(match.precio) : '')) : ''
                          }));
                          const almacenAct = form.almacenId || 1;
                          let stockBodega = match.stock || 0;
                          if (Array.isArray(match.almacenes)) {
                            const almMatch = match.almacenes.find(a => Number(a.id) === Number(almacenAct));
                            if (almMatch && almMatch.stock !== undefined) stockBodega = Number(almMatch.stock || 0);
                          }
                          if (!isServ && stockBodega <= 0) {
                            setModalError(`❌ El producto "${match.nombre}" NO tiene stock disponible en esta bodega (Stock: 0).`);
                          }
                        } else {
                          setForm(f => ({ ...f, productoId: '' }));
                        }
                      }} 
                      className="input" 
                      style={{ width: '100%' }}
                      list="pos-productos-list"
                    />
                    <datalist id="pos-productos-list">
                      {productos.map(p => {
                        const isServ = p.tipo === 'servicio' || (p.categoria && p.categoria.toLowerCase().includes('servicio'));
                        return (
                          <option 
                            key={p.id} 
                            value={p.nombre} 
                            label={isServ ? `🛠️ SERVICIO | Valor a definir` : `📦 REPUESTO | OEM: ${p.codigo_oem || '-'} | Stock: ${p.stock}`}
                          />
                        );
                      })}
                    </datalist>
                    {fieldErrors.producto && <FieldError>{fieldErrors.producto}</FieldError>}
                  </div>

                  <div>
                    <label style={{ fontSize: '11px', fontWeight: 600, color: '#4a5568', display: 'block', marginBottom: '2px' }}>
                      Cantidad
                    </label>
                    <input 
                      type="number" 
                      min="1" 
                      value={form.cantidad} 
                      onChange={e => setForm({ ...form, cantidad: e.target.value })} 
                      className="input" 
                      placeholder="Cant" 
                      style={{ width: '100%' }}
                    />
                  </div>

                  {/* CAMPO DE PRECIO OBLIGATORIO SOLO PARA SERVICIOS */}
                  {esServicioSeleccionado && (
                    <div>
                      <label style={{ fontSize: '11px', fontWeight: 700, color: '#2b6cb0', display: 'block', marginBottom: '2px' }}>
                        Valor Servicio ($) *
                      </label>
                      <input 
                        type="number" 
                        step="500" 
                        placeholder="Ej: 80000" 
                        value={form.precioServicio} 
                        onChange={e => setForm({ ...form, precioServicio: e.target.value })} 
                        className="input" 
                        style={{ width: '100%', borderColor: '#3182ce', fontWeight: 700, background: '#ffffff', color: '#2b6cb0' }}
                        autoFocus
                        required
                      />
                      {fieldErrors.precioServicio && <FieldError>{fieldErrors.precioServicio}</FieldError>}
                    </div>
                  )}

                  <button 
                    type="button" 
                    onClick={handleAgregarProducto} 
                    className="btn btn-principal" 
                    style={{ backgroundColor: '#38a169', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                  >
                    <FaPlus /> Agregar
                  </button>

                </div>
              </div>

              {/* CARRITO DE COMPRA */}
              <div style={{ marginBottom: '16px', overflowX: 'auto' }}>
                <table className="usuarios-table" style={{ width: '100%', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ background: '#e2e8f0' }}>
                      <th style={{ padding: '8px' }}>Producto / Servicio</th>
                      <th style={{ padding: '8px' }}>Tipo / OEM</th>
                      <th style={{ padding: '8px', textAlign: 'center' }}>Cantidad</th>
                      <th style={{ padding: '8px', textAlign: 'right' }}>Valor Unit.</th>
                      <th style={{ padding: '8px', textAlign: 'right' }}>Subtotal</th>
                      <th style={{ padding: '8px', textAlign: 'center' }}>Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {carrito.length === 0 ? (
                      <tr>
                        <td colSpan={6} style={{ textAlign: 'center', padding: '20px', color: '#a0aec0' }}>
                          No hay productos o servicios agregados al carrito de venta.
                        </td>
                      </tr>
                    ) : (
                      carrito.map((item, idx) => (
                        <tr key={`${item.productoId}-${item.almacenId}-${idx}`}>
                          <td style={{ padding: '8px', fontWeight: 600 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span>{item.nombre}</span>
                              {item.isServicio && (
                                <span style={{ background: '#ebf8ff', color: '#2b6cb0', padding: '1px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 700, border: '1px solid #bee3f8' }}>
                                  🛠️ SERVICIO
                                </span>
                              )}
                            </div>
                          </td>
                          <td style={{ padding: '8px', color: '#718096' }}>
                            {item.isServicio ? 'Mano de Obra / Servicio' : (item.codigo_oem || '-')}
                          </td>
                          <td style={{ padding: '8px', textAlign: 'center' }}>
                            <input 
                              type="number" 
                              min="1" 
                              value={item.cantidad} 
                              onChange={e => handleCambiarCantidad(idx, e.target.value)} 
                              style={{ width: '60px', padding: '2px 4px', textAlign: 'center' }}
                            />
                          </td>
                          <td style={{ padding: '8px', textAlign: 'right' }}>
                            {item.isServicio ? (
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                                <span style={{ fontSize: '11px', color: '#718096' }}>$</span>
                                <input 
                                  type="number" 
                                  step="500" 
                                  value={item.precio} 
                                  onChange={e => handleCambiarPrecio(idx, e.target.value)} 
                                  className="input" 
                                  style={{ width: '105px', padding: '3px 6px', textAlign: 'right', fontWeight: 700, color: '#2b6cb0', borderColor: '#90cdf4', background: '#ebf8ff' }}
                                  title="Haga clic para ajustar el valor de este servicio"
                                />
                              </div>
                            ) : (
                              formatCurrency(item.precio)
                            )}
                          </td>
                          <td style={{ padding: '8px', textAlign: 'right', fontWeight: 700, color: '#276749' }}>
                            {formatCurrency(item.precio * item.cantidad)}
                          </td>
                          <td style={{ padding: '8px', textAlign: 'center' }}>
                            <button 
                              type="button" 
                              onClick={() => handleQuitarProducto(idx)} 
                              className="btn" 
                              style={{ color: '#e53e3e', background: '#fff5f5', padding: '2px 6px' }}
                              title="Quitar ítem del carrito"
                            >
                              <MdRemoveShoppingCart size={16} />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* TOTALES & DESCUENTOS */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', background: '#ebf8ff', padding: '14px', borderRadius: '8px', marginBottom: '16px' }}>
                
                <div>
                  <label style={{ fontWeight: 600, fontSize: '12px' }}>Notas u Observaciones de la Venta</label>
                  <textarea 
                    value={form.notas} 
                    onChange={e => setForm({ ...form, notas: e.target.value })} 
                    className="input" 
                    rows={2} 
                    placeholder="Ej: Entrega a domicilio / Garantía 3 meses" 
                    style={{ width: '100%', fontSize: '12px' }}
                  />
                </div>

                <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={{ fontSize: '13px', color: '#4a5568' }}>
                    Subtotal Bruto: <b>{formatCurrency(subtotalCarrito)}</b>
                  </div>
                  
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', alignItems: 'center' }}>
                    <span style={{ fontSize: '12px' }}>Descuento (%):</span>
                    <input 
                      type="number" 
                      min="0" 
                      max="100" 
                      value={form.descuento} 
                      onChange={e => setForm({ ...form, descuento: e.target.value })} 
                      style={{ width: '60px', fontSize: '12px', padding: '2px 4px' }}
                    />
                    <span style={{ fontSize: '12px', color: '#c53030' }}>-{formatCurrency(montoDescuento)}</span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', alignItems: 'center' }}>
                    <span style={{ fontSize: '12px' }}>IVA / Impuestos (%):</span>
                    <input 
                      type="number" 
                      min="0" 
                      max="100" 
                      value={form.impuestos} 
                      onChange={e => setForm({ ...form, impuestos: e.target.value })} 
                      style={{ width: '60px', fontSize: '12px', padding: '2px 4px' }}
                    />
                    <span style={{ fontSize: '12px', color: '#2b6cb0' }}>+{formatCurrency(montoImpuestos)}</span>
                  </div>

                  <div style={{ fontSize: '20px', fontWeight: 800, color: '#276749', marginTop: '6px' }}>
                    Total Neto: {formatCurrency(totalCarrito)}
                  </div>
                </div>

              </div>

              {/* ACCIONES DEL FORMULARIO */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" onClick={() => setShowNuevaVentaModal(false)} className="btn btn-secundario">
                  Cancelar
                </button>
                
                <button 
                  type="submit" 
                  disabled={savingVenta || carrito.length === 0} 
                  className="btn btn-principal" 
                  style={{ backgroundColor: '#2b6cb0' }}
                >
                  {savingVenta ? 'Procesando...' : 'Completar y Facturar Venta'}
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* MODAL COMPROBANTE / TICKET POS */}
      {showComprobanteModal && (
        <div className="modal-backdrop">
          <div className="modal-card card" style={{ maxWidth: '500px', width: '90%', maxHeight: '90vh', overflowY: 'auto', background: '#ffffff' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px', marginBottom: '12px' }}>
              <span style={{ fontWeight: 700, color: '#2d3748' }}>Comprobante de Venta POS</span>
              <button onClick={() => setShowComprobanteModal(false)} className="btn btn-secundario" style={{ padding: '2px 6px' }}>
                <MdClose size={18} />
              </button>
            </div>

            {loadingComprobante ? (
              <div style={{ textAlign: 'center', padding: '30px', color: '#718096' }}>Cargando comprobante...</div>
            ) : comprobanteData && comprobanteData.venta ? (
              <div id="printable-ticket" style={{ fontFamily: 'monospace', fontSize: '12px', color: '#000', padding: '10px' }}>
                
                {/* CABECERA */}
                <div style={{ textAlign: 'center', marginBottom: '12px' }}>
                  {comprobanteData.empresa?.logo_url && (
                    <img 
                      src={comprobanteData.empresa.logo_url} 
                      alt="Logo Empresa" 
                      style={{ maxHeight: '60px', maxWidth: '160px', objectFit: 'contain', marginBottom: '6px' }} 
                    />
                  )}
                  <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 'bold' }}>{comprobanteData.empresa?.nombre || 'MULTINYECTORES Y REPUESTOS'}</h2>
                  <div>NIT: {comprobanteData.empresa?.nit || '900.123.456-7'}</div>
                  {comprobanteData.empresa?.actividad_economica && <div style={{ fontSize: '10px', fontStyle: 'italic' }}>{comprobanteData.empresa.actividad_economica}</div>}
                  <div>
                    {comprobanteData.empresa?.direccion || 'Tuluá - Valle del Cauca'}
                    {comprobanteData.empresa?.ciudad ? `, ${comprobanteData.empresa.ciudad}` : ''}
                  </div>
                  <div>
                    Tel: {comprobanteData.empresa?.telefono || '(602) 224-5000'}
                    {comprobanteData.empresa?.telefono_secundario ? ` / ${comprobanteData.empresa.telefono_secundario}` : ''}
                  </div>
                  {comprobanteData.empresa?.correo && <div>Email: {comprobanteData.empresa.correo}</div>}
                  {comprobanteData.empresa?.sitio_web && <div>Web: {comprobanteData.empresa.sitio_web}</div>}
                  <div style={{ marginTop: '6px', borderTop: '1px dashed #000', borderBottom: '1px dashed #000', padding: '4px 0', fontWeight: 'bold' }}>
                    TICKET DE VENTA No. #{comprobanteData.venta.id}
                  </div>
                </div>

                {/* INFO VENTA Y CLIENTE */}
                {(comprobanteData.venta.estado === 'Anulada' || comprobanteData.venta.fechaAnulacion || comprobanteData.venta.motivoAnulacion) && (
                  <div style={{ background: '#fee2e2', border: '1px solid #f87171', borderRadius: '4px', padding: '8px', marginBottom: '10px', color: '#991b1b', fontSize: '11px' }}>
                    <div style={{ fontWeight: 800, fontSize: '12px', marginBottom: '3px' }}>⚠️ VENTA ANULADA</div>
                    {comprobanteData.venta.anuladaPor && <div><b>Anulada por:</b> {comprobanteData.venta.anuladaPor}</div>}
                    {comprobanteData.venta.fechaAnulacion && <div><b>Fecha de anulación:</b> {new Date(comprobanteData.venta.fechaAnulacion).toLocaleString('es-CO', { timeZone: 'America/Bogota' })}</div>}
                    {comprobanteData.venta.motivoAnulacion && <div><b>Motivo:</b> {comprobanteData.venta.motivoAnulacion}</div>}
                  </div>
                )}
                <div style={{ marginBottom: '10px' }}>
                  <div><b>Fecha:</b> {new Date(comprobanteData.venta.fecha).toLocaleString('es-CO', { timeZone: 'America/Bogota' })}</div>
                  <div><b>Cliente:</b> {comprobanteData.venta.Cliente?.nombre || 'Cliente General'}</div>
                  <div><b>Doc/NIT:</b> {comprobanteData.venta.Cliente?.documento || 'Venta Mostrador'}</div>
                  <div><b>Atendido por:</b> {comprobanteData.venta.vendedor || 'Sistema'}</div>
                  <div><b>Bodega:</b> {comprobanteData.venta.almacen?.nombre || 'Sede Principal'}</div>
                  <div><b>Método Pago:</b> {comprobanteData.venta.metodoPago || 'Efectivo'}</div>
                  <div><b>Estado:</b> {comprobanteData.venta.estado === 'En Cartera' ? 'En Cartera (Crédito)' : (comprobanteData.venta.estado || 'Pagada')}</div>
                </div>

                {/* DETALLE ARTICULOS */}
                <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '10px', fontSize: '11px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #000', textAlign: 'left' }}>
                      <th style={{ padding: '2px 0' }}>Cant</th>
                      <th>Producto</th>
                      <th style={{ textAlign: 'right' }}>P.Unit</th>
                      <th style={{ textAlign: 'right' }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(comprobanteData.venta.DetalleVentas || comprobanteData.venta.DetalleVenta || comprobanteData.venta.detalles || comprobanteData.venta.DetalleFacturas || []).map((item, idx) => {
                      const prodNombre = item.Producto?.nombre || item.producto?.nombre || item.nombre || 'Producto';
                      const prodOEM = item.Producto?.codigo_oem || item.producto?.codigo_oem || item.codigo_oem || '-';
                      const cant = item.cantidad || 1;
                      const pUnit = item.precio_unitario ?? item.precio ?? 0;
                      return (
                        <tr key={idx} style={{ borderBottom: '1px dashed #ddd' }}>
                          <td style={{ padding: '4px 0', verticalAlign: 'top' }}>{cant}</td>
                          <td style={{ padding: '4px 0' }}>{prodNombre}<br/><small style={{ color: '#555' }}>OEM: {prodOEM}</small></td>
                          <td style={{ padding: '4px 0', textAlign: 'right', verticalAlign: 'top' }}>{formatCurrency(pUnit)}</td>
                          <td style={{ padding: '4px 0', textAlign: 'right', verticalAlign: 'top' }}>{formatCurrency(pUnit * cant)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {/* TOTALES */}
                <div style={{ borderTop: '1px dashed #000', paddingTop: '6px', textAlign: 'right' }}>
                  {comprobanteData.venta.descuento > 0 && (
                    <div>Descuento ({comprobanteData.venta.descuento}%): -{formatCurrency((comprobanteData.venta.total * comprobanteData.venta.descuento) / 100)}</div>
                  )}
                  <div style={{ fontSize: '14px', fontWeight: 'bold', marginTop: '4px' }}>
                    TOTAL A PAGAR: {formatCurrency(comprobanteData.venta.total)}
                  </div>
                </div>

                {/* PIE TICKET */}
                <div style={{ textAlign: 'center', marginTop: '16px', fontSize: '11px' }}>
                  {comprobanteData.empresa?.pie_pagina_factura ? (
                    <div>{comprobanteData.empresa.pie_pagina_factura}</div>
                  ) : (
                    <>
                      <div>¡Gracias por su compra!</div>
                      <div>Conserve este comprobante para reclamos y garantía.</div>
                    </>
                  )}
                </div>

              </div>
            ) : null}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px', flexWrap: 'wrap' }}>
              <button 
                type="button"
                onClick={() => handleAbrirWhatsAppVenta(comprobanteData.venta, comprobanteData.empresa)} 
                className="btn" 
                style={{ 
                  backgroundColor: '#25D366', 
                  color: '#ffffff', 
                  display: 'inline-flex', 
                  alignItems: 'center', 
                  gap: '6px',
                  fontWeight: 600,
                  border: 'none',
                  boxShadow: '0 2px 4px rgba(37, 211, 102, 0.3)'
                }}
                title="Enviar comprobante de venta o cotización por WhatsApp"
              >
                <FaWhatsapp size={18} /> Enviar por WhatsApp
              </button>

              <button onClick={handleImprimirTicket} className="btn btn-principal" style={{ backgroundColor: '#2b6cb0', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <MdPrint size={18} /> Imprimir Ticket
              </button>
            </div>

          </div>
        </div>
      )}

      {/* MODAL ANULAR VENTA */}
      {showAnularModal && ventaAAnular && (
        <div className="modal-backdrop">
          <div className="modal-card card" style={{ maxWidth: '480px', width: '90%' }}>
            
            <h3 style={{ marginTop: 0, color: '#c53030', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <MdBlock /> Anular Venta #{ventaAAnular.id}
            </h3>

            <p style={{ fontSize: '13px', color: '#4a5568' }}>
              Al anular esta venta, el estado cambiará a <b>Anulada</b> y se <b>devolverá automáticamente todo el stock</b> de los productos involucrados a la bodega correspondiente.
            </p>

            <div style={{ marginBottom: '14px' }}>
              <label style={{ fontWeight: 600, fontSize: '12px', display: 'block', marginBottom: '4px' }}>
                Motivo de la Anulación *
              </label>
              <textarea 
                value={motivoAnulacion} 
                onChange={e => setMotivoAnulacion(e.target.value)} 
                className="input" 
                rows={3} 
                placeholder="Ej: Error en el pedido / Devolución del cliente" 
                style={{ width: '100%' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button onClick={() => setShowAnularModal(false)} className="btn btn-secundario">
                Cancelar
              </button>
              
              <button 
                onClick={handleConfirmarAnulacion} 
                disabled={anulando} 
                className="btn btn-peligro" 
                style={{ backgroundColor: '#c53030' }}
              >
                {anulando ? 'Anulando...' : 'Confirmar Anulación'}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* MODAL WHATSAPP */}
      <WhatsAppModal 
        isOpen={showWhatsAppModal} 
        onClose={() => setShowWhatsAppModal(false)} 
        data={whatsAppData} 
      />

    </div>
  );
}

export default Ventas;
