import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { formatCurrency, parsePrecio, hoyColombia } from './utils/formatters';
import { toast } from 'react-toastify';
import FieldError from './components/FieldError';
import FacturaTable from './FacturaTable';
import { puede } from './config/permisos';

// Icons
import { 
  MdReceipt, MdAddShoppingCart, MdRefresh, MdSearch, MdFilterList,
  MdClose, MdCheckCircle, MdBlock, MdUndo, MdPrint, MdStore, MdAttachMoney,
  MdDateRange, MdPerson, MdPictureAsPdf, MdOutlineDescription, MdDelete,
  MdEdit
} from 'react-icons/md';
import { FaFileExcel, FaFilePdf, FaPlus, FaFileInvoiceDollar, FaBuilding, FaWarehouse, FaWhatsapp } from 'react-icons/fa';

import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { createDoc, tableToPdf, savePdf } from './utils/pdfUtils';
import WhatsAppModal from './components/WhatsAppModal';
import { buildWhatsAppDocumentMessage } from './utils/whatsapp';

function Facturacion({ usuario, onNavigate }) {
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
    precioServicio: '',
    descuento: 0,
    impuestos: 0,
    metodoPago: 'Efectivo',
    almacenId: usuario?.almacenId || 1,
    vendedor: usuario?.nombre || '',
    notas: '',
    fecha: hoyColombia()
  });
  const [carrito, setCarrito] = useState([]);
  const [savingFactura, setSavingFactura] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [modalError, setModalError] = useState('');

  // Modal Ver/Imprimir Factura
  const [showVerFacturaModal, setShowVerFacturaModal] = useState(false);
  const [facturaSeleccionada, setFacturaSeleccionada] = useState(null);
  const [loadingDetalle, setLoadingDetalle] = useState(false);

  // Modal WhatsApp Directo
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [whatsAppData, setWhatsAppData] = useState(null);

  // Modal Anular Factura
  const [showAnularModal, setShowAnularModal] = useState(false);
  const [facturaAAnular, setFacturaAAnular] = useState(null);
  const [motivoAnulacion, setMotivoAnulacion] = useState('');
  const [anulando, setAnulando] = useState(false);

  // Modal Confirmar Eliminar
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteId, setDeleteId] = useState(null);

  // Modal Modificar Factura
  const [showEditModal, setShowEditModal] = useState(false);
  const [facturaEditando, setFacturaEditando] = useState(null);
  const [guardandoEdicion, setGuardandoEdicion] = useState(false);

  // Modal Certificar Ingreso y Facturar
  const [showCertificarModal, setShowCertificarModal] = useState(false);
  const [facturaACertificar, setFacturaACertificar] = useState(null);
  const [metodoPagoCertificar, setMetodoPagoCertificar] = useState('Efectivo');
  const [montoRecibidoCertificar, setMontoRecibidoCertificar] = useState('');
  const [referenciaCertificar, setReferenciaCertificar] = useState('');
  const [observacionesCertificar, setObservacionesCertificar] = useState('');
  const [certificacionConfirmada, setCertificacionConfirmada] = useState(false);
  const [certificando, setCertificando] = useState(false);
  const [desglosePago, setDesglosePago] = useState([
    { metodo: 'Efectivo', monto: '', referencia: '' },
    { metodo: 'Transferencia', monto: '', referencia: '' }
  ]);

  const isAdmin = puede(usuario, 'almacenes.gestionar');
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

  // Agregar Producto o Servicio al Carrito de Factura
  const handleAgregarProducto = () => {
    setModalError('');
    const errs = {};
    if (!form.productoNombre || !form.productoNombre.trim()) {
      errs.producto = 'Escriba o seleccione un producto o servicio';
      setFieldErrors(errs);
      setModalError('❌ Debe escribir o seleccionar un producto o servicio.');
      return;
    }
    if (!form.cantidad || Number(form.cantidad) <= 0) {
      errs.cantidad = 'Ingrese una cantidad válida';
      setFieldErrors(errs);
      setModalError('❌ La cantidad debe ser mayor a 0.');
      return;
    }

    let prod = productoSeleccionado;
    if (!prod) {
      const searchVal = form.productoNombre.trim().toLowerCase();
      prod = productos.find(p => 
        p.nombre.toLowerCase() === searchVal || 
        (p.codigo_oem && p.codigo_oem.toLowerCase() === searchVal)
      );
    }

    if (!prod) {
      setFieldErrors({ producto: 'Ítem no encontrado' });
      setModalError(`❌ No se encontró el ítem "${form.productoNombre}". Selecciónelo del listado.`);
      return;
    }

    const esServicio = prod.tipo === 'servicio' || (prod.categoria && prod.categoria.toLowerCase().includes('servicio'));

    // Si es un SERVICIO: Es obligatorio colocar el valor del trabajo
    if (esServicio) {
      const valorNum = Number(form.precioServicio);
      if (!form.precioServicio || isNaN(valorNum) || valorNum <= 0) {
        setFieldErrors({ precioServicio: 'Debe colocar el valor del servicio' });
        setModalError(`❌ El ítem "${prod.nombre}" es un SERVICIO. Debe colocar el valor a cobrar por este trabajo.`);
        return;
      }
    }

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

    let precioFinal = 0;
    if (esServicio) {
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
      const idx = prev.findIndex(item => 
        item.productoId === prod.id && 
        item.almacenId === almacenAct &&
        (!esServicio || item.precio === precioFinal)
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
          isServicio: esServicio
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
          toast.warning(`Stock máximo en bodega: ${item.stockDisponible}`);
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
    const v = facturaSeleccionada.venta;
    const emp = facturaSeleccionada.empresa || empresa;
    const detalles = f.DetalleFacturas || [];
    const abonos = f.Abonos || facturaSeleccionada.Abonos || [];
    const totalFactura = Number(f.total || 0);
    const totalAbonado = facturaSeleccionada.totalAbonado != null 
      ? Number(facturaSeleccionada.totalAbonado) 
      : abonos.reduce((acc, ab) => acc + Number(ab.monto || 0), 0);
    const saldoPendiente = facturaSeleccionada.saldoPendiente != null 
      ? Number(facturaSeleccionada.saldoPendiente) 
      : Math.max(0, totalFactura - totalAbonado);
    const metodoPago = facturaSeleccionada.metodoPago || (v && v.metodoPago) || f.metodoPago || 'Efectivo';
    const esCredito = Boolean(
      facturaSeleccionada.esCredito || 
      (metodoPago && (
        metodoPago.toLowerCase().includes('credito') || 
        metodoPago.toLowerCase().includes('crédito')
      ))
    );
    const tieneAbonos = abonos.length > 0 || totalAbonado > 0;
    const isAnulada = Boolean(
      f.fechaAnulacion ||
      f.motivoAnulacion ||
      (v && v.estado === 'Anulada') ||
      (f.notas && f.notas.includes('[ANULADA]'))
    );
    const enCartera = Boolean(!isAnulada && (facturaSeleccionada.enCartera || (v && v.estado === 'En Cartera') || ((esCredito || tieneAbonos) && saldoPendiente > 0.01)));
    const isPendiente = !isAnulada && !enCartera && (v ? v.estado === 'Pendiente' : false);
    const estadoTexto = isAnulada ? 'ANULADA' : (enCartera ? 'EN CARTERA (CRÉDITO)' : (isPendiente ? 'PENDIENTE' : 'PAGADA'));

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
    doc.text(`COMPROBANTE DE VENTA N° FAC-${f.id}`, 135, 15);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`Fecha: ${new Date(f.fecha).toLocaleDateString('es-CO', { timeZone: 'America/Bogota' })}`, 135, 20);
    doc.text(`Bodega: ${f.almacen?.nombre || 'Sede Principal'}`, 135, 24);
    doc.text(`Método Pago: ${metodoPago}`, 135, 28);
    doc.setFont('helvetica', 'bold');
    doc.text(`Estado: ${estadoTexto}`, 135, 32);

    const lineY = Math.max(currentY + 4, 36);
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

    if (enCartera) {
      y += 5;
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text(`Total Abonado: ${formatCurrency(totalAbonado)}`, 130, y);
      y += 5;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text(`SALDO EN CARTERA: ${formatCurrency(saldoPendiente)}`, 130, y);
    } else if (!isAnulada && !isPendiente) {
      y += 5;
      doc.setFontSize(9);
      doc.setFont('helvetica', 'italic');
      doc.text(`Estado: Pagada (Paz y Salvo)`, 130, y);
    }

    if (emp.pie_pagina_factura) {
      y += 12;
      doc.setFontSize(8);
      doc.setFont('helvetica', 'italic');
      doc.text(emp.pie_pagina_factura, 14, y, { maxWidth: 180 });
    }

    savePdf(doc, `Factura_FAC_${f.id}.pdf`);
  };

  // Abrir Modal de Envío por WhatsApp para Factura
  const handleAbrirWhatsAppFactura = async (f, empData) => {
    if (!f) return;
    let facturaFull = f;
    let emp = empData;

    // Si no tiene los detalles cargados, consultar endpoint de detalle
    if (!facturaFull.DetalleFacturas || facturaFull.DetalleFacturas.length === 0) {
      try {
        const res = await fetch(`/facturas/${f.id}`, {
          headers: { 'Authorization': tokenHeader }
        });
        if (res.ok) {
          const data = await res.json();
          if (data.factura) {
            facturaFull = {
              ...data.factura,
              token_publico: data.factura.token_publico || data.token_publico
            };
          }
          if (data.empresa && !emp) emp = data.empresa;
          if (data.enCartera != null) facturaFull.enCartera = data.enCartera;
          if (data.saldoPendiente != null) facturaFull.saldoPendiente = data.saldoPendiente;
          if (data.totalAbonado != null) facturaFull.totalAbonado = data.totalAbonado;
        }
      } catch (e) {
        console.warn('Error al cargar datos completos de factura para WhatsApp:', e);
      }
    }

    const isCotiz = (facturaFull.notas && facturaFull.notas.toLowerCase().includes('cotiz'));
    const tipoDoc = isCotiz ? 'Cotización' : 'Factura Legal';
    const numero = isCotiz ? `COT-${facturaFull.id}` : `FAC-${facturaFull.id}`;
    const clienteNombre = facturaFull.cliente || facturaFull.Cliente?.nombre || 'Cliente General';
    const clienteTel = facturaFull.telefono || facturaFull.Cliente?.telefono || facturaFull.Cliente?.celular || '';
    const items = facturaFull.DetalleFacturas || [];

    const totalFactura = Number(facturaFull.total || 0);
    const totalAbonado = Number(facturaFull.totalAbonado || 0);
    const saldoPendiente = facturaFull.saldoPendiente != null ? Number(facturaFull.saldoPendiente) : Math.max(0, totalFactura - totalAbonado);
    const metodoPagoVal = facturaFull.metodoPago || 'Efectivo';
    const esCreditoVal = Boolean(metodoPagoVal && (metodoPagoVal.toLowerCase().includes('credito') || metodoPagoVal.toLowerCase().includes('crédito')));
    const enCartera = Boolean(facturaFull.enCartera || facturaFull.estadoVenta === 'En Cartera' || (esCreditoVal && saldoPendiente > 0.01));

    const estadoFactura = facturaFull.estadoVenta === 'Pendiente'
      ? 'Pendiente de Pago' 
      : (enCartera ? 'En Cartera (Crédito)' : (facturaFull.estadoVenta || 'Pagada'));

    const tokenFactura = facturaFull.token_publico || facturaFull.id;
    const publicUrl = `${window.location.origin}/facturas/public/${tokenFactura}`;
    const empFinal = emp || empresa || { nombre: 'Multinyectores Colombia', direccion: 'Tuluá - Valle del Cauca', telefono: '(602) 224-5000' };

    const mensaje = buildWhatsAppDocumentMessage({
      tipoDoc,
      numero,
      cliente: clienteNombre,
      fecha: facturaFull.fecha,
      total: facturaFull.total,
      metodoPago: facturaFull.metodoPago || 'Efectivo',
      estado: estadoFactura,
      items,
      empresa: empFinal,
      notas: facturaFull.notas,
      publicUrl
    });

    setWhatsAppData({
      tipoDoc,
      numero,
      cliente: clienteNombre,
      documento: facturaFull.documento || '',
      direccion: facturaFull.direccion || '',
      telefono: clienteTel,
      bodega: facturaFull.almacen?.nombre || 'Sede Principal',
      metodoPago: facturaFull.metodoPago || 'Efectivo',
      fecha: facturaFull.fecha,
      items,
      total: facturaFull.total,
      descuento: facturaFull.descuento || 0,
      impuestos: facturaFull.impuestos || 0,
      notas: facturaFull.notas,
      empresa: empFinal,
      publicUrl,
      mensaje
    });
    setShowWhatsAppModal(true);
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
    if (!motivoAnulacion || !motivoAnulacion.trim()) {
      toast.warning('El motivo de anulación es obligatorio');
      return;
    }
    setAnulando(true);
    try {
      const res = await fetch(`/facturas/${facturaAAnular.id}/anular`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': tokenHeader
        },
        body: JSON.stringify({ motivoAnulacion: motivoAnulacion.trim() })
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

  // Eliminar Factura (Prohibido por regla de negocio)
  const handleDelete = () => {
    toast.error('Las facturas y ventas no se eliminan; use Anular');
  };

  // Abrir Modal Editar Factura
  const handleAbrirEditar = (factura) => {
    setFacturaEditando({
      id: factura.id,
      cliente: factura.cliente || '',
      documento: factura.documento || '',
      tipo_documento: factura.tipo_documento || 'CC',
      direccion: factura.direccion || '',
      telefono: factura.telefono || '',
      correo: factura.correo || '',
      metodoPago: factura.metodoPago || 'Efectivo',
      notas: factura.notas || '',
      total: factura.total || 0,
      fecha: factura.fecha ? hoyColombia(factura.fecha) : hoyColombia()
    });
    setShowEditModal(true);
  };

  // Guardar Edición / Modificación de Factura
  const handleGuardarEdicion = async (e) => {
    e.preventDefault();
    if (!facturaEditando) return;
    setGuardandoEdicion(true);
    try {
      const res = await fetch(`/facturas/${facturaEditando.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': tokenHeader
        },
        body: JSON.stringify(facturaEditando)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al modificar la factura');

      toast.success('Factura modificada exitosamente');
      setShowEditModal(false);
      fetchFacturas();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setGuardandoEdicion(false);
    }
  };

  // Abrir Modal Certificar Pago
  const handleAbrirCertificar = (factura) => {
    setFacturaACertificar(factura);
    const esMixto = (factura.metodoPago && factura.metodoPago.toLowerCase().includes('mixto'));
    setMetodoPagoCertificar(esMixto ? 'Mixto' : (factura.metodoPago || 'Efectivo'));
    setMontoRecibidoCertificar(factura.total || '');
    setReferenciaCertificar('');
    setObservacionesCertificar('');
    setCertificacionConfirmada(false);

    // Inicializar desglose en dos métodos sugeridos
    const total = Number(factura.total || 0);
    const mitad = Math.round(total / 2);
    const resto = total - mitad;
    setDesglosePago([
      { metodo: 'Efectivo', monto: mitad > 0 ? mitad : '', referencia: '' },
      { metodo: 'Transferencia', monto: resto > 0 ? resto : '', referencia: '' }
    ]);

    setShowCertificarModal(true);
  };

  // Confirmar Certificación del Ingreso y Facturación
  const handleConfirmarCertificacion = async (e) => {
    e.preventDefault();
    if (!facturaACertificar) return;
    if (!certificacionConfirmada) {
      toast.error('Debe confirmar la casilla de verificación de ingreso del dinero.');
      return;
    }

    // Validar Pago Mixto si está seleccionado
    let desgloseParaEnviar = null;
    if (metodoPagoCertificar === 'Mixto') {
      const lineasValidas = desglosePago.filter(d => Number(d.monto) > 0);
      if (lineasValidas.length < 2) {
        toast.error('En Pago Mixto debe ingresar al menos 2 métodos de pago con montos válidos.');
        return;
      }
      const sumaDesglose = lineasValidas.reduce((sum, d) => sum + Number(d.monto), 0);
      const totalEsperado = Number(facturaACertificar.total || 0);
      if (sumaDesglose < totalEsperado) {
        toast.error(`La suma de los métodos ($${sumaDesglose.toLocaleString('es-CO')}) no cubre el total de la factura ($${totalEsperado.toLocaleString('es-CO')}). Faltan $${(totalEsperado - sumaDesglose).toLocaleString('es-CO')}.`);
        return;
      }
      desgloseParaEnviar = lineasValidas;
    }

    setCertificando(true);
    try {
      const res = await fetch(`/facturas/${facturaACertificar.id}/certificar`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': tokenHeader
        },
        body: JSON.stringify({
          metodoPago: metodoPagoCertificar,
          montoRecibido: montoRecibidoCertificar,
          referenciaPago: referenciaCertificar,
          observaciones: observacionesCertificar,
          desglosePago: desgloseParaEnviar
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al certificar el pago');

      toast.success('¡Ingreso de dinero certificado y factura emitida con éxito!');
      setShowCertificarModal(false);
      fetchFacturas();

      // Abrir comprobante para imprimir/ver
      handleVerFactura(facturaACertificar.id);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setCertificando(false);
    }
  };

  // Exportar Excel
  const exportExcel = () => {
    const data = facturas.map(f => ({
      'No. Factura': `FAC-${f.id}`,
      'No. Venta': f.ventaId ? `#${f.ventaId}` : '-',
      'Fecha': f.fecha ? new Date(f.fecha).toLocaleDateString('es-CO', { timeZone: 'America/Bogota' }) : '',
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
    saveAs(blob, `Facturacion_${hoyColombia()}.xlsx`);
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
    savePdf(doc, `Facturas_${hoyColombia()}.pdf`);
  };

  // Métricas / KPIs
  const facturasPendientes = useMemo(() => facturas.filter(f => f.estadoVenta === 'Pendiente' && !f.enCartera), [facturas]);
  const totalPendienteCalculado = useMemo(() => facturasPendientes.reduce((acc, f) => acc + Number(f.total || 0), 0), [facturasPendientes]);

  const facturasEnCartera = useMemo(() => facturas.filter(f => f.estadoVenta === 'En Cartera' || f.enCartera), [facturas]);
  const totalEnCarteraCalculado = useMemo(() => facturasEnCartera.reduce((acc, f) => acc + Number(f.saldoPendiente != null ? f.saldoPendiente : (f.total || 0)), 0), [facturasEnCartera]);

  const totalFacturadoCalculado = facturas
    .filter(f => f.estadoVenta === 'Pagada' && !f.enCartera)
    .reduce((acc, f) => acc + Number(f.total || 0), 0);

  const totalFacturas = facturas.length;
  const facturasPagadas = facturas.filter(f => f.estadoVenta === 'Pagada' && !f.enCartera).length;
  const facturasAnuladas = facturas.filter(f => f.estadoVenta === 'Anulada').length;
  const ticketPromedio = facturasPagadas > 0 ? totalFacturadoCalculado / facturasPagadas : 0;

  // Pagination logic
  const paginados = useMemo(() => {
    const start = (page - 1) * rowsPerPage;
    return facturas.slice(start, start + rowsPerPage);
  }, [facturas, page, rowsPerPage]);

  const totalPages = Math.ceil(facturas.length / rowsPerPage) || 1;

  return (
    <div style={{ padding: '4px 0' }}>
      
      {/* HEADER PRINCIPAL */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#1a202c', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FaFileInvoiceDollar color="#2b6cb0" /> Comprobantes de Venta
          </h1>
          <p style={{ margin: '4px 0 0 0', color: '#718096', fontSize: '14px' }}>
            Emisión de comprobantes, control fiscal, modificación de facturas, certificación de ingreso en caja y anulación.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button 
            type="button"
            onClick={fetchFacturas} 
            style={{ 
              display: 'flex', alignItems: 'center', gap: '6px', 
              background: '#ffffff', color: '#2d3748', border: '1px solid #cbd5e0',
              padding: '8px 14px', borderRadius: '8px', fontWeight: 600, fontSize: '13px',
              cursor: 'pointer', boxShadow: '0 1px 2px rgba(0,0,0,0.05)', transition: 'all 0.15s ease'
            }}
            title="Actualizar listado de facturas"
          >
            <MdRefresh size={18} color="#4a5568" /> Actualizar
          </button>
          
          <button 
            type="button"
            onClick={() => setShowNuevaFacturaModal(true)} 
            style={{ 
              display: 'flex', alignItems: 'center', gap: '8px', 
              backgroundColor: '#2b6cb0', color: '#ffffff', border: 'none',
              padding: '8px 16px', borderRadius: '8px', fontWeight: 700, fontSize: '13px',
              cursor: 'pointer', boxShadow: '0 2px 4px rgba(43, 108, 176, 0.3)', transition: 'all 0.15s ease'
            }}
          >
            <FaPlus size={13} color="#ffffff" /> Emitir Nueva Factura
          </button>
        </div>
      </div>

      {/* BANNER DE ALERTA: FACTURAS PENDIENTES DE CERTIFICACIÓN */}
      {facturasPendientes.length > 0 && (
        <div style={{
          background: '#fffaf0',
          border: '1px solid #fbd38d',
          borderLeft: '6px solid #dd6b20',
          borderRadius: '8px',
          padding: '14px 18px',
          marginBottom: '20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          boxShadow: '0 2px 4px rgba(221, 107, 32, 0.08)',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '28px' }}>⏳</span>
            <div>
              <div style={{ fontWeight: 700, color: '#9c4221', fontSize: '15px' }}>
                {facturasPendientes.length} Factura{facturasPendientes.length > 1 ? 's' : ''} Pendiente{facturasPendientes.length > 1 ? 's' : ''} de Certificación de Ingreso ({formatCurrency(totalPendienteCalculado)})
              </div>
              <div style={{ fontSize: '12px', color: '#7b341e', marginTop: '2px' }}>
                Las ventas generadas quedan en espera hasta que se validen los datos y se certifique el ingreso del dinero en caja para facturarse.
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              type="button"
              onClick={() => setFiltroEstado('Pendiente')}
              className="btn"
              style={{ background: '#dd6b20', color: '#ffffff', fontSize: '12px', padding: '7px 14px', fontWeight: 700, border: 'none', borderRadius: '6px' }}
            >
              Ver Pendientes ({facturasPendientes.length})
            </button>
            {filtroEstado === 'Pendiente' && (
              <button
                type="button"
                onClick={() => setFiltroEstado('Todos')}
                className="btn btn-secundario"
                style={{ fontSize: '12px', padding: '7px 12px' }}
              >
                Ver Todas
              </button>
            )}
          </div>
        </div>
      )}

      {/* KPI METRICS BAR */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '14px', marginBottom: '20px' }}>
        
        <div 
          className="card" 
          style={{ 
            padding: '16px', background: '#ffffff', borderRadius: '10px', 
            borderLeft: '4px solid #dd6b20', boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            cursor: 'pointer'
          }}
          onClick={() => setFiltroEstado(filtroEstado === 'Pendiente' ? 'Todos' : 'Pendiente')}
          title="Clic para filtrar facturas pendientes de caja"
        >
          <div style={{ fontSize: '12px', color: '#718096', textTransform: 'uppercase', fontWeight: 600 }}>Por Certificar / Cobrar</div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#dd6b20', marginTop: '4px' }}>
            {facturasPendientes.length} <span style={{ fontSize: '14px', fontWeight: 500, color: '#a0aec0' }}>({formatCurrency(totalPendienteCalculado)})</span>
          </div>
          <div style={{ fontSize: '12px', color: '#744210', marginTop: '2px' }}>Pendientes en caja</div>
        </div>

        <div 
          className="card" 
          style={{ 
            padding: '16px', background: '#ffffff', borderRadius: '10px', 
            borderLeft: '4px solid #8b5cf6', boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            cursor: 'pointer'
          }}
          onClick={() => setFiltroEstado(filtroEstado === 'En Cartera' ? 'Todos' : 'En Cartera')}
          title="Clic para filtrar facturas a crédito en Cartera"
        >
          <div style={{ fontSize: '12px', color: '#718096', textTransform: 'uppercase', fontWeight: 600 }}>En Cartera (Crédito)</div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#6d28d9', marginTop: '4px' }}>
            {facturasEnCartera.length} <span style={{ fontSize: '14px', fontWeight: 500, color: '#a0aec0' }}>({formatCurrency(totalEnCarteraCalculado)})</span>
          </div>
          <div style={{ fontSize: '12px', color: '#6b21a8', marginTop: '2px' }}>Cuentas por cobrar</div>
        </div>

        <div 
          className="card" 
          style={{ 
            padding: '16px', background: '#ffffff', borderRadius: '10px', 
            borderLeft: '4px solid #38a169', boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            cursor: 'pointer'
          }}
          onClick={() => setFiltroEstado(filtroEstado === 'Pagada' ? 'Todos' : 'Pagada')}
          title="Clic para filtrar facturas liquidadas / pagadas"
        >
          <div style={{ fontSize: '12px', color: '#718096', textTransform: 'uppercase', fontWeight: 600 }}>Total Facturado (Pagadas)</div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#276749', marginTop: '4px' }}>{formatCurrency(totalFacturadoCalculado)}</div>
          <div style={{ fontSize: '12px', color: '#4a5568', marginTop: '2px' }}>{facturasPagadas} facturas liquidadas</div>
        </div>

        <div className="card" style={{ padding: '16px', background: '#ffffff', borderRadius: '10px', borderLeft: '4px solid #2b6cb0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: '12px', color: '#718096', textTransform: 'uppercase', fontWeight: 600 }}>Ticket Promedio</div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#2b6cb0', marginTop: '4px' }}>{formatCurrency(ticketPromedio)}</div>
          <div style={{ fontSize: '12px', color: '#4a5568', marginTop: '2px' }}>Por factura pagada</div>
        </div>

        <div className="card" style={{ padding: '16px', background: '#ffffff', borderRadius: '10px', borderLeft: '4px solid #805ad5', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: '12px', color: '#718096', textTransform: 'uppercase', fontWeight: 600 }}>Total Comprobantes</div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#553c9a', marginTop: '4px' }}>{totalFacturas} <span style={{ fontSize: '14px', fontWeight: 400 }}>docs</span></div>
          <div style={{ fontSize: '12px', color: '#4a5568', marginTop: '2px' }}>Registrados en historial</div>
        </div>

        <div className="card" style={{ padding: '16px', background: '#ffffff', borderRadius: '10px', borderLeft: '4px solid #e53e3e', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: '12px', color: '#718096', textTransform: 'uppercase', fontWeight: 600 }}>Facturas Anuladas</div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#c53030', marginTop: '4px' }}>{facturasAnuladas} <span style={{ fontSize: '14px', fontWeight: 400 }}>anuladas</span></div>
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
              <option value="Pagada">✓ Pagada (Contado / Paz y Salvo)</option>
              <option value="En Cartera">📑 En Cartera (Crédito)</option>
              <option value="Pendiente">⏳ Pendiente de Caja</option>
              <option value="Anulada">🚫 Anulada</option>
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
        handleAbrirWhatsApp={handleAbrirWhatsAppFactura}
        handleEdit={handleAbrirEditar} 
        handleAbrirEditar={handleAbrirEditar}
        handleAbrirCertificar={handleAbrirCertificar}
        handleDelete={handleDelete} 
        handleAbrirAnular={handleAbrirAnular} 
        handleIrACartera={(factura) => {
          if (onNavigate) {
            onNavigate('cartera');
          }
        }}
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
                        <option value="Crédito">Crédito Comercial</option>
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

              {/* SECCIÓN PRODUCTOS O SERVICIOS */}
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
                      <b>Servicio: "{productoSeleccionado?.nombre}"</b>. El costo de mantenimiento, diagnóstico o mano de obra varía. <b>Por favor ingrese el valor a cobrar.</b>
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
                      placeholder="Nombre o código OEM del repuesto o servicio..." 
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

                  {/* CAMPO DE VALOR OBLIGATORIO SOLO PARA SERVICIOS */}
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

              {/* TABLA DE PRODUCTOS EN FACTURA */}
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
                          Sin ítems agregados al documento.
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
                              title="Quitar ítem"
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
            
            <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '10px', marginBottom: '16px' }}>
              <span style={{ fontWeight: 700, color: '#2d3748', fontSize: '16px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <FaFileInvoiceDollar color="#2b6cb0" /> Vista Previa de Factura Legal
              </span>
              <button onClick={() => setShowVerFacturaModal(false)} className="btn btn-secundario" style={{ padding: '2px 6px' }}>
                <MdClose size={18} />
              </button>
            </div>

            {loadingDetalle ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#718096' }}>Cargando factura...</div>
            ) : facturaSeleccionada && facturaSeleccionada.factura ? (() => {
              const f = facturaSeleccionada.factura;
              const v = facturaSeleccionada.venta;
              const abonos = f.Abonos || facturaSeleccionada.Abonos || [];
              const totalFactura = Number(f.total || 0);
              const totalAbonado = facturaSeleccionada.totalAbonado != null 
                ? Number(facturaSeleccionada.totalAbonado) 
                : abonos.reduce((acc, ab) => acc + Number(ab.monto || 0), 0);
              const saldoPendiente = facturaSeleccionada.saldoPendiente != null 
                ? Number(facturaSeleccionada.saldoPendiente) 
                : Math.max(0, totalFactura - totalAbonado);

              const metodoPago = facturaSeleccionada.metodoPago || (v && v.metodoPago) || f.metodoPago || 'Efectivo';
              const esCredito = Boolean(
                facturaSeleccionada.esCredito || 
                (metodoPago && (
                  metodoPago.toLowerCase().includes('credito') || 
                  metodoPago.toLowerCase().includes('crédito')
                ))
              );
              const tieneAbonos = abonos.length > 0 || totalAbonado > 0;

              const isFacturaAnulada = Boolean(
                f.fechaAnulacion ||
                f.motivoAnulacion ||
                (v && v.estado === 'Anulada') ||
                (f.notas && f.notas.includes('[ANULADA]'))
              );

              // Factura en Cartera (a Crédito con saldo pendiente por cobrar)
              const enCartera = Boolean(
                !isFacturaAnulada && (
                  facturaSeleccionada.enCartera ||
                  (v && v.estado === 'En Cartera') ||
                  ((esCredito || tieneAbonos) && saldoPendiente > 0.01)
                )
              );

              const isFacturaPendiente = !isFacturaAnulada && !enCartera && (v 
                ? v.estado === 'Pendiente' 
                : (f.notas && !f.notas.includes('[PAGO CERTIFICADO]')));

              const isPagada = !isFacturaAnulada && !enCartera && !isFacturaPendiente;

              return (
              <div id="printable-factura">
                
                {/* ALERTA DE FACTURA ANULADA */}
                {isFacturaAnulada && (
                  <div className="no-print" style={{
                    background: '#fff5f5',
                    border: '1px solid #feb2b2',
                    borderLeft: '5px solid #e53e3e',
                    padding: '12px 16px',
                    borderRadius: '6px',
                    marginBottom: '16px',
                    color: '#9b2c2c'
                  }}>
                    <div style={{ fontWeight: 800, fontSize: '14px', marginBottom: '4px' }}>
                      🚫 COMPROBANTE / FACTURA ANULADA
                    </div>
                    {f.anuladaPor && (
                      <div style={{ fontSize: '13px' }}><b>Anulada por:</b> {f.anuladaPor}</div>
                    )}
                    {f.fechaAnulacion && (
                      <div style={{ fontSize: '13px' }}><b>Fecha de anulación:</b> {new Date(f.fechaAnulacion).toLocaleString('es-CO', { timeZone: 'America/Bogota' })}</div>
                    )}
                    {f.motivoAnulacion && (
                      <div style={{ fontSize: '13px' }}><b>Motivo:</b> {f.motivoAnulacion}</div>
                    )}
                  </div>
                )}

                {/* ALERTA DE FACTURA EN CARTERA */}
                {enCartera && (
                  <div className="no-print" style={{
                    background: '#f5f3ff',
                    border: '1px solid #ddd6fe',
                    borderLeft: '5px solid #8b5cf6',
                    padding: '12px 16px',
                    borderRadius: '6px',
                    marginBottom: '16px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '12px',
                    flexWrap: 'wrap'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '20px' }}>📑</span>
                      <div>
                        <div style={{ fontSize: '13px', color: '#5b21b6', fontWeight: 700 }}>
                          Factura a Crédito — En Cartera de Cobro
                        </div>
                        <div style={{ fontSize: '12px', color: '#6d28d9', marginTop: '2px' }}>
                          Total: <b>{formatCurrency(totalFactura)}</b> | Total Abonado: <b>{formatCurrency(totalAbonado)}</b> | Saldo Pendiente: <b style={{ color: '#b91c1c' }}>{formatCurrency(saldoPendiente)}</b>
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setShowVerFacturaModal(false);
                        window.location.hash = '#cartera';
                      }}
                      className="btn"
                      style={{ background: '#7c3aed', color: '#fff', fontSize: '12px', padding: '6px 12px', fontWeight: 700, border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                    >
                      Gestionar en Cartera
                    </button>
                  </div>
                )}
                
                {/* ALERTA DE FACTURA PENDIENTE DE CERTIFICACIÓN */}
                {isFacturaPendiente && (
                  <div className="no-print" style={{
                    background: '#fffaf0',
                    border: '1px solid #fbd38d',
                    borderLeft: '5px solid #dd6b20',
                    padding: '12px 16px',
                    borderRadius: '6px',
                    marginBottom: '16px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '12px',
                    flexWrap: 'wrap'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '20px' }}>⏳</span>
                      <div>
                        <div style={{ fontSize: '13px', color: '#9c4221', fontWeight: 700 }}>
                          Factura en estado PENDIENTE de certificación de pago
                        </div>
                        <div style={{ fontSize: '11px', color: '#7b341e' }}>
                          El dinero no ha sido ingresado formalmente en caja. Valide los datos o certifique el pago para emitir la factura final.
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setShowVerFacturaModal(false);
                        handleAbrirCertificar({
                          ...f,
                          ventaId: v?.id,
                          estadoVenta: 'Pendiente',
                          metodoPago: v?.metodoPago || f.metodoPago || 'Efectivo',
                          almacenNombre: f.almacen?.nombre || 'Sede Principal'
                        });
                      }}
                      className="btn"
                      style={{ background: '#2f855a', color: '#fff', fontSize: '12px', padding: '6px 12px', fontWeight: 700, border: 'none', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                      <MdCheckCircle size={15} /> Certificar Pago Ahora
                    </button>
                  </div>
                )}

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
                      FACTURA N° FAC-{f.id}
                    </div>
                    <div style={{ fontSize: '12px', color: '#4a5568' }}>
                      Fecha: {new Date(f.fecha).toLocaleDateString('es-CO', { timeZone: 'America/Bogota' })}
                    </div>
                    <div style={{ fontSize: '12px', color: '#4a5568' }}>
                      Bodega: {f.almacen?.nombre || 'Sede Principal'}
                    </div>
                    <div style={{ fontSize: '12px', color: '#4a5568' }}>
                      Método: <b>{metodoPago}</b>
                    </div>
                    <div style={{ marginTop: '4px' }}>
                      <span style={{ 
                        fontSize: '11px', 
                        fontWeight: 700, 
                        padding: '3px 10px', 
                        borderRadius: '10px',
                        display: 'inline-block',
                        background: isFacturaAnulada 
                          ? '#fed7d7' 
                          : enCartera 
                            ? '#ede9fe' 
                            : (isFacturaPendiente ? '#feebc8' : '#c6f6d5'),
                        color: isFacturaAnulada 
                          ? '#9b2c2c' 
                          : enCartera 
                            ? '#6b21a8' 
                            : (isFacturaPendiente ? '#744210' : '#22543d'),
                        border: isFacturaAnulada
                          ? '1px solid #feb2b2'
                          : enCartera
                            ? '1px solid #c084fc'
                            : (isFacturaPendiente ? '1px solid #fbd38d' : '1px solid #9ae6b4')
                      }}>
                        {isFacturaAnulada 
                          ? '✕ Estado: Anulada' 
                          : enCartera 
                            ? '📑 Estado: En Cartera (Crédito)' 
                            : (isFacturaPendiente ? '⏳ Estado: Pendiente de Pago' : '✓ Estado: Pagada')}
                      </span>
                    </div>
                  </div>
                </div>

                {/* ADQUIRENTE */}
                <div style={{ background: '#f7fafc', padding: '12px', borderRadius: '6px', marginBottom: '16px', fontSize: '13px' }}>
                  <div style={{ fontWeight: 700, color: '#2d3748', marginBottom: '4px' }}>DATOS DEL ADQUIRENTE</div>
                  <div><b>Cliente:</b> {f.cliente}</div>
                  <div><b>Documento/NIT:</b> {f.documento || 'Venta Mostrador'}</div>
                  <div><b>Dirección:</b> {f.direccion || 'N/A'} | <b>Tel:</b> {f.telefono || 'N/A'}</div>
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
                    {(f.DetalleFacturas || []).map((d, i) => (
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
                    {f.notas || 'Sin observaciones.'}
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '16px', fontWeight: 800, color: '#2b6cb0' }}>
                      TOTAL FACTURA: {formatCurrency(totalFactura)}
                    </div>
                    {enCartera && (
                      <div style={{ marginTop: '4px' }}>
                        <div style={{ fontSize: '13px', color: '#4a5568' }}>
                          Total Abonado: <span style={{ fontWeight: 600, color: '#2b6cb0' }}>{formatCurrency(totalAbonado)}</span>
                        </div>
                        <div style={{ 
                          fontSize: '15px', 
                          fontWeight: 800, 
                          color: '#b91c1c', 
                          marginTop: '4px', 
                          background: '#fee2e2', 
                          padding: '3px 10px', 
                          borderRadius: '4px', 
                          display: 'inline-block',
                          border: '1px solid #fca5a5'
                        }}>
                          SALDO EN CARTERA: {formatCurrency(saldoPendiente)}
                        </div>
                      </div>
                    )}
                    {isPagada && (
                      <div style={{ fontSize: '12px', color: '#22543d', fontWeight: 700, marginTop: '4px' }}>
                        ✓ Factura Pagada en su totalidad (Paz y Salvo)
                      </div>
                    )}
                  </div>
                </div>

                {(facturaSeleccionada.empresa?.pie_pagina_factura || empresa?.pie_pagina_factura) && (
                  <div style={{ textAlign: 'center', marginBottom: '16px', paddingTop: '8px', borderTop: '1px dashed #cbd5e0', fontSize: '11px', color: '#718096', fontStyle: 'italic' }}>
                    {facturaSeleccionada.empresa?.pie_pagina_factura || empresa?.pie_pagina_factura}
                  </div>
                )}

                {/* BOTONES ACCION */}
                <div className="no-print" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', flexWrap: 'wrap' }}>
                  {isFacturaPendiente && (
                    <button 
                      type="button" 
                      onClick={() => {
                        setShowVerFacturaModal(false);
                        handleAbrirEditar(facturaSeleccionada.factura);
                      }} 
                      className="btn btn-secundario" 
                      style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                      title="Modificar datos, cliente o notas de esta factura"
                    >
                      <MdEdit size={16} /> Modificar Factura
                    </button>
                  )}

                  {isFacturaPendiente && (
                    <button 
                      type="button" 
                      onClick={() => {
                        setShowVerFacturaModal(false);
                        handleAbrirCertificar({
                          ...facturaSeleccionada.factura,
                          ventaId: facturaSeleccionada.venta?.id,
                          estadoVenta: 'Pendiente',
                          metodoPago: facturaSeleccionada.venta?.metodoPago || facturaSeleccionada.factura.metodoPago || 'Efectivo',
                          almacenNombre: facturaSeleccionada.factura.almacen?.nombre || 'Sede Principal'
                        });
                      }} 
                      className="btn btn-principal" 
                      style={{ backgroundColor: '#2f855a', display: 'flex', alignItems: 'center', gap: '6px' }}
                      title="Validar el ingreso del dinero en caja y facturar"
                    >
                      <MdCheckCircle size={18} /> Validar y Facturar
                    </button>
                  )}

                  <button 
                    type="button"
                    onClick={() => handleAbrirWhatsAppFactura(facturaSeleccionada.factura, facturaSeleccionada.empresa || empresa)}
                    className="btn"
                    style={{ 
                      backgroundColor: '#25D366', 
                      color: '#ffffff', 
                      fontWeight: 600, 
                      display: 'inline-flex', 
                      alignItems: 'center', 
                      gap: '6px',
                      border: 'none',
                      boxShadow: '0 2px 4px rgba(37, 211, 102, 0.3)'
                    }}
                    title="Enviar factura legal por WhatsApp al cliente"
                  >
                    <FaWhatsapp size={18} /> Enviar por WhatsApp
                  </button>

                  <button onClick={() => window.print()} className="btn btn-secundario" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <MdPrint /> Imprimir
                  </button>
                  <button onClick={handleDescargarPDF} className="btn btn-principal" style={{ backgroundColor: '#c53030', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <FaFilePdf /> Descargar PDF
                  </button>
                </div>

              </div>
              );
            })() : null}

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



      {/* MODAL MODIFICAR FACTURA */}
      {showEditModal && facturaEditando && (
        <div className="modal-backdrop">
          <div className="modal-card card" style={{ maxWidth: '650px', width: '92%', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, color: '#2b6cb0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <MdEdit /> Modificar Factura FAC-{facturaEditando.id}
              </h3>
              <button onClick={() => setShowEditModal(false)} className="btn btn-secundario" style={{ padding: '4px 8px' }}>
                <MdClose size={18} />
              </button>
            </div>

            <form onSubmit={handleGuardarEdicion}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '14px', marginBottom: '14px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: '#2d3748', display: 'block', marginBottom: '4px' }}>Nombre del Cliente *</label>
                  <input 
                    type="text" 
                    required 
                    value={facturaEditando.cliente} 
                    onChange={e => setFacturaEditando({ ...facturaEditando, cliente: e.target.value })} 
                    className="input" 
                    style={{ width: '100%', fontSize: '13px' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: '#2d3748', display: 'block', marginBottom: '4px' }}>Tipo Documento</label>
                  <select 
                    value={facturaEditando.tipo_documento || 'CC'} 
                    onChange={e => setFacturaEditando({ ...facturaEditando, tipo_documento: e.target.value })} 
                    className="input" 
                    style={{ width: '100%', fontSize: '13px' }}
                  >
                    <option value="CC">Cédula de Ciudadanía (CC)</option>
                    <option value="NIT">NIT</option>
                    <option value="CE">Cédula de Extranjería (CE)</option>
                    <option value="Pasaporte">Pasaporte</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: '#2d3748', display: 'block', marginBottom: '4px' }}>Número de Documento</label>
                  <input 
                    type="text" 
                    value={facturaEditando.documento || ''} 
                    onChange={e => setFacturaEditando({ ...facturaEditando, documento: e.target.value })} 
                    className="input" 
                    style={{ width: '100%', fontSize: '13px' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: '#2d3748', display: 'block', marginBottom: '4px' }}>Teléfono</label>
                  <input 
                    type="text" 
                    value={facturaEditando.telefono || ''} 
                    onChange={e => setFacturaEditando({ ...facturaEditando, telefono: e.target.value })} 
                    className="input" 
                    style={{ width: '100%', fontSize: '13px' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: '#2d3748', display: 'block', marginBottom: '4px' }}>Dirección</label>
                  <input 
                    type="text" 
                    value={facturaEditando.direccion || ''} 
                    onChange={e => setFacturaEditando({ ...facturaEditando, direccion: e.target.value })} 
                    className="input" 
                    style={{ width: '100%', fontSize: '13px' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: '#2d3748', display: 'block', marginBottom: '4px' }}>Correo Electrónico</label>
                  <input 
                    type="email" 
                    value={facturaEditando.correo || ''} 
                    onChange={e => setFacturaEditando({ ...facturaEditando, correo: e.target.value })} 
                    className="input" 
                    style={{ width: '100%', fontSize: '13px' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: '#2d3748', display: 'block', marginBottom: '4px' }}>Método de Pago</label>
                  <select 
                    value={facturaEditando.metodoPago || 'Efectivo'} 
                    onChange={e => setFacturaEditando({ ...facturaEditando, metodoPago: e.target.value })} 
                    className="input" 
                    style={{ width: '100%', fontSize: '13px' }}
                  >
                    <option value="Efectivo">Efectivo</option>
                    <option value="Transferencia">Transferencia (Nequi/Daviplata/Bancolombia)</option>
                    <option value="Tarjeta">Tarjeta Débito/Crédito</option>
                    <option value="Credito">Crédito</option>
                    <option value="Mixto">Mixto</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: '#2d3748', display: 'block', marginBottom: '4px' }}>Fecha de Emisión</label>
                  <input 
                    type="date" 
                    value={facturaEditando.fecha || ''} 
                    onChange={e => setFacturaEditando({ ...facturaEditando, fecha: e.target.value })} 
                    className="input" 
                    style={{ width: '100%', fontSize: '13px' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: '#2d3748', display: 'block', marginBottom: '4px' }}>Total Facturado ($)</label>
                  <input 
                    type="number" 
                    step="0.01" 
                    value={facturaEditando.total || 0} 
                    onChange={e => setFacturaEditando({ ...facturaEditando, total: Number(e.target.value) })} 
                    className="input" 
                    style={{ width: '100%', fontSize: '13px', fontWeight: 'bold' }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#2d3748', display: 'block', marginBottom: '4px' }}>Notas / Observaciones de la Factura</label>
                <textarea 
                  rows={2} 
                  value={facturaEditando.notas || ''} 
                  onChange={e => setFacturaEditando({ ...facturaEditando, notas: e.target.value })} 
                  className="input" 
                  style={{ width: '100%', fontSize: '13px' }}
                  placeholder="Información adicional, garantía, orden de compra..."
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" onClick={() => setShowEditModal(false)} className="btn btn-secundario">
                  Cancelar
                </button>
                <button type="submit" disabled={guardandoEdicion} className="btn btn-principal">
                  {guardandoEdicion ? 'Guardando...' : 'Guardar Modificación'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL CERTIFICAR INGRESO DEL DINERO Y FACTURAR */}
      {showCertificarModal && facturaACertificar && (
        <div className="modal-backdrop">
          <div className="modal-card card" style={{ maxWidth: '520px', width: '92%', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #c6f6d5', paddingBottom: '12px', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, color: '#22543d', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <MdCheckCircle color="#2f855a" size={22} /> Certificar Ingreso y Facturar
              </h3>
              <button onClick={() => setShowCertificarModal(false)} className="btn btn-secundario" style={{ padding: '4px 8px' }}>
                <MdClose size={18} />
              </button>
            </div>

            {/* Tarjeta de Resumen de Factura */}
            <div style={{ background: '#f7fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '14px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                <div>
                  <div style={{ fontSize: '11px', color: '#718096', textTransform: 'uppercase', fontWeight: 600 }}>Documento a Facturar</div>
                  <div style={{ fontSize: '16px', fontWeight: 700, color: '#2b6cb0' }}>FAC-{facturaACertificar.id} {facturaACertificar.ventaId ? `(Venta #${facturaACertificar.ventaId})` : ''}</div>
                </div>
                <span style={{ background: '#feebc8', color: '#744210', fontSize: '11px', fontWeight: 600, padding: '3px 8px', borderRadius: '12px' }}>
                  ⏳ Estado: Pendiente
                </span>
              </div>

              <div style={{ fontSize: '13px', color: '#4a5568', marginBottom: '4px' }}>
                <b>Cliente:</b> {facturaACertificar.cliente || 'Cliente General'} {facturaACertificar.documento ? `(${facturaACertificar.documento})` : ''}
              </div>
              <div style={{ fontSize: '13px', color: '#4a5568', marginBottom: '10px' }}>
                <b>Bodega:</b> {facturaACertificar.almacenNombre || 'Sede Principal'}
              </div>

              <div style={{ borderTop: '1px dashed #cbd5e0', paddingTop: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#2d3748' }}>Total a Ingresar en Caja:</span>
                <span style={{ fontSize: '20px', fontWeight: 800, color: '#276749' }}>{formatCurrency(facturaACertificar.total || 0)}</span>
              </div>
            </div>

            <form onSubmit={handleConfirmarCertificacion}>
              {/* Selector de Método de Pago */}
              <div style={{ marginBottom: '14px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#2d3748', display: 'block', marginBottom: '4px' }}>
                  Método de Pago con el que Ingresó el Dinero *
                </label>
                <select 
                  value={metodoPagoCertificar} 
                  onChange={e => setMetodoPagoCertificar(e.target.value)} 
                  className="input" 
                  style={{ width: '100%', fontSize: '13px', fontWeight: 500 }}
                  required
                >
                  <option value="Efectivo">💵 Efectivo</option>
                  <option value="Transferencia">📱 Transferencia (Nequi / Daviplata / Bancolombia / PSE)</option>
                  <option value="Tarjeta">💳 Tarjeta Débito / Crédito</option>
                  <option value="Credito">📝 Crédito de Cliente</option>
                  <option value="Mixto">🔄 Pago Mixto</option>
                </select>
              </div>

              {/* Si es efectivo: Monto entregado y cálculo de cambio */}
              {metodoPagoCertificar.toLowerCase().includes('efectivo') && (
                <div style={{ background: '#f0fff4', border: '1px solid #c6f6d5', borderRadius: '8px', padding: '12px', marginBottom: '14px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', alignItems: 'center' }}>
                    <div>
                      <label style={{ fontSize: '11px', fontWeight: 600, color: '#22543d', display: 'block', marginBottom: '2px' }}>
                        Monto Entregado por Cliente ($)
                      </label>
                      <input 
                        type="number" 
                        step="any" 
                        value={montoRecibidoCertificar} 
                        onChange={e => setMontoRecibidoCertificar(e.target.value)} 
                        placeholder={String(facturaACertificar.total || 0)}
                        className="input" 
                        style={{ width: '100%', fontSize: '13px' }}
                      />
                    </div>
                    <div>
                      <div style={{ fontSize: '11px', fontWeight: 600, color: '#22543d', marginBottom: '2px' }}>Cambio / Vuelto</div>
                      <div style={{ fontSize: '16px', fontWeight: 700, color: (Number(montoRecibidoCertificar || 0) - Number(facturaACertificar.total || 0)) >= 0 ? '#276749' : '#c53030' }}>
                        {formatCurrency(Math.max(0, Number(montoRecibidoCertificar || 0) - Number(facturaACertificar.total || 0)))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Si es transferencia: Comprobante o referencia */}
              {metodoPagoCertificar.toLowerCase().includes('transferencia') && (
                <div style={{ marginBottom: '14px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: '#2d3748', display: 'block', marginBottom: '4px' }}>
                    Número de Comprobante / Referencia Bancaria
                  </label>
                  <input 
                    type="text" 
                    value={referenciaCertificar} 
                    onChange={e => setReferenciaCertificar(e.target.value)} 
                    placeholder="Ej: M12345678 / Aprobación 9876" 
                    className="input" 
                    style={{ width: '100%', fontSize: '13px' }}
                  />
                </div>
              )}

              {/* Si es Pago Mixto: Desglose en dos o más métodos simultáneos */}
              {metodoPagoCertificar === 'Mixto' && (
                <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '14px', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>🔄</span> Desglose de Pago Combinado
                    </div>
                    <span style={{ fontSize: '11px', color: '#64748b' }}>
                      Total Factura: <b>{formatCurrency(facturaACertificar.total || 0)}</b>
                    </span>
                  </div>

                  <p style={{ fontSize: '11px', color: '#64748b', marginTop: 0, marginBottom: '10px' }}>
                    Indica los montos que ingresaron por cada medio (ej: parte en efectivo y parte por Nequi/Transferencia):
                  </p>

                  {desglosePago.map((item, index) => (
                    <div key={index} style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '10px', marginBottom: '10px', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.1fr 1fr auto', gap: '8px', alignItems: 'center' }}>
                        {/* Selector Método */}
                        <div>
                          <label style={{ fontSize: '10px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '2px' }}>
                            Método #{index + 1}
                          </label>
                          <select
                            value={item.metodo}
                            onChange={e => {
                              const nuevo = [...desglosePago];
                              nuevo[index].metodo = e.target.value;
                              setDesglosePago(nuevo);
                            }}
                            className="input"
                            style={{ width: '100%', fontSize: '12px', padding: '5px' }}
                          >
                            <option value="Efectivo">💵 Efectivo</option>
                            <option value="Transferencia">📱 Transferencia / Nequi / Daviplata</option>
                            <option value="Tarjeta">💳 Tarjeta Débito / Crédito</option>
                            <option value="Credito">📝 Crédito de Cliente</option>
                          </select>
                        </div>

                        {/* Monto */}
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                            <label style={{ fontSize: '10px', fontWeight: 600, color: '#475569' }}>
                              Monto ($) *
                            </label>
                            <button
                              type="button"
                              onClick={() => {
                                const sumaOtros = desglosePago.reduce((acc, curr, i) => i === index ? acc : acc + (parseFloat(curr.monto) || 0), 0);
                                const faltante = Math.max(0, (facturaACertificar.total || 0) - sumaOtros);
                                const nuevo = [...desglosePago];
                                nuevo[index].monto = faltante;
                                setDesglosePago(nuevo);
                              }}
                              style={{ background: 'none', border: 'none', color: '#2563eb', fontSize: '10px', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}
                              title="Autocompletar el saldo restante para este método"
                            >
                              Autocompletar
                            </button>
                          </div>
                          <input
                            type="number"
                            step="any"
                            min="0"
                            value={item.monto}
                            onChange={e => {
                              const nuevo = [...desglosePago];
                              nuevo[index].monto = e.target.value;
                              setDesglosePago(nuevo);
                            }}
                            placeholder="0"
                            className="input"
                            style={{ width: '100%', fontSize: '12px', padding: '5px', fontWeight: 700, color: '#166534' }}
                            required
                          />
                        </div>

                        {/* Referencia */}
                        <div>
                          <label style={{ fontSize: '10px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '2px' }}>
                            Referencia / N°
                          </label>
                          <input
                            type="text"
                            value={item.referencia}
                            onChange={e => {
                              const nuevo = [...desglosePago];
                              nuevo[index].referencia = e.target.value;
                              setDesglosePago(nuevo);
                            }}
                            placeholder={item.metodo.includes('Trans') ? 'N° Transacción' : 'Opcional'}
                            className="input"
                            style={{ width: '100%', fontSize: '12px', padding: '5px' }}
                          />
                        </div>

                        {/* Botón Eliminar fila */}
                        <div style={{ paddingTop: '16px' }}>
                          {desglosePago.length > 2 && (
                            <button
                              type="button"
                              onClick={() => {
                                const nuevo = desglosePago.filter((_, i) => i !== index);
                                setDesglosePago(nuevo);
                              }}
                              style={{ background: '#fef2f2', color: '#ef4444', border: '1px solid #fecaca', borderRadius: '4px', padding: '4px 8px', cursor: 'pointer', fontSize: '12px' }}
                              title="Eliminar este método de pago"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* Acciones y Resumen de Cuadre */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px', flexWrap: 'wrap', gap: '8px' }}>
                    <button
                      type="button"
                      onClick={() => {
                        const sumaActual = desglosePago.reduce((acc, curr) => acc + (parseFloat(curr.monto) || 0), 0);
                        const restante = Math.max(0, (facturaACertificar.total || 0) - sumaActual);
                        setDesglosePago([...desglosePago, { metodo: 'Transferencia', monto: restante > 0 ? restante : '', referencia: '' }]);
                      }}
                      className="btn btn-secundario"
                      style={{ fontSize: '11px', padding: '4px 10px' }}
                    >
                      + Agregar otro método
                    </button>

                    {/* Resumen de Total Desglosado y Diferencia */}
                    {(() => {
                      const suma = desglosePago.reduce((acc, curr) => acc + (parseFloat(curr.monto) || 0), 0);
                      const total = Number(facturaACertificar.total || 0);
                      const diff = total - suma;

                      if (Math.abs(diff) < 0.01) {
                        return (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#dcfce7', color: '#15803d', padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 700 }}>
                            <span>✓ Cuadre exacto:</span> {formatCurrency(suma)}
                          </div>
                        );
                      } else if (diff > 0) {
                        return (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ background: '#fee2e2', color: '#b91c1c', padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 700 }}>
                              Faltan {formatCurrency(diff)} (Suma: {formatCurrency(suma)})
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                const nuevo = [...desglosePago];
                                const lastIdx = nuevo.length - 1;
                                nuevo[lastIdx].monto = (parseFloat(nuevo[lastIdx].monto) || 0) + diff;
                                setDesglosePago(nuevo);
                              }}
                              style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: '4px', padding: '4px 8px', fontSize: '11px', cursor: 'pointer', fontWeight: 600 }}
                            >
                              Ajustar faltante
                            </button>
                          </div>
                        );
                      } else {
                        return (
                          <div style={{ background: '#e0f2fe', color: '#0369a1', padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 700 }}>
                            Suma: {formatCurrency(suma)} • Vuelto al cliente: {formatCurrency(Math.abs(diff))}
                          </div>
                        );
                      }
                    })()}
                  </div>
                </div>
              )}

              {/* Observaciones de Caja */}
              <div style={{ marginBottom: '14px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#2d3748', display: 'block', marginBottom: '4px' }}>
                  Observaciones de Caja / Validación (Opcional)
                </label>
                <textarea 
                  rows={2} 
                  value={observacionesCertificar} 
                  onChange={e => setObservacionesCertificar(e.target.value)} 
                  placeholder="Detalles de la transacción o autorización..." 
                  className="input" 
                  style={{ width: '100%', fontSize: '12px' }}
                />
              </div>

              {/* Checkbox de Certificación Obligatorio */}
              <div style={{ background: '#ebf8ff', border: '1px solid #bee3f8', borderRadius: '8px', padding: '12px', marginBottom: '16px' }}>
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', cursor: 'pointer', fontSize: '12px', color: '#2b6cb0', fontWeight: 600, margin: 0 }}>
                  <input 
                    type="checkbox" 
                    checked={certificacionConfirmada} 
                    onChange={e => setCertificacionConfirmada(e.target.checked)} 
                    style={{ marginTop: '2px', cursor: 'pointer', transform: 'scale(1.2)' }}
                    required
                  />
                  <span>
                    Certifico bajo mi responsabilidad que he validado y recibido el ingreso completo de {formatCurrency(facturaACertificar.total || 0)} en la caja/cuenta.
                  </span>
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" onClick={() => setShowCertificarModal(false)} className="btn btn-secundario">
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  disabled={certificando || !certificacionConfirmada} 
                  className="btn btn-principal" 
                  style={{ backgroundColor: '#2f855a' }}
                >
                  {certificando ? 'Certificando...' : 'Certificar Ingreso y Facturar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL WHATSAPP DIRECTO */}
      <WhatsAppModal 
        isOpen={showWhatsAppModal} 
        onClose={() => setShowWhatsAppModal(false)} 
        data={whatsAppData} 
      />

    </div>
  );
}

export default Facturacion;
