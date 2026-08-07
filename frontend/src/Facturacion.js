import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { formatCurrency, parsePrecio } from './utils/formatters';
import { toast } from 'react-toastify';
import FieldError from './components/FieldError';
import FacturaTable from './FacturaTable';

// Icons
import { 
  MdReceipt, MdAddShoppingCart, MdRefresh, MdSearch, MdFilterList,
  MdClose, MdCheckCircle, MdBlock, MdUndo, MdPrint, MdStore, MdAttachMoney,
  MdDateRange, MdPerson, MdPictureAsPdf, MdOutlineDescription, MdDelete
} from 'react-icons/md';
import { FaFileExcel, FaFilePdf, FaPlus, FaFileInvoiceDollar, FaBuilding, FaWarehouse } from 'react-icons/fa';

import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { createDoc, tableToPdf, savePdf } from './utils/pdfUtils';

function Facturacion({ usuario }) {
  // Main Data States
  const [facturas, setFacturas] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [productos, setProductos] = useState([]);
  const [almacenes, setAlmacenes] = useState([]);
  const [empresa, setEmpresa] = useState({
    nombre: 'MULTINYECTORES Y REPUESTOS S.A.S.',
    nit: '900.123.456-7',
    direccion: 'Carrera 26 # 28-45, Tuluá - Valle del Cauca',
    telefono: '(602) 224-5000',
    correo: 'contacto@multinyectores.com'
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Search & Filter States
  const [search, setSearch] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('Todos');
  const [filtroAlmacen, setFiltroAlmacen] = useState('Todos');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');

  // Pagination
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Modal Nueva Factura
  const [showNuevaFacturaModal, setShowNuevaFacturaModal] = useState(false);
  const [form, setForm] = useState({
    clienteId: '',
    clienteNombre: '',
    documento: '',
    tipo_documento: 'CC',
    direccion: '',
    telefono: '',
    correo: '',
    productoId: '',
    productoNombre: '',
    cantidad: 1,
    descuento: 0,
    impuestos: 0,
    metodoPago: 'Efectivo',
    almacenId: usuario?.almacenId || 1,
    vendedor: usuario?.nombre || '',
    notas: '',
    fecha: new Date().toISOString().slice(0, 10)
  });
  const [carrito, setCarrito] = useState([]);
  const [savingFactura, setSavingFactura] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [modalError, setModalError] = useState('');

  // Modal Ver/Imprimir Factura
  const [showVerFacturaModal, setShowVerFacturaModal] = useState(false);
  const [facturaSeleccionada, setFacturaSeleccionada] = useState(null);
  const [loadingDetalle, setLoadingDetalle] = useState(false);

  // Modal Anular Factura
  const [showAnularModal, setShowAnularModal] = useState(false);
  const [facturaAAnular, setFacturaAAnular] = useState(null);
  const [motivoAnulacion, setMotivoAnulacion] = useState('');
  const [anulando, setAnulando] = useState(false);

  // Modal Confirmar Eliminar
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteId, setDeleteId] = useState(null);

  const isAdmin = usuario?.rol === 'admin';
  const tokenHeader = useMemo(() => `Bearer ${usuario?.token || localStorage.getItem('token') || ''}`, [usuario?.token]);

  // Cargar Facturas con Filtros
  const fetchFacturas = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      let url = '/facturas?';
      const params = new URLSearchParams();

      if (filtroEstado !== 'Todos') params.append('estado', filtroEstado);
      if (filtroAlmacen !== 'Todos') params.append('almacenId', filtroAlmacen);
      else if (!isAdmin && usuario?.almacenId) params.append('almacenId', usuario.almacenId);

      if (fechaInicio) params.append('fechaInicio', fechaInicio);
      if (fechaFin) params.append('fechaFin', fechaFin);
      if (search.trim()) params.append('q', search.trim());

      url += params.toString();

      const res = await fetch(url, { headers: { 'Authorization': tokenHeader } });
      if (!res.ok) throw new Error('Error al consultar las facturas');
      const data = await res.json();
      setFacturas(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || 'Error de conexión');
      setFacturas([]);
    } finally {
      setLoading(false);
    }
  }, [filtroEstado, filtroAlmacen, fechaInicio, fechaFin, search, isAdmin, usuario?.almacenId, tokenHeader]);

  // Cargar catalogos
  useEffect(() => {
    fetchFacturas();

    // Clientes
    fetch('/clientes', { headers: { 'Authorization': tokenHeader } })
      .then(r => r.json())
      .then(d => setClientes(Array.isArray(d) ? d : []))
      .catch(() => {});

    // Productos
    fetch('/productos', { headers: { 'Authorization': tokenHeader } })
      .then(r => r.json())
      .then(d => setProductos(Array.isArray(d) ? d : []))
      .catch(() => {});

    // Almacenes
    fetch('/almacenes', { headers: { 'Authorization': tokenHeader } })
      .then(r => r.json())
      .then(d => setAlmacenes(Array.isArray(d) ? d : []))
      .catch(() => {});

    // Datos Empresa
    fetch('/empresa', { headers: { 'Authorization': tokenHeader } })
      .then(r => r.json())
      .then(d => { if (d && !d.error) setEmpresa(d); })
      .catch(() => {});
  }, [fetchFacturas, tokenHeader]);

  // Seleccionar datos de Cliente para el formulario
  const clienteSeleccionado = useMemo(() => {
    return clientes.find(c => String(c.id) === String(form.clienteId));
  }, [clientes, form.clienteId]);

  useEffect(() => {
    if (clienteSeleccionado) {
      setForm(f => ({
        ...f,
        clienteNombre: clienteSeleccionado.nombre,
        documento: clienteSeleccionado.documento || '',
        tipo_documento: clienteSeleccionado.tipo_documento || 'CC',
        direccion: clienteSeleccionado.direccion || '',
        telefono: clienteSeleccionado.telefono || '',
        correo: clienteSeleccionado.correo || ''
      }));
    }
  }, [clienteSeleccionado]);

  // Agregar Producto al Carrito de Factura
  const handleAgregarProducto = () => {
    setModalError('');
    const errs = {};
    if (!form.productoNombre || !form.productoNombre.trim()) {
      errs.producto = 'Escriba o seleccione un producto';
      setFieldErrors(errs);
      setModalError('❌ Debe escribir o seleccionar un producto.');
      return;
    }
    if (!form.cantidad || Number(form.cantidad) <= 0) {
      errs.cantidad = 'Ingrese una cantidad válida';
      setFieldErrors(errs);
      setModalError('❌ La cantidad debe ser mayor a 0.');
      return;
    }

    let prod = productos.find(p => String(p.id) === String(form.productoId));
    if (!prod) {
      const searchVal = form.productoNombre.trim().toLowerCase();
      prod = productos.find(p => 
        p.nombre.toLowerCase() === searchVal || 
        (p.codigo_oem && p.codigo_oem.toLowerCase() === searchVal)
      );
    }

    if (!prod) {
      setFieldErrors({ producto: 'Producto no encontrado' });
      setModalError(`❌ No se encontró el producto "${form.productoNombre}". Selecciónelo del listado.`);
      return;
    }

    const esServicio = prod.tipo === 'servicio' || (prod.categoria && prod.categoria.toLowerCase().includes('servicio'));
    const almacenAct = form.almacenId || 1;
    let stockBodega = prod.stock || 0;
    if (Array.isArray(prod.almacenes)) {
      const almMatch = prod.almacenes.find(a => Number(a.id) === Number(almacenAct));
      if (almMatch && almMatch.stock !== undefined) stockBodega = Number(almMatch.stock || 0);
    }

    const enCarrito = carrito.find(item => item.productoId === prod.id && item.almacenId === almacenAct);
    const cantExistente = enCarrito ? enCarrito.cantidad : 0;
    const cantSolicitada = cantExistente + Number(form.cantidad);

    if (!esServicio) {
      if (stockBodega <= 0) {
        setModalError(`❌ No se puede agregar "${prod.nombre}". No hay stock disponible en la bodega seleccionada (Stock actual: 0).`);
        return;
      }
      if (cantSolicitada > stockBodega) {
        setModalError(`❌ Stock insuficiente para "${prod.nombre}" en la bodega seleccionada. Stock disponible: ${stockBodega}, en carrito: ${cantExistente}, intentas agregar: ${form.cantidad}.`);
        return;
      }
    }

    let precioBase = prod.precio_detal || prod.precio || 0;
    if (clienteSeleccionado) {
      if (clienteSeleccionado.tipo_cliente === 'Mayor' && prod.precio_mayor) precioBase = prod.precio_mayor;
      else if (clienteSeleccionado.tipo_cliente === 'Almacén' && prod.precio_almacen) precioBase = prod.precio_almacen;
      else if (clienteSeleccionado.tipo_cliente === 'Detal' && prod.precio_detal) precioBase = prod.precio_detal;
    }

    setCarrito(prev => {
      const idx = prev.findIndex(item => item.productoId === prod.id && item.almacenId === almacenAct);
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
          precio: parsePrecio(precioBase) || Number(precioBase) || 0,
          cantidad: Number(form.cantidad),
          almacenId: almacenAct,
          stockDisponible: stockBodega
        }
      ];
    });

    setForm(f => ({ ...f, productoId: '', productoNombre: '', cantidad: 1 }));
    setFieldErrors({});
    setModalError('');
  };

  const handleQuitarProducto = (productoId, almacenId) => {
    setCarrito(prev => prev.filter(p => !(p.productoId === productoId && p.almacenId === almacenId)));
  };

  const handleCambiarCantidad = (productoId, almacenId, nuevaCant) => {
    const num = Math.max(1, Number(nuevaCant) || 1);
    setCarrito(prev => prev.map(p => {
      if (p.productoId === productoId && p.almacenId === almacenId) {
        if (num > p.stockDisponible) {
          toast.warning(`Stock máximo en bodega: ${p.stockDisponible}`);
          return { ...p, cantidad: p.stockDisponible };
        }
        return { ...p, cantidad: num };
      }
      return p;
    }));
  };

  // Totales de Factura en Formulario
  const subtotalCarrito = carrito.reduce((acc, item) => acc + (item.precio * item.cantidad), 0);
  const montoDescuento = subtotalCarrito * (Number(form.descuento) || 0) / 100;
  const montoImpuestos = subtotalCarrito * (Number(form.impuestos) || 0) / 100;
  const totalCarrito = subtotalCarrito - montoDescuento + montoImpuestos;

  // Guardar Nueva Factura Directa
  const handleGuardarFactura = async (e) => {
    e.preventDefault();
    if (!form.clienteNombre && !form.clienteId) {
      toast.error('Ingrese el nombre o seleccione un cliente');
      return;
    }
    if (carrito.length === 0) {
      toast.error('Agregue al menos un producto a la factura');
      return;
    }

    setSavingFactura(true);
    try {
      const body = {
        cliente: form.clienteNombre || 'Cliente General',
        clienteId: form.clienteId || null,
        documento: form.documento,
        tipo_documento: form.tipo_documento,
        direccion: form.direccion,
        telefono: form.telefono,
        correo: form.correo,
        notas: form.notas,
        total: totalCarrito,
        fecha: form.fecha,
        almacenId: form.almacenId,
        metodoPago: form.metodoPago,
        descuento: Number(form.descuento) || 0,
        impuestos: Number(form.impuestos) || 0,
        vendedor: form.vendedor || usuario?.nombre || 'Sistema',
        detalles: carrito.map(item => ({
          productoId: item.productoId,
          cantidad: item.cantidad,
          precio: item.precio,
          almacenId: item.almacenId
        }))
      };

      const res = await fetch('/facturas', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': tokenHeader
        },
        body: JSON.stringify(body)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al emitir factura');

      toast.success('Factura emitida y registrada exitosamente');
      setShowNuevaFacturaModal(false);
      setCarrito([]);
      setForm(f => ({
        ...f,
        clienteId: '',
        clienteNombre: '',
        documento: '',
        notas: ''
      }));

      fetchFacturas();

      if (data.id) {
        handleVerFactura(data.id);
      }
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSavingFactura(false);
    }
  };

  // Abrir Modal de Ver / Imprimir Factura
  const handleVerFactura = async (facturaId) => {
    setLoadingDetalle(true);
    setShowVerFacturaModal(true);
    try {
      const res = await fetch(`/facturas/${facturaId}`, {
        headers: { 'Authorization': tokenHeader }
      });
      if (!res.ok) throw new Error('No se pudo obtener el detalle de la factura');
      const data = await res.json();
      setFacturaSeleccionada(data);
    } catch (err) {
      toast.error(err.message);
      setShowVerFacturaModal(false);
    } finally {
      setLoadingDetalle(false);
    }
  };

  // Generar y Descargar PDF Oficial
  const handleDescargarPDF = () => {
    if (!facturaSeleccionada || !facturaSeleccionada.factura) return;
    const f = facturaSeleccionada.factura;
    const emp = facturaSeleccionada.empresa || empresa;
    const detalles = f.DetalleFacturas || [];

    const doc = createDoc();
    let textX = 14;

    if (emp.logo_url && emp.logo_url.startsWith('data:image')) {
      try {
        doc.addImage(emp.logo_url, 'PNG', 14, 10, 28, 20);
        textX = 46;
      } catch (e) {
        console.error('Error al agregar logo al PDF:', e);
      }
    }

    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text(emp.nombre || 'MULTINYECTORES Y REPUESTOS', textX, 15);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`NIT: ${emp.nit || ''}`, textX, 20);
    
    let currentY = 24;
    if (emp.actividad_economica) {
      doc.text(`Giro: ${emp.actividad_economica}`, textX, currentY);
      currentY += 4;
    }
    doc.text(`Dirección: ${emp.direccion || ''}${emp.ciudad ? `, ${emp.ciudad}` : ''}`, textX, currentY);
    currentY += 4;
    doc.text(`Tel: ${emp.telefono || ''}${emp.telefono_secundario ? ` / ${emp.telefono_secundario}` : ''} | Correo: ${emp.correo || ''}`, textX, currentY);

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(`FACTURA DE VENTA N° FAC-${f.id}`, 135, 15);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`Fecha: ${new Date(f.fecha).toLocaleDateString()}`, 135, 20);
    doc.text(`Bodega: ${f.almacen?.nombre || 'Sede Principal'}`, 135, 24);

    const lineY = Math.max(currentY + 4, 34);
    doc.setDrawColor(200);
    doc.line(14, lineY, 196, lineY);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('DATOS DEL ADQUIRENTE', 14, lineY + 6);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`Cliente: ${f.cliente}`, 14, lineY + 11);
    doc.text(`Documento / NIT: ${f.documento || 'Venta Mostrador'}`, 14, lineY + 16);
    doc.text(`Dirección: ${f.direccion || 'N/A'}`, 14, lineY + 21);
    doc.text(`Teléfono: ${f.telefono || 'N/A'}`, 14, lineY + 26);

    const startY = lineY + 32;
    const finalY = tableToPdf(doc, {
      startY,
      head: [['Cant', 'Código OEM', 'Producto / Descripción', 'P. Unitario', 'Subtotal']],
      body: detalles.map(d => [
        d.cantidad,
        d.Producto?.codigo_oem || '-',
        d.Producto?.nombre || 'Producto',
        formatCurrency(d.precio_unitario),
        formatCurrency(d.precio_unitario * d.cantidad)
      ])
    });

    let y = (finalY || startY) + 10;
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(`TOTAL FACTURADO: ${formatCurrency(f.total)}`, 130, y);

    if (emp.pie_pagina_factura) {
      y += 12;
      doc.setFontSize(8);
      doc.setFont('helvetica', 'italic');
      doc.text(emp.pie_pagina_factura, 14, y, { maxWidth: 180 });
    }

    savePdf(doc, `Factura_FAC_${f.id}.pdf`);
  };

  // Abrir Modal Anulación
  const handleAbrirAnular = (factura) => {
    setFacturaAAnular(factura);
    setMotivoAnulacion('');
    setShowAnularModal(true);
  };

  // Confirmar Anulación
  const handleConfirmarAnulacion = async () => {
    if (!facturaAAnular) return;
    setAnulando(true);
    try {
      const res = await fetch(`/facturas/${facturaAAnular.id}/anular`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': tokenHeader
        },
        body: JSON.stringify({ motivoAnulacion })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al anular la factura');

      toast.success('Factura anulada e inventario reinsertado');
      setShowAnularModal(false);
      fetchFacturas();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setAnulando(false);
    }
  };

  // Eliminar Factura
  const handleDelete = (id) => {
    setDeleteId(id);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    try {
      const res = await fetch(`/facturas/${deleteId}`, {
        method: 'DELETE',
        headers: { 'Authorization': tokenHeader }
      });
      if (!res.ok) throw new Error('No se pudo eliminar la factura');

      toast.success('Factura eliminada');
      setShowDeleteModal(false);
      fetchFacturas();
    } catch (err) {
      toast.error(err.message);
    }
  };

  // Exportar Excel
  const exportExcel = () => {
    const data = facturas.map(f => ({
      'No. Factura': `FAC-${f.id}`,
      'No. Venta': f.ventaId ? `#${f.ventaId}` : '-',
      'Fecha': f.fecha ? new Date(f.fecha).toLocaleDateString() : '',
      'Cliente': f.cliente,
      'Documento': f.documento || '',
      'Bodega': f.almacenNombre || 'Sede Principal',
      'Método Pago': f.metodoPago || 'Efectivo',
      'Estado': f.estadoVenta || 'Pagada',
      'Total Net': Number(f.total || 0),
      'Notas': f.notas || ''
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Facturación');
    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { type: 'application/octet-stream' });
    saveAs(blob, `Facturacion_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  // Exportar PDF
  const exportPDF = () => {
    const doc = createDoc();
    doc.text('MULTINYECTORES - HISTORIAL DE FACTURACIÓN', 14, 16);
    tableToPdf(doc, {
      startY: 22,
      head: [['Factura', 'Fecha', 'Cliente', 'Documento', 'Bodega', 'Estado', 'Total']],
      body: facturas.map(f => [
        `FAC-${f.id}`,
        f.fecha ? f.fecha.slice(0, 10) : '',
        f.cliente,
        f.documento || '-',
        f.almacenNombre || 'Sede Principal',
        f.estadoVenta || 'Pagada',
        formatCurrency(f.total || 0)
      ])
    });
    savePdf(doc, `Facturas_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  // Métricas / KPIs
  const totalFacturadoCalculado = facturas
    .filter(f => f.estadoVenta !== 'Anulada')
    .reduce((acc, f) => acc + Number(f.total || 0), 0);

  const totalFacturas = facturas.length;
  const facturasPagadas = facturas.filter(f => f.estadoVenta === 'Pagada').length;
  const facturasAnuladas = facturas.filter(f => f.estadoVenta === 'Anulada').length;
  const ticketPromedio = totalFacturas > 0 ? totalFacturadoCalculado / Math.max(1, (totalFacturas - facturasAnuladas)) : 0;

  // Pagination logic
  const paginados = useMemo(() => {
    const start = (page - 1) * rowsPerPage;
    return facturas.slice(start, start + rowsPerPage);
  }, [facturas, page, rowsPerPage]);

  const totalPages = Math.ceil(facturas.length / rowsPerPage) || 1;

  return (
    <div style={{ padding: '4px 0' }}>
      
      {/* HEADER PRINCIPAL */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#1a202c', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FaFileInvoiceDollar color="#2b6cb0" /> Módulo de Facturación Electrónica & Legal
          </h1>
          <p style={{ margin: '4px 0 0 0', color: '#718096', fontSize: '14px' }}>
            Emisión de comprobantes, control fiscal, anulación con reversión automática de stock y consulta en tiempo real.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button 
            onClick={fetchFacturas} 
            className="btn btn-secundario" 
            style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#edf2f7', color: '#2d3748' }}
          >
            <MdRefresh size={18} /> Actualizar
          </button>
          
          <button 
            onClick={() => setShowNuevaFacturaModal(true)} 
            className="btn btn-principal" 
            style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: '#2b6cb0' }}
          >
            <FaPlus /> Emitir Nueva Factura
          </button>
        </div>
      </div>

      {/* KPI METRICS BAR */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '20px' }}>
        
        <div className="card" style={{ padding: '16px', background: '#ffffff', borderRadius: '10px', borderLeft: '4px solid #2b6cb0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: '12px', color: '#718096', textTransform: 'uppercase', fontWeight: 600 }}>Total Facturado</div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#2b6cb0', marginTop: '4px' }}>{formatCurrency(totalFacturadoCalculado)}</div>
          <div style={{ fontSize: '12px', color: '#4a5568', marginTop: '2px' }}>Facturación líquida activa</div>
        </div>

        <div className="card" style={{ padding: '16px', background: '#ffffff', borderRadius: '10px', borderLeft: '4px solid #38a169', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: '12px', color: '#718096', textTransform: 'uppercase', fontWeight: 600 }}>Ticket Promedio</div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#276749', marginTop: '4px' }}>{formatCurrency(ticketPromedio)}</div>
          <div style={{ fontSize: '12px', color: '#4a5568', marginTop: '2px' }}>Promedio por factura</div>
        </div>

        <div className="card" style={{ padding: '16px', background: '#ffffff', borderRadius: '10px', borderLeft: '4px solid #805ad5', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: '12px', color: '#718096', textTransform: 'uppercase', fontWeight: 600 }}>Comprobantes Emitidos</div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#553c9a', marginTop: '4px' }}>{totalFacturas} <span style={{ fontSize: '14px', fontWeight: 400 }}>docs</span></div>
          <div style={{ fontSize: '12px', color: '#4a5568', marginTop: '2px' }}>{facturasPagadas} vigentes</div>
        </div>

        <div className="card" style={{ padding: '16px', background: '#ffffff', borderRadius: '10px', borderLeft: '4px solid #e53e3e', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: '12px', color: '#718096', textTransform: 'uppercase', fontWeight: 600 }}>Facturas Anuladas</div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#c53030', marginTop: '4px' }}>{facturasAnuladas} <span style={{ fontSize: '14px', fontWeight: 400 }}>anulaciones</span></div>
          <div style={{ fontSize: '12px', color: '#4a5568', marginTop: '2px' }}>Reingresadas a bodega</div>
        </div>

      </div>

      {/* TOOLBAR DE BÚSQUEDA Y FILTROS */}
      <div className="card" style={{ padding: '16px', marginBottom: '20px', borderRadius: '8px', background: '#f7fafc', border: '1px solid #e2e8f0' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', alignItems: 'center' }}>
          
          <div style={{ position: 'relative' }}>
            <MdSearch style={{ position: 'absolute', left: '10px', top: '10px', color: '#a0aec0' }} size={20} />
            <input 
              type="text" 
              placeholder="Buscar por cliente, No. o NIT..." 
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

      {/* ERROR DISPLAY */}
      {error && <div className="alert alert-error" style={{ marginBottom: '16px' }}>{error}</div>}

      {/* TABLA PRINCIPAL DE FACTURAS */}
      <FacturaTable 
        facturas={paginados} 
        loading={loading} 
        handleVerFactura={handleVerFactura} 
        handleEdit={handleVerFactura} 
        handleDelete={handleDelete} 
        handleAbrirAnular={handleAbrirAnular} 
        usuario={usuario} 
      />

      {/* PAGINACIÓN */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ fontSize: '13px', color: '#718096' }}>
          Mostrando {paginados.length} de {facturas.length} facturas
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <select 
            value={rowsPerPage} 
            onChange={e => { setRowsPerPage(Number(e.target.value)); setPage(1); }} 
            className="input" 
            style={{ fontSize: '12px', padding: '2px 6px' }}
          >
            <option value={5}>5 por pág.</option>
            <option value={10}>10 por pág.</option>
            <option value={20}>20 por pág.</option>
            <option value={50}>50 por pág.</option>
          </select>

          <button 
            disabled={page <= 1} 
            onClick={() => setPage(p => p - 1)} 
            className="btn btn-secundario" 
            style={{ fontSize: '12px', padding: '4px 8px' }}
          >
            Anterior
          </button>

          <span style={{ fontSize: '13px', fontWeight: 600, color: '#2d3748' }}>
            Pág. {page} de {totalPages}
          </span>

          <button 
            disabled={page >= totalPages} 
            onClick={() => setPage(p => p + 1)} 
            className="btn btn-secundario" 
            style={{ fontSize: '12px', padding: '4px 8px' }}
          >
            Siguiente
          </button>
        </div>
      </div>

      {/* MODAL CREAR NUEVA FACTURA DIRECTA */}
      {showNuevaFacturaModal && (
        <div className="modal-backdrop">
          <div className="modal-card card" style={{ maxWidth: '950px', width: '95%', maxHeight: '92vh', overflowY: 'auto' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #ebf8ff', paddingBottom: '12px', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, color: '#2b6cb0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FaFileInvoiceDollar /> Emitir Nueva Factura Legal
              </h3>
              <button onClick={() => setShowNuevaFacturaModal(false)} className="btn btn-secundario" style={{ padding: '4px 8px' }}>
                <MdClose size={20} />
              </button>
            </div>

            <form onSubmit={handleGuardarFactura}>
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
                  gap: '10px'
                }}>
                  <span style={{ fontSize: '18px' }}>⚠️</span>
                  <span style={{ flex: 1 }}>{modalError}</span>
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
                
                {/* DATOS DEL CLIENTE */}
                <div style={{ background: '#f7fafc', padding: '14px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <label style={{ fontWeight: 600, color: '#2d3748', display: 'block', marginBottom: '6px' }}>Cliente / Razón Social *</label>
                  <select 
                    value={form.clienteId} 
                    onChange={e => setForm({ ...form, clienteId: e.target.value })} 
                    className="input" 
                    style={{ width: '100%', marginBottom: '10px' }}
                  >
                    <option value="">-- Seleccionar de la lista --</option>
                    {clientes.map(c => (
                      <option key={c.id} value={c.id}>{c.nombre} ({c.documento || 'Sin doc'}) - {c.tipo_cliente || 'Detal'}</option>
                    ))}
                  </select>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <div>
                      <label style={{ fontSize: '11px', fontWeight: 600 }}>Nombre / Razón</label>
                      <input 
                        type="text" 
                        value={form.clienteNombre} 
                        onChange={e => setForm({ ...form, clienteNombre: e.target.value })} 
                        className="input" 
                        style={{ width: '100%', fontSize: '12px' }} 
                        required
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: '11px', fontWeight: 600 }}>NIT / Documento</label>
                      <input 
                        type="text" 
                        value={form.documento} 
                        onChange={e => setForm({ ...form, documento: e.target.value })} 
                        className="input" 
                        style={{ width: '100%', fontSize: '12px' }} 
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '8px' }}>
                    <div>
                      <label style={{ fontSize: '11px', fontWeight: 600 }}>Teléfono</label>
                      <input 
                        type="text" 
                        value={form.telefono} 
                        onChange={e => setForm({ ...form, telefono: e.target.value })} 
                        className="input" 
                        style={{ width: '100%', fontSize: '12px' }} 
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: '11px', fontWeight: 600 }}>Dirección</label>
                      <input 
                        type="text" 
                        value={form.direccion} 
                        onChange={e => setForm({ ...form, direccion: e.target.value })} 
                        className="input" 
                        style={{ width: '100%', fontSize: '12px' }} 
                      />
                    </div>
                  </div>
                </div>

                {/* DATOS DE FACTURA */}
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
                        <option value="Transferencia">Transferencia Bancaria</option>
                        <option value="Tarjeta">Tarjeta Débito/Crédito</option>
                        <option value="Nequi/Daviplata">Nequi / Daviplata</option>
                        <option value="Cheque">Cheque</option>
                      </select>
                    </div>

                    <div>
                      <label style={{ fontWeight: 600, color: '#2d3748', fontSize: '12px' }}>Vendedor</label>
                      <input 
                        type="text" 
                        value={form.vendedor} 
                        onChange={e => setForm({ ...form, vendedor: e.target.value })} 
                        className="input" 
                        style={{ width: '100%', fontSize: '13px' }}
                      />
                    </div>

                    <div>
                      <label style={{ fontWeight: 600, color: '#2d3748', fontSize: '12px' }}>Fecha Emisión</label>
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

              {/* SECCIÓN PRODUCTOS */}
              <div style={{ background: '#edf2f7', padding: '14px', borderRadius: '8px', marginBottom: '16px' }}>
                <div style={{ fontWeight: 600, marginBottom: '8px', color: '#2d3748' }}>Buscador y Selección de Productos</div>
                
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 100px', gap: '10px', alignItems: 'flex-end' }}>
                  
                  <div>
                    <input 
                      type="text" 
                      placeholder="Nombre o código OEM del producto..." 
                      value={form.productoNombre} 
                      onChange={e => {
                        const val = e.target.value;
                        setForm(f => ({ ...f, productoNombre: val }));
                        setModalError('');
                        if (!val) {
                          setForm(f => ({ ...f, productoId: '' }));
                          return;
                        }
                        const searchVal = val.trim().toLowerCase();
                        const match = productos.find(p => 
                          p.nombre.toLowerCase() === searchVal || 
                          (p.codigo_oem && p.codigo_oem.toLowerCase() === searchVal)
                        );
                        if (match) {
                          setForm(f => ({ ...f, productoId: String(match.id) }));
                          const isServ = match.tipo === 'servicio' || (match.categoria && match.categoria.toLowerCase().includes('servicio'));
                          const almacenAct = form.almacenId || 1;
                          let stockBodega = match.stock || 0;
                          if (Array.isArray(match.almacenes)) {
                            const almMatch = match.almacenes.find(a => Number(a.id) === Number(almacenAct));
                            if (almMatch && almMatch.stock !== undefined) stockBodega = Number(almMatch.stock || 0);
                          }
                          if (!isServ && stockBodega <= 0) {
                            setModalError(`❌ El producto "${match.nombre}" NO tiene stock disponible en la bodega seleccionada (Stock: 0).`);
                          }
                        } else {
                          setForm(f => ({ ...f, productoId: '' }));
                        }
                      }} 
                      className="input" 
                      style={{ width: '100%' }}
                      list="fact-productos-list"
                    />
                    <datalist id="fact-productos-list">
                      {productos.map(p => (
                        <option key={p.id} value={p.nombre} label={`OEM: ${p.codigo_oem || '-'} | Stock: ${p.stock}`}></option>
                      ))}
                    </datalist>
                    {fieldErrors.producto && <FieldError>{fieldErrors.producto}</FieldError>}
                  </div>

                  <div>
                    <input 
                      type="number" 
                      min="1" 
                      value={form.cantidad} 
                      onChange={e => setForm({ ...form, cantidad: e.target.value })} 
                      className="input" 
                      placeholder="Cantidad" 
                      style={{ width: '100%' }}
                    />
                  </div>

                  <button 
                    type="button" 
                    onClick={handleAgregarProducto} 
                    className="btn btn-principal" 
                    style={{ backgroundColor: '#38a169', width: '100%' }}
                  >
                    <FaPlus /> Agregar
                  </button>

                </div>
              </div>

              {/* TABLA DE PRODUCTOS EN FACTURA */}
              <div style={{ marginBottom: '16px', overflowX: 'auto' }}>
                <table className="usuarios-table" style={{ width: '100%', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ background: '#e2e8f0' }}>
                      <th style={{ padding: '8px' }}>Producto</th>
                      <th style={{ padding: '8px' }}>OEM</th>
                      <th style={{ padding: '8px', textAlign: 'center' }}>Cantidad</th>
                      <th style={{ padding: '8px', textAlign: 'right' }}>P. Unitario</th>
                      <th style={{ padding: '8px', textAlign: 'right' }}>Subtotal</th>
                      <th style={{ padding: '8px', textAlign: 'center' }}>Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {carrito.length === 0 ? (
                      <tr>
                        <td colSpan={6} style={{ textAlign: 'center', padding: '20px', color: '#a0aec0' }}>
                          Sin items agregados.
                        </td>
                      </tr>
                    ) : (
                      carrito.map(item => (
                        <tr key={`${item.productoId}-${item.almacenId}`}>
                          <td style={{ padding: '8px', fontWeight: 600 }}>{item.nombre}</td>
                          <td style={{ padding: '8px', color: '#718096' }}>{item.codigo_oem || '-'}</td>
                          <td style={{ padding: '8px', textAlign: 'center' }}>
                            <input 
                              type="number" 
                              min="1" 
                              value={item.cantidad} 
                              onChange={e => handleCambiarCantidad(item.productoId, item.almacenId, e.target.value)} 
                              style={{ width: '60px', padding: '2px 4px', textAlign: 'center' }}
                            />
                          </td>
                          <td style={{ padding: '8px', textAlign: 'right' }}>{formatCurrency(item.precio)}</td>
                          <td style={{ padding: '8px', textAlign: 'right', fontWeight: 700, color: '#276749' }}>
                            {formatCurrency(item.precio * item.cantidad)}
                          </td>
                          <td style={{ padding: '8px', textAlign: 'center' }}>
                            <button 
                              type="button" 
                              onClick={() => handleQuitarProducto(item.productoId, item.almacenId)} 
                              className="btn" 
                              style={{ color: '#e53e3e', background: '#fff5f5', padding: '2px 6px' }}
                            >
                              <MdDelete size={16} />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* TOTALES */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', background: '#ebf8ff', padding: '14px', borderRadius: '8px', marginBottom: '16px' }}>
                
                <div>
                  <label style={{ fontWeight: 600, fontSize: '12px' }}>Observaciones de la Factura</label>
                  <textarea 
                    value={form.notas} 
                    onChange={e => setForm({ ...form, notas: e.target.value })} 
                    className="input" 
                    rows={2} 
                    placeholder="Notas o términos de garantía" 
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
                    Total Factura: {formatCurrency(totalCarrito)}
                  </div>
                </div>

              </div>

              {/* BOTONES */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" onClick={() => setShowNuevaFacturaModal(false)} className="btn btn-secundario">
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  disabled={savingFactura || carrito.length === 0} 
                  className="btn btn-principal" 
                  style={{ backgroundColor: '#2b6cb0' }}
                >
                  {savingFactura ? 'Guardando...' : 'Emitir Factura'}
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* MODAL VER / IMPRIMIR FACTURA OFICIAL */}
      {showVerFacturaModal && (
        <div className="modal-backdrop">
          <div className="modal-card card" style={{ maxWidth: '750px', width: '90%', maxHeight: '90vh', overflowY: 'auto', background: '#ffffff' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '10px', marginBottom: '16px' }}>
              <span style={{ fontWeight: 700, color: '#2d3748', fontSize: '16px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <FaFileInvoiceDollar color="#2b6cb0" /> Vista Previa de Factura Legal
              </span>
              <button onClick={() => setShowVerFacturaModal(false)} className="btn btn-secundario" style={{ padding: '2px 6px' }}>
                <MdClose size={18} />
              </button>
            </div>

            {loadingDetalle ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#718096' }}>Cargando factura...</div>
            ) : facturaSeleccionada && facturaSeleccionada.factura ? (
              <div>
                
                {/* COMPROBANTE CABECERA */}
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #2b6cb0', paddingBottom: '12px', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    {(facturaSeleccionada.empresa?.logo_url || empresa?.logo_url) && (
                      <img 
                        src={facturaSeleccionada.empresa?.logo_url || empresa?.logo_url} 
                        alt="Logo Empresa" 
                        style={{ maxHeight: '60px', maxWidth: '140px', objectFit: 'contain' }} 
                      />
                    )}
                    <div>
                      <h2 style={{ margin: 0, fontSize: '18px', color: '#2b6cb0', fontWeight: 800 }}>
                        {facturaSeleccionada.empresa?.nombre || empresa?.nombre || 'MULTINYECTORES Y REPUESTOS S.A.S.'}
                      </h2>
                      <div style={{ fontSize: '12px', color: '#4a5568' }}>
                        NIT: {facturaSeleccionada.empresa?.nit || empresa?.nit || '900.123.456-7'}
                      </div>
                      {(facturaSeleccionada.empresa?.actividad_economica || empresa?.actividad_economica) && (
                        <div style={{ fontSize: '11px', color: '#718096', fontStyle: 'italic' }}>
                          {facturaSeleccionada.empresa?.actividad_economica || empresa?.actividad_economica}
                        </div>
                      )}
                      <div style={{ fontSize: '12px', color: '#4a5568' }}>
                        {facturaSeleccionada.empresa?.direccion || empresa?.direccion || 'Tuluá - Valle'}
                        {(facturaSeleccionada.empresa?.ciudad || empresa?.ciudad) ? `, ${facturaSeleccionada.empresa?.ciudad || empresa?.ciudad}` : ''}
                      </div>
                      <div style={{ fontSize: '12px', color: '#4a5568' }}>
                        Tel: {facturaSeleccionada.empresa?.telefono || empresa?.telefono || '(602) 224-5000'}
                        {(facturaSeleccionada.empresa?.telefono_secundario || empresa?.telefono_secundario) ? ` / ${facturaSeleccionada.empresa?.telefono_secundario || empresa?.telefono_secundario}` : ''}
                      </div>
                      {(facturaSeleccionada.empresa?.correo || empresa?.correo) && (
                        <div style={{ fontSize: '11px', color: '#718096' }}>
                          {facturaSeleccionada.empresa?.correo || empresa?.correo}
                        </div>
                      )}
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '16px', fontWeight: 800, color: '#c53030' }}>
                      FACTURA N° FAC-{facturaSeleccionada.factura.id}
                    </div>
                    <div style={{ fontSize: '12px', color: '#4a5568' }}>
                      Fecha: {new Date(facturaSeleccionada.factura.fecha).toLocaleDateString()}
                    </div>
                    <div style={{ fontSize: '12px', color: '#4a5568' }}>
                      Bodega: {facturaSeleccionada.factura.almacen?.nombre || 'Sede Principal'}
                    </div>
                  </div>
                </div>

                {/* ADQUIRENTE */}
                <div style={{ background: '#f7fafc', padding: '12px', borderRadius: '6px', marginBottom: '16px', fontSize: '13px' }}>
                  <div style={{ fontWeight: 700, color: '#2d3748', marginBottom: '4px' }}>DATOS DEL ADQUIRENTE</div>
                  <div><b>Cliente:</b> {facturaSeleccionada.factura.cliente}</div>
                  <div><b>Documento/NIT:</b> {facturaSeleccionada.factura.documento || 'Venta Mostrador'}</div>
                  <div><b>Dirección:</b> {facturaSeleccionada.factura.direccion || 'N/A'} | <b>Tel:</b> {facturaSeleccionada.factura.telefono || 'N/A'}</div>
                </div>

                {/* DETALLE ARTICULOS */}
                <table className="usuarios-table" style={{ width: '100%', fontSize: '12px', marginBottom: '16px' }}>
                  <thead>
                    <tr style={{ background: '#edf2f7' }}>
                      <th style={{ padding: '8px' }}>Cant</th>
                      <th style={{ padding: '8px' }}>OEM</th>
                      <th style={{ padding: '8px' }}>Producto</th>
                      <th style={{ padding: '8px', textAlign: 'right' }}>P. Unitario</th>
                      <th style={{ padding: '8px', textAlign: 'right' }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(facturaSeleccionada.factura.DetalleFacturas || []).map((d, i) => (
                      <tr key={i}>
                        <td style={{ padding: '8px' }}>{d.cantidad}</td>
                        <td style={{ padding: '8px', color: '#718096' }}>{d.Producto?.codigo_oem || '-'}</td>
                        <td style={{ padding: '8px', fontWeight: 600 }}>{d.Producto?.nombre || 'Producto'}</td>
                        <td style={{ padding: '8px', textAlign: 'right' }}>{formatCurrency(d.precio_unitario)}</td>
                        <td style={{ padding: '8px', textAlign: 'right', fontWeight: 700 }}>
                          {formatCurrency(d.precio_unitario * d.cantidad)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* RESUMEN DE TOTALES */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', background: '#ebf8ff', padding: '12px', borderRadius: '6px', marginBottom: '16px' }}>
                  <div style={{ fontSize: '12px', color: '#4a5568', maxWidth: '300px' }}>
                    <b>Notas / Observaciones:</b><br />
                    {facturaSeleccionada.factura.notas || 'Sin observaciones.'}
                  </div>

                  <div style={{ textAlign: 'right', fontSize: '18px', fontWeight: 800, color: '#276749' }}>
                    TOTAL: {formatCurrency(facturaSeleccionada.factura.total)}
                  </div>
                </div>

                {(facturaSeleccionada.empresa?.pie_pagina_factura || empresa?.pie_pagina_factura) && (
                  <div style={{ textAlign: 'center', marginBottom: '16px', paddingTop: '8px', borderTop: '1px dashed #cbd5e0', fontSize: '11px', color: '#718096', fontStyle: 'italic' }}>
                    {facturaSeleccionada.empresa?.pie_pagina_factura || empresa?.pie_pagina_factura}
                  </div>
                )}

                {/* BOTONES ACCION */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                  <button onClick={() => window.print()} className="btn btn-secundario" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <MdPrint /> Imprimir
                  </button>
                  <button onClick={handleDescargarPDF} className="btn btn-principal" style={{ backgroundColor: '#c53030', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <FaFilePdf /> Descargar PDF
                  </button>
                </div>

              </div>
            ) : null}

          </div>
        </div>
      )}

      {/* MODAL ANULAR FACTURA */}
      {showAnularModal && (
        <div className="modal-backdrop">
          <div className="modal-card card" style={{ maxWidth: '480px', width: '90%' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #fed7d7', paddingBottom: '10px', marginBottom: '12px' }}>
              <h3 style={{ margin: 0, color: '#e53e3e', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <MdBlock /> Confirmar Anulación de Factura
              </h3>
              <button onClick={() => setShowAnularModal(false)} className="btn btn-secundario" style={{ padding: '2px 6px' }}>
                <MdClose size={18} />
              </button>
            </div>

            <p style={{ fontSize: '13px', color: '#4a5568' }}>
              ¿Está seguro de anular la factura <b>FAC-{facturaAAnular?.id}</b>?
              <br /><br />
              <b>Importante:</b> Al anular la factura, las cantidades de productos serán reingresadas automáticamente al inventario de la bodega correspondiente.
            </p>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600, color: '#2d3748', display: 'block', marginBottom: '4px' }}>Motivo de la Anulación</label>
              <textarea 
                value={motivoAnulacion} 
                onChange={e => setMotivoAnulacion(e.target.value)} 
                className="input" 
                rows={2} 
                placeholder="Ej: Error en digitación / Devolución de cliente" 
                style={{ width: '100%', fontSize: '12px' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button onClick={() => setShowAnularModal(false)} className="btn btn-secundario">
                Cancelar
              </button>
              <button 
                onClick={handleConfirmarAnulacion} 
                disabled={anulando} 
                className="btn btn-principal" 
                style={{ backgroundColor: '#e53e3e' }}
              >
                {anulando ? 'Anulando...' : 'Confirmar Anulación'}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* MODAL CONFIRMAR ELIMINAR */}
      {showDeleteModal && (
        <div className="modal-backdrop">
          <div className="modal-card card" style={{ maxWidth: '400px', width: '90%', textAlign: 'center' }}>
            <h3 style={{ color: '#e53e3e', marginTop: 0 }}>¿Eliminar Factura?</h3>
            <p style={{ fontSize: '13px', color: '#718096' }}>Esta acción eliminará el registro de la factura permanentemente.</p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginTop: '16px' }}>
              <button onClick={() => setShowDeleteModal(false)} className="btn btn-secundario">Cancelar</button>
              <button onClick={confirmDelete} className="btn btn-principal" style={{ backgroundColor: '#e53e3e' }}>Eliminar</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default Facturacion;
