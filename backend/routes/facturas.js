const express = require('express');
const { body, validationResult } = require('express-validator');
const auth = require('../middleware/auth');
const requirePermiso = require('../middleware/roles');
const { almacenDelUsuario, sanitizarCostos } = require('../utils/almacenScope');
const router = express.Router();
const { Op } = require('sequelize');
const sequelize = require('../database/sequelize');

const Factura = require('../models/Factura');
const DetalleFactura = require('../models/DetalleFactura');
const Venta = require('../models/Venta');
const DetalleVenta = require('../models/DetalleVenta');
const Producto = require('../models/Producto');
const Cliente = require('../models/Cliente');
const Almacen = require('../models/Almacen');
const ProductoAlmacen = require('../models/ProductoAlmacen');
const Empresa = require('../models/Empresa');
const Abono = require('../models/Abono');
const Caja = require('../models/Caja');

// Helper para calcular fecha correcta en zona horaria Colombia (America/Bogota, UTC-5)
function calcularFechaVentaColombia(fechaInput) {
  const hoyColParts = new Intl.DateTimeFormat('es-CO', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date());
  const y = hoyColParts.find(p => p.type === 'year')?.value;
  const m = hoyColParts.find(p => p.type === 'month')?.value;
  const d = hoyColParts.find(p => p.type === 'day')?.value;
  const hoyStr = `${y}-${m}-${d}`;

  if (!fechaInput) {
    return new Date();
  }

  const fechaStr = String(fechaInput).slice(0, 10);
  if (fechaStr === hoyStr) {
    return new Date();
  }

  return new Date(`${fechaStr}T12:00:00-05:00`);
}

// 1. OBTENER TODAS LAS FACTURAS (CON FILTROS Y BÚSQUEDA)
router.get('/', auth, requirePermiso(['facturas.crear', 'cartera.ver', 'dashboard.ver']), async (req, res) => {
  try {
    const usuario = req.user || {};
    const isAdmin = usuario.rol === 'admin';
    const whereFactura = {};

    const scopedAlmacenId = almacenDelUsuario(req, res);
    if (scopedAlmacenId === undefined && !isAdmin) return;

    if (scopedAlmacenId) {
      whereFactura.almacenId = scopedAlmacenId;
    }

    const { estado, fechaInicio, fechaFin, q, clienteId } = req.query;

    // Filtros por Fecha
    if (fechaInicio && fechaFin) {
      whereFactura.fecha = {
        [Op.between]: [`${fechaInicio} 00:00:00`, `${fechaFin} 23:59:59`]
      };
    } else if (fechaInicio) {
      whereFactura.fecha = { [Op.gte]: `${fechaInicio} 00:00:00` };
    } else if (fechaFin) {
      whereFactura.fecha = { [Op.lte]: `${fechaFin} 23:59:59` };
    }

    // Búsqueda general
    if (q && q.trim()) {
      const term = q.trim();
      const isNum = !isNaN(Number(term));
      whereFactura[Op.or] = [
        ...(isNum ? [{ id: Number(term) }] : []),
        { cliente: { [Op.like]: `%${term}%` } },
        { documento: { [Op.like]: `%${term}%` } },
        { notas: { [Op.like]: `%${term}%` } }
      ];
    }

    // Traer facturas con detalles, abonos y relaciones
    const facturas = await Factura.findAll({
      where: whereFactura,
      order: [['id', 'DESC']],
      include: [
        {
          model: DetalleFactura,
          as: 'DetalleFacturas',
          include: [
            {
              model: Producto,
              as: 'Producto',
              attributes: ['id', 'nombre', 'codigo_oem', 'marca', 'categoria', 'precio']
            }
          ]
        },
        {
          model: Almacen,
          as: 'almacen',
          attributes: ['id', 'nombre', 'codigo', 'ciudad']
        },
        {
          model: Abono,
          as: 'Abonos',
          attributes: ['id', 'monto', 'fecha', 'recibo_caja_no', 'token_publico']
        }
      ]
    });

    // Mapear ventas asociadas a cada factura
    const ventas = await Venta.findAll({
      include: [
        { model: Almacen, as: 'almacen', attributes: ['id', 'nombre'] }
      ]
    });

    const ventasPorFacturaId = {};
    ventas.forEach(v => {
      if (v.facturaId) ventasPorFacturaId[v.facturaId] = v;
    });

    const facturasProcesadas = facturas.map(f => {
      const json = f.toJSON();
      const venta = ventasPorFacturaId[f.id];

      const productos = (json.DetalleFacturas || []).map(df => ({
        id: df.Producto ? df.Producto.id : df.productoId,
        nombre: df.Producto ? df.Producto.nombre : 'Producto',
        codigo_oem: df.Producto ? df.Producto.codigo_oem : '',
        cantidad: df.cantidad,
        precio_unitario: Number(df.precio_unitario) || 0,
        subtotal: (Number(df.precio_unitario) || 0) * (Number(df.cantidad) || 0)
      }));

      const abonos = json.Abonos || [];
      const totalFactura = Number(f.total || 0);
      const totalAbonado = abonos.reduce((acc, ab) => acc + Number(ab.monto || 0), 0);
      const saldoPendiente = Math.max(0, totalFactura - totalAbonado);

      const metodoPago = venta ? venta.metodoPago : (f.metodoPago || 'Efectivo');
      const esCredito = Boolean(
        metodoPago && (
          metodoPago.toLowerCase().includes('credito') || 
          metodoPago.toLowerCase().includes('crédito')
        )
      );
      const tieneAbonos = abonos.length > 0;
      const isAnulada = (venta && venta.estado === 'Anulada') || (f.notas && f.notas.toLowerCase().includes('anulada'));

      let estadoVenta;
      let enCartera = false;

      if (isAnulada) {
        estadoVenta = 'Anulada';
      } else if (esCredito || tieneAbonos || (venta && venta.estado === 'En Cartera')) {
        // Factura a crédito
        if (saldoPendiente <= 0.01) {
          // Ya no tiene deuda: Paz y Salvo -> Pagada
          estadoVenta = 'Pagada';
          enCartera = false;
        } else {
          // Tiene saldo por cobrar -> En Cartera
          estadoVenta = 'En Cartera';
          enCartera = true;
        }
      } else {
        // Venta de contado (Efectivo, Tarjeta, Transferencia, Mixto)
        estadoVenta = venta ? venta.estado : 'Pagada';
      }

      const vendedor = venta ? venta.vendedor : 'Sistema';
      const almacenNombre = (f.almacen && f.almacen.nombre) || (venta && venta.almacen && venta.almacen.nombre) || 'Sede Principal';

      return {
        ...json,
        ventaId: venta ? venta.id : null,
        estadoVenta,
        metodoPago,
        vendedor,
        almacenNombre,
        productos,
        enCartera,
        totalAbonado,
        saldoPendiente
      };
    });

    // Aplicar filtro de estado si se solicita
    let resultadoFinal = facturasProcesadas;
    if (estado && estado !== 'Todos') {
      if (estado === 'En Cartera') {
        resultadoFinal = facturasProcesadas.filter(f => f.estadoVenta === 'En Cartera' || f.enCartera);
      } else {
        resultadoFinal = facturasProcesadas.filter(f => f.estadoVenta === estado);
      }
    }

    res.json(sanitizarCostos(resultadoFinal, req.user));
  } catch (error) {
    console.error('[facturas] GET / error:', error);
    res.status(500).json({ error: 'Error al obtener facturas', detalle: error.message });
  }
});

// VISTA / COMPROBANTE PÚBLICO PARA CLIENTES DESDE WHATSAPP (SIN LOGIN)
router.get('/public/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const factura = await Factura.findOne({
      where: { token_publico: token },
      include: [
        {
          model: DetalleFactura,
          as: 'DetalleFacturas',
          include: [{ model: Producto, as: 'Producto' }]
        },
        { model: Almacen, as: 'almacen' },
        { model: Abono, as: 'Abonos', order: [['fecha', 'DESC']] }
      ]
    });

    if (!factura) {
      return res.status(404).send('<h2 style="font-family:sans-serif;text-align:center;padding:50px;">Factura no encontrada o código inválido.</h2>');
    }

    const venta = await Venta.findOne({
      where: { facturaId: factura.id },
      include: [{ model: Almacen, as: 'almacen' }]
    });

    let empresa = await Empresa.findOne();
    empresa = empresa ? empresa.get({ plain: true }) : {
      nombre: 'MULTINYECTORES COLOMBIA',
      nit: '900.123.456-7',
      direccion: 'Carrera 26 # 28-45, Tuluá - Valle del Cauca',
      telefono: '(602) 224-5000',
      correo: 'contacto@multinyectores.com'
    };

    const totalFactura = Number(factura.total || 0);
    const abonos = factura.Abonos || [];
    const totalAbonado = abonos.reduce((acc, ab) => acc + Number(ab.monto || 0), 0);
    const saldoPendiente = Math.max(0, totalFactura - totalAbonado);

    const metodoPago = (venta && venta.metodoPago) || factura.metodoPago || 'Efectivo';
    const esCredito = Boolean(
      metodoPago && (
        metodoPago.toLowerCase().includes('credito') || 
        metodoPago.toLowerCase().includes('crédito')
      )
    );
    const tieneAbonos = abonos.length > 0;
    const isAnulada = Boolean(
      factura.fechaAnulacion ||
      factura.motivoAnulacion ||
      (venta && venta.estado === 'Anulada') ||
      (factura.notas && factura.notas.includes('[ANULADA]'))
    );

    let estadoTexto = 'Pagada';
    let estadoColor = '#15803d';
    let estadoBg = '#dcfce7';
    let estadoBorde = '#86efac';
    let enCartera = false;

    if (isAnulada) {
      estadoTexto = 'Anulada';
      estadoColor = '#991b1b';
      estadoBg = '#fee2e2';
      estadoBorde = '#fca5a5';
    } else if (esCredito || tieneAbonos || (venta && venta.estado === 'En Cartera')) {
      if (saldoPendiente <= 0.01) {
        estadoTexto = 'Pagada (Paz y Salvo)';
        estadoColor = '#15803d';
        estadoBg = '#dcfce7';
        estadoBorde = '#86efac';
        enCartera = false;
      } else {
        estadoTexto = 'En Cartera (Crédito)';
        estadoColor = '#6b21a8';
        estadoBg = '#ede9fe';
        estadoBorde = '#c084fc';
        enCartera = true;
      }
    } else if (venta && venta.estado === 'Pendiente') {
      estadoTexto = 'Pendiente de Pago';
      estadoColor = '#9a3412';
      estadoBg = '#ffedd5';
      estadoBorde = '#fdba74';
    }

    if (req.query.format === 'json') {
      return res.json({
        factura,
        venta,
        empresa,
        estadoCalculado: estadoTexto,
        enCartera,
        totalAbonado,
        saldoPendiente,
        metodoPago
      });
    }

    const totalFormateado = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(totalFactura);
    const saldoFormateado = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(saldoPendiente);
    const abonadoFormateado = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(totalAbonado);
    const fechaFormateada = factura.fecha ? new Date(factura.fecha).toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'America/Bogota' }) : '';
    
    const filasItems = (factura.DetalleFacturas || []).map(d => `
      <tr style="border-bottom: 1px solid #e2e8f0;">
        <td style="padding: 10px; text-align: center;">${d.cantidad}</td>
        <td style="padding: 10px; color: #64748b;">${d.Producto?.codigo_oem || '-'}</td>
        <td style="padding: 10px; font-weight: 600; color: #1e293b;">${d.Producto?.nombre || 'Producto / Servicio'}</td>
        <td style="padding: 10px; text-align: right;">${new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(d.precio_unitario)}</td>
        <td style="padding: 10px; text-align: right; font-weight: bold; color: #15803d;">${new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(d.precio_unitario * d.cantidad)}</td>
      </tr>
    `).join('');

    res.send(`<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Factura Legal FAC-${factura.id} - ${empresa.nombre}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f8fafc; color: #1e293b; margin: 0; padding: 16px; }
    .card { max-width: 800px; margin: 0 auto; background: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); padding: 28px; }
    .header { display: flex; justify-content: space-between; border-bottom: 2px solid #2563eb; padding-bottom: 18px; margin-bottom: 20px; flex-wrap: wrap; gap: 16px; }
    .btn { background: #2563eb; color: #fff; border: none; padding: 10px 18px; border-radius: 6px; font-weight: 600; cursor: pointer; text-decoration: none; display: inline-flex; align-items: center; gap: 6px; font-size: 14px; }
    .btn-green { background: #22c55e; }
    @media print {
      body { background: white; padding: 0; }
      .card { box-shadow: none; padding: 0; max-width: 100%; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="no-print" style="display: flex; justify-content: space-between; margin-bottom: 20px; align-items: center; flex-wrap: wrap; gap: 10px;">
      <span style="color: #64748b; font-size: 14px; font-weight: 500;">Comprobante Digital Oficial Multinyectores Colombia</span>
      <button onclick="window.print()" class="btn">🖨️ Descargar en PDF / Imprimir</button>
    </div>
    
    <div class="header">
      <div>
        <h1 style="margin: 0 0 6px 0; font-size: 22px; color: #1e3a8a;">${empresa.nombre}</h1>
        <div style="font-size: 13px; color: #475569;">NIT: ${empresa.nit || '900.123.456-7'}</div>
        <div style="font-size: 13px; color: #475569;">${empresa.direccion || 'Tuluá - Valle del Cauca'}</div>
        <div style="font-size: 13px; color: #475569;">Tel: ${empresa.telefono || '(602) 224-5000'} | Email: ${empresa.correo || ''}</div>
      </div>
      <div style="text-align: right;">
        <h2 style="margin: 0 0 6px 0; font-size: 20px; color: #2563eb;">FACTURA LEGAL N° FAC-${factura.id}</h2>
        <div style="font-size: 13px; color: #475569;">Fecha: ${fechaFormateada}</div>
        <div style="font-size: 13px; color: #475569;">Sede: ${factura.almacen?.nombre || 'Sede Principal'}</div>
        <div style="margin-top: 6px;">
          <span style="background:${estadoBg};color:${estadoColor};border:1px solid ${estadoBorde};padding:4px 10px;border-radius:12px;font-size:12px;font-weight:700;">
            ${enCartera ? '📑' : (isAnulada ? '✕' : (estadoTexto.includes('Pendiente') ? '⏳' : '✓'))} ${estadoTexto}
          </span>
        </div>
      </div>
    </div>

    <div style="background: #f1f5f9; padding: 14px 18px; border-radius: 8px; margin-bottom: 20px; display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 10px; font-size: 13px;">
      <div><b>Cliente:</b> ${factura.cliente || 'Cliente General'}</div>
      <div><b>Doc/NIT:</b> ${factura.documento || 'Venta Mostrador'}</div>
      <div><b>Teléfono:</b> ${factura.telefono || 'N/A'}</div>
      <div><b>Método de Pago:</b> ${metodoPago} ${enCartera ? '<b>(Crédito Comercial)</b>' : ''}</div>
    </div>

    <table style="width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 20px;">
      <thead>
        <tr style="background: #f8fafc; border-bottom: 2px solid #cbd5e1; text-align: left;">
          <th style="padding: 10px; text-align: center;">Cant</th>
          <th style="padding: 10px;">OEM</th>
          <th style="padding: 10px;">Producto / Servicio</th>
          <th style="padding: 10px; text-align: right;">P. Unitario</th>
          <th style="padding: 10px; text-align: right;">Subtotal</th>
        </tr>
      </thead>
      <tbody>
        ${filasItems}
      </tbody>
    </table>

    <div style="display: flex; justify-content: flex-end; margin-bottom: 20px;">
      <div style="min-width: 280px; background: ${enCartera ? '#f5f3ff' : '#eff6ff'}; padding: 16px; border-radius: 8px; text-align: right; border: 1px solid ${enCartera ? '#ddd6fe' : '#bfdbfe'};">
        <div style="font-size: 13px; color: ${enCartera ? '#6b21a8' : '#1e40af'}; margin-bottom: 4px;">Total Facturado</div>
        <div style="font-size: 24px; font-weight: 800; color: ${enCartera ? '#5b21b6' : '#1e3a8a'};">${totalFormateado}</div>
        ${enCartera ? `
          <div style="margin-top: 8px; font-size: 13px; color: #15803d;">Abonado en Cartera: <b>-${abonadoFormateado}</b></div>
          <div style="margin-top: 6px; font-size: 17px; font-weight: 800; color: #7c3aed; border-top: 1px dashed #c084fc; padding-top: 6px;">
            Saldo Pendiente: ${saldoFormateado}
          </div>
        ` : ''}
      </div>
    </div>

    ${factura.notas ? `<div style="font-size: 12px; color: #64748b; margin-bottom: 16px; background: #f8fafc; padding: 10px; border-radius: 6px;"><b>Observaciones:</b> ${factura.notas}</div>` : ''}

    <div style="text-align: center; border-top: 1px dashed #cbd5e1; padding-top: 14px; font-size: 12px; color: #64748b;">
      ${empresa.pie_pagina_factura || 'Gracias por preferir a Multinyectores Colombia. Conserve este comprobante para su soporte o garantía.'}
    </div>
  </div>
</body>
</html>`);
  } catch (err) {
    console.error('[facturas] GET /public/:id error:', err);
    res.status(500).send('Error al consultar factura');
  }
});

// 2. OBTENER DETALLE COMPLETO DE UNA FACTURA PARA IMPRESIÓN/VISTA
router.get('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const factura = await Factura.findByPk(id, {
      include: [
        {
          model: DetalleFactura,
          as: 'DetalleFacturas',
          include: [{ model: Producto, as: 'Producto' }]
        },
        { model: Almacen, as: 'almacen' },
        { model: Abono, as: 'Abonos', order: [['fecha', 'DESC']] }
      ]
    });

    if (!factura) return res.status(404).json({ error: 'Factura no encontrada' });

    // CONTROL DE SEDE: si el usuario no es admin y el registro es de otra sede, responde 404
    const usuario = req.user || {};
    if (usuario.rol !== 'admin' && usuario.almacenId && factura.almacenId && factura.almacenId !== usuario.almacenId) {
      return res.status(404).json({ error: 'Factura no encontrada' });
    }

    // Cargar venta asociada si existe
    const venta = await Venta.findOne({
      where: { facturaId: id },
      include: [{ model: Almacen, as: 'almacen' }]
    });

    // Cargar datos de la empresa para la cabecera del documento
    let empresa = await Empresa.findOne();
    if (empresa) {
      empresa = empresa.get({ plain: true });
    } else {
      empresa = {
        nombre: 'MULTINYECTORES Y REPUESTOS S.A.S.',
        nit: '900.123.456-7',
        direccion: 'Carrera 26 # 28-45, Tuluá - Valle del Cauca',
        telefono: '(602) 224-5000',
        correo: 'contacto@multinyectores.com'
      };
    }

    const totalFactura = Number(factura.total || 0);
    const abonos = factura.Abonos || [];
    const totalAbonado = abonos.reduce((acc, ab) => acc + Number(ab.monto || 0), 0);
    const saldoPendiente = Math.max(0, totalFactura - totalAbonado);

    const metodoPago = (venta && venta.metodoPago) || factura.metodoPago || 'Efectivo';
    const esCredito = Boolean(
      metodoPago && (
        metodoPago.toLowerCase().includes('credito') || 
        metodoPago.toLowerCase().includes('crédito')
      )
    );
    const tieneAbonos = abonos.length > 0;
    const isAnulada = Boolean(
      factura.fechaAnulacion ||
      factura.motivoAnulacion ||
      (venta && venta.estado === 'Anulada') ||
      (factura.notas && factura.notas.includes('[ANULADA]'))
    );

    let estadoCalculado;
    let enCartera = false;

    if (isAnulada) {
      estadoCalculado = 'Anulada';
    } else if (esCredito || tieneAbonos || (venta && venta.estado === 'En Cartera')) {
      if (saldoPendiente <= 0.01) {
        estadoCalculado = 'Pagada';
        enCartera = false;
      } else {
        estadoCalculado = 'En Cartera';
        enCartera = true;
      }
    } else {
      estadoCalculado = venta ? venta.estado : 'Pagada';
    }

    res.json(sanitizarCostos({
      factura,
      venta,
      empresa,
      estadoCalculado,
      enCartera,
      totalAbonado,
      saldoPendiente,
      esCredito,
      metodoPago
    }, req.user));
  } catch (error) {
    console.error('[facturas] GET /:id error:', error);
    res.status(500).json({ error: 'Error al consultar la factura' });
  }
});

// 3. CREAR UNA FACTURA NUEVA (CON TRANSACCIÓN Y DESCUENTO DE INVENTARIO)
router.post('/', auth, requirePermiso('facturas.crear'), [
  body('cliente').notEmpty().withMessage('El cliente es obligatorio'),
  body('total').isNumeric().withMessage('El total debe ser numérico')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const t = await sequelize.transaction();
  try {
    const {
      cliente,
      clienteId,
      documento,
      tipo_documento,
      direccion,
      telefono,
      correo,
      notas,
      total,
      fecha,
      almacenId,
      metodoPago,
      descuento,
      impuestos,
      vendedor,
      detalles
    } = req.body;

    const usuario = req.user || {};
    const scopedAlmacenId = almacenDelUsuario(req, res);
    if (scopedAlmacenId === undefined && usuario.rol !== 'admin') {
      await t.rollback();
      return;
    }
    const almacenBaseId = usuario.rol === 'admin' ? (almacenId || usuario.almacenId) : scopedAlmacenId;
    if (!almacenBaseId) {
      await t.rollback();
      return res.status(400).json({ error: 'Debe seleccionar un almacén o el usuario debe tener uno asignado.' });
    }

    // Validar que la caja esté abierta si el método de pago es Efectivo
    const esEfectivo = String(metodoPago || '').trim().toLowerCase() === 'efectivo' || String(metodoPago || '').toLowerCase().includes('efectivo');
    if (esEfectivo) {
      const cajaAbierta = await Caja.findOne({
        where: {
          almacenId: almacenBaseId,
          estado: 'Abierta'
        },
        transaction: t
      });

      if (!cajaAbierta) {
        await t.rollback();
        return res.status(400).json({
          error: 'Abra la caja antes de registrar ventas en efectivo',
          codigo: 'CAJA_CERRADA'
        });
      }
    }

    // 0. Validar stock de todos los productos antes de registrar factura
    if (detalles && Array.isArray(detalles) && detalles.length > 0) {
      for (const item of detalles) {
        if (!item.productoId || !item.cantidad) continue;
        const prodId = Number(item.productoId);
        const cant = Number(item.cantidad);
        const itemAlmacenId = item.almacenId || almacenBaseId;

        const prod = await Producto.findByPk(prodId, { transaction: t });
        if (!prod) {
          await t.rollback();
          return res.status(400).json({ error: `Producto ID ${prodId} no encontrado en el sistema.` });
        }

        const esServicio = prod.tipo === 'servicio' || (prod.categoria && prod.categoria.toLowerCase().includes('servicio'));
        if (!esServicio) {
          const prodAlmacen = await ProductoAlmacen.findOne({
            where: { productoId: prodId, almacenId: itemAlmacenId },
            transaction: t
          });
          const stockActual = prodAlmacen ? prodAlmacen.stock : (prod.stock || 0);
          if (stockActual < cant) {
            await t.rollback();
            return res.status(400).json({
              error: `Stock insuficiente para "${prod.nombre}". Stock disponible: ${stockActual}, Solicitado: ${cant}`
            });
          }
        }
      }
    }

    // 1. Crear registro en tabla Factura
    const factura = await Factura.create({
      cliente,
      documento: documento || '',
      tipo_documento: tipo_documento || 'CC',
      direccion: direccion || '',
      telefono: telefono || '',
      correo: correo || '',
      notas: notas || '',
      total: Number(total) || 0,
      almacenId: almacenBaseId,
      fecha: calcularFechaVentaColombia(fecha)
    }, { transaction: t });

    // 2. Si vienen detalles de productos, procesarlos y descontar inventario
    if (detalles && Array.isArray(detalles) && detalles.length > 0) {
      for (const item of detalles) {
        if (!item.productoId || !item.cantidad) continue;

        const prodId = Number(item.productoId);
        const cant = Number(item.cantidad);
        const pUnit = Number(item.precio) || Number(item.precio_unitario) || 0;
        const itemAlmacenId = item.almacenId || almacenBaseId;

        // Crear DetalleFactura
        await DetalleFactura.create({
          facturaId: factura.id,
          productoId: prodId,
          cantidad: cant,
          precio_unitario: pUnit
        }, { transaction: t });

        // Descontar inventario solo si NO es un servicio
        const prodItem = await Producto.findByPk(prodId, { transaction: t });
        const esServicio = prodItem && (prodItem.tipo === 'servicio' || (prodItem.categoria && prodItem.categoria.toLowerCase().includes('servicio')));

        if (!esServicio) {
          // Descontar inventario en ProductoAlmacen
          let prodAlmacen = await ProductoAlmacen.findOne({
            where: { productoId: prodId, almacenId: itemAlmacenId },
            transaction: t
          });

          if (prodAlmacen) {
            await ProductoAlmacen.increment({ stock: -cant }, {
              where: { productoId: prodId, almacenId: itemAlmacenId },
              transaction: t
            });
          }

          // Descontar stock global del Producto
          await Producto.increment({ stock: -cant }, {
            where: { id: prodId },
            transaction: t
          });
        }
      }
    }

    // 3. Registrar Venta correspondiente asociada a la Factura
    const esMetodoCreditoPost = Boolean(
      metodoPago && (
        metodoPago.toLowerCase().includes('credito') || 
        metodoPago.toLowerCase().includes('crédito')
      )
    );
    const estadoVentaInicial = req.body.estado || (esMetodoCreditoPost ? 'En Cartera' : 'Pagada');

    const venta = await Venta.create({
      total: Number(total) || 0,
      clienteId: clienteId || 1,
      metodoPago: metodoPago || 'Efectivo',
      descuento: Number(descuento) || 0,
      impuestos: Number(impuestos) || 0,
      notas: notas || '',
      vendedor: vendedor || usuario.nombre || 'Sistema',
      estado: estadoVentaInicial,
      direccion: direccion || '',
      telefono: telefono || '',
      fecha: calcularFechaVentaColombia(fecha),
      facturaId: factura.id,
      almacenId: almacenBaseId
    }, { transaction: t });

    // Registrar DetalleVenta si hay detalles
    if (detalles && Array.isArray(detalles) && detalles.length > 0) {
      for (const item of detalles) {
        if (!item.productoId || !item.cantidad) continue;
        await DetalleVenta.create({
          ventaId: venta.id,
          productoId: Number(item.productoId),
          cantidad: Number(item.cantidad),
          precio_unitario: Number(item.precio) || Number(item.precio_unitario) || 0,
          almacenId: item.almacenId || almacenBaseId
        }, { transaction: t });
      }
    }

    await t.commit();

    // Cargar la factura creada con sus relaciones
    const facturaCompleta = await Factura.findByPk(factura.id, {
      include: [
        { model: DetalleFactura, as: 'DetalleFacturas', include: [{ model: Producto, as: 'Producto' }] },
        { model: Almacen, as: 'almacen' }
      ]
    });

    res.status(201).json(facturaCompleta);

  } catch (error) {
    await t.rollback();
    console.error('[facturas] POST / error:', error);
    res.status(500).json({ error: 'Error al crear la factura: ' + error.message });
  }
});

// 4. EDITAR / MODIFICAR UNA FACTURA EXISTENTE
router.put('/:id', auth, requirePermiso('facturas.crear'), async (req, res) => {
  try {
    const { id } = req.params;
    const { cliente, documento, tipo_documento, direccion, telefono, correo, notas, total, fecha, metodoPago } = req.body;

    const factura = await Factura.findByPk(id);
    if (!factura) return res.status(404).json({ error: 'Factura no encontrada' });

    if (req.user && req.user.rol !== 'admin' && factura.almacenId !== req.user.almacenId) {
      return res.status(403).json({ error: 'No puede modificar facturas de otra sede' });
    }

    if (cliente) factura.cliente = cliente;
    if (documento !== undefined) factura.documento = documento;
    if (tipo_documento !== undefined) factura.tipo_documento = tipo_documento;
    if (direccion !== undefined) factura.direccion = direccion;
    if (telefono !== undefined) factura.telefono = telefono;
    if (correo !== undefined) factura.correo = correo;
    if (notas !== undefined) factura.notas = notas;
    if (total !== undefined && !isNaN(Number(total))) factura.total = Number(total);
    if (fecha) {
      const obtenerDiaCol = (d) => {
        if (!d) return null;
        const dt = new Date(d);
        if (isNaN(dt.getTime())) return null;
        const parts = new Intl.DateTimeFormat('es-CO', {
          timeZone: 'America/Bogota',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit'
        }).formatToParts(dt);
        const y = parts.find(p => p.type === 'year')?.value;
        const m = parts.find(p => p.type === 'month')?.value;
        const day = parts.find(p => p.type === 'day')?.value;
        return `${y}-${m}-${day}`;
      };

      const diaEnviado = String(fecha).slice(0, 10);
      const diaActual = obtenerDiaCol(factura.fecha);

      // Solo cambia la fecha si el día enviado es distinto al día actual del registro; si es el mismo día, conserva la hora original
      if (diaEnviado && diaActual && diaEnviado !== diaActual) {
        factura.fecha = calcularFechaVentaColombia(fecha);
      }
    }

    await factura.save();

    // Sincronizar datos clave con la venta asociada si existe
    const venta = await Venta.findOne({ where: { facturaId: id } });
    if (venta) {
      if (notas !== undefined) venta.notas = notas;
      if (total !== undefined && !isNaN(Number(total))) venta.total = Number(total);
      if (direccion !== undefined) venta.direccion = direccion;
      if (telefono !== undefined) venta.telefono = telefono;
      if (metodoPago) venta.metodoPago = metodoPago;
      if (fecha) {
        const obtenerDiaCol = (d) => {
          if (!d) return null;
          const dt = new Date(d);
          if (isNaN(dt.getTime())) return null;
          const parts = new Intl.DateTimeFormat('es-CO', {
            timeZone: 'America/Bogota',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
          }).formatToParts(dt);
          const y = parts.find(p => p.type === 'year')?.value;
          const m = parts.find(p => p.type === 'month')?.value;
          const day = parts.find(p => p.type === 'day')?.value;
          return `${y}-${m}-${day}`;
        };
        const diaEnviado = String(fecha).slice(0, 10);
        const diaActualVenta = obtenerDiaCol(venta.fecha);
        if (diaEnviado && diaActualVenta && diaEnviado !== diaActualVenta) {
          venta.fecha = calcularFechaVentaColombia(fecha);
        }
      }
      await venta.save();
    }

    res.json({ mensaje: 'Factura actualizada exitosamente', factura, venta });
  } catch (error) {
    console.error('[facturas] PUT /:id error:', error);
    res.status(500).json({ error: 'Error al actualizar factura: ' + error.message });
  }
});

// 4.1 VALIDAR Y CERTIFICAR INGRESO DEL DINERO (FACTURAR PENDIENTE)
router.post('/:id/certificar', auth, requirePermiso('ventas.cobrar'), async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;
    const { metodoPago, referenciaPago, observaciones, montoRecibido, desglosePago } = req.body || {};
    const usuario = req.user || {};

    const factura = await Factura.findByPk(id, { transaction: t });
    if (!factura) {
      await t.rollback();
      return res.status(404).json({ error: 'Factura no encontrada' });
    }

    if (usuario.rol !== 'admin' && factura.almacenId !== usuario.almacenId) {
      await t.rollback();
      return res.status(403).json({ error: 'No puede certificar pagos de otra sede' });
    }

    if (factura.notas && factura.notas.includes('[ANULADA]')) {
      await t.rollback();
      return res.status(400).json({ error: 'No se puede certificar una factura anulada' });
    }

    // Calcular el texto final del método de pago si es pago mixto
    let metodoFinal = metodoPago || factura.metodoPago || 'Efectivo';
    if (Array.isArray(desglosePago) && desglosePago.length > 0) {
      const desgloseTexto = desglosePago
        .filter(d => Number(d.monto) > 0)
        .map(d => `${d.metodo || 'Efectivo'}: $${Number(d.monto || 0).toLocaleString('es-CO')}${d.referencia ? ` [Ref: ${d.referencia}]` : ''}`)
        .join(' + ');
      if (desgloseTexto) {
        metodoFinal = `Pago Mixto (${desgloseTexto})`;
      }
    }

    // Buscar y actualizar venta asociada
    const venta = await Venta.findOne({ where: { facturaId: id }, transaction: t });
    const esCreditoCert = Boolean(
      metodoFinal && (
        metodoFinal.toLowerCase().includes('credito') || 
        metodoFinal.toLowerCase().includes('crédito')
      )
    );
    const estadoFinal = esCreditoCert ? 'En Cartera' : 'Pagada';

    if (venta) {
      venta.estado = estadoFinal;
      venta.metodoPago = metodoFinal;
      const certText = `[PAGO CERTIFICADO] Validado por ${usuario.nombre || 'Caja'} (${new Date().toLocaleDateString('es-CO')} ${new Date().toLocaleTimeString('es-CO')}). Método: ${metodoFinal}${referenciaPago ? ` | Ref: ${referenciaPago}` : ''}${observaciones ? ` | Obs: ${observaciones}` : ''}`;
      venta.notas = venta.notas ? `${venta.notas} | ${certText}` : certText;
      await venta.save({ transaction: t });
    }

    // Actualizar factura
    factura.metodoPago = metodoFinal;
    const facturaCertText = `[PAGO CERTIFICADO] Validado por ${usuario.nombre || 'Caja'} (${new Date().toLocaleDateString('es-CO')}). Método: ${metodoFinal}`;
    if (!factura.notas || !factura.notas.includes('[PAGO CERTIFICADO]')) {
      factura.notas = factura.notas ? `${factura.notas} | ${facturaCertText}` : facturaCertText;
    }
    await factura.save({ transaction: t });

    await t.commit();

    res.json({
      mensaje: esCreditoCert 
        ? 'Factura a crédito certificada y enviada a Cartera exitosamente'
        : 'Ingreso del dinero certificado y factura emitida con éxito',
      facturaId: factura.id,
      ventaId: venta ? venta.id : null,
      estadoVenta: estadoFinal
    });
  } catch (error) {
    await t.rollback();
    console.error('[facturas] POST /:id/certificar error:', error);
    res.status(500).json({ error: 'Error al certificar el pago: ' + error.message });
  }
});

// 5. ANULAR FACTURA Y DEVOLVER INVENTARIO A LA BODEGA
router.post('/:id/anular', auth, requirePermiso('facturas.anular'), async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;
    const { motivoAnulacion } = req.body || {};

    if (!motivoAnulacion || !String(motivoAnulacion).trim()) {
      await t.rollback();
      return res.status(400).json({ error: 'El motivo de anulación es obligatorio.' });
    }

    const factura = await Factura.findByPk(id, {
      include: [{ model: DetalleFactura, as: 'DetalleFacturas' }],
      transaction: t
    });

    if (!factura) {
      await t.rollback();
      return res.status(404).json({ error: 'Factura no encontrada' });
    }

    if (req.user && req.user.rol !== 'admin' && factura.almacenId !== req.user.almacenId) {
      await t.rollback();
      return res.status(403).json({ error: 'No puede anular facturas de otra sede' });
    }

    if (factura.fechaAnulacion || (factura.notas && factura.notas.includes('[ANULADA]'))) {
      await t.rollback();
      return res.status(400).json({ error: 'La factura ya se encuentra anulada.' });
    }

    // Reintegrar productos de la factura al inventario de la bodega (solo si no es servicio)
    const detalles = factura.DetalleFacturas || [];
    for (const d of detalles) {
      const prodId = d.productoId;
      const cant = Number(d.cantidad || 0);
      const almId = factura.almacenId || 1;

      if (!prodId || cant <= 0) continue;

      const prod = await Producto.findByPk(prodId, { transaction: t });
      if (!prod) continue;
      const isServ = prod.tipo === 'servicio' || (prod.categoria && prod.categoria.toLowerCase().includes('servicio'));
      if (isServ) continue;

      // Reintegrar a ProductoAlmacen
      const pa = await ProductoAlmacen.findOne({
        where: { productoId: prodId, almacenId: almId },
        transaction: t
      });

      if (pa) {
        await ProductoAlmacen.increment({ stock: cant }, { where: { productoId: prodId, almacenId: almId }, transaction: t });
      } else {
        await ProductoAlmacen.create({ productoId: prodId, almacenId: almId, stock: cant }, { transaction: t });
      }

      // Reintegrar a Producto global
      await Producto.increment({ stock: cant }, { where: { id: prodId }, transaction: t });
    }

    const usuario = req.user ? (req.user.nombre || req.user.correo || 'Usuario') : 'Usuario';
    const ahora = new Date();
    const motivoLimpio = String(motivoAnulacion).trim();
    const marcaAnulada = `[ANULADA] Por ${usuario} el ${ahora.toLocaleDateString('es-CO')}. Motivo: ${motivoLimpio}`;
    
    factura.estado = 'Anulada';
    factura.anuladaPor = usuario;
    factura.motivoAnulacion = motivoLimpio;
    factura.fechaAnulacion = ahora;
    factura.notas = factura.notas ? `${factura.notas} | ${marcaAnulada}` : marcaAnulada;
    await factura.save({ transaction: t });

    // Anular venta asociada si existe
    const venta = await Venta.findOne({ where: { facturaId: id }, transaction: t });
    if (venta) {
      venta.estado = 'Anulada';
      venta.anuladaPor = usuario;
      venta.motivoAnulacion = motivoLimpio;
      venta.fechaAnulacion = ahora;
      venta.notas = venta.notas ? `${venta.notas} | ${marcaAnulada}` : marcaAnulada;
      await venta.save({ transaction: t });
    }

    await t.commit();

    res.json({
      mensaje: 'Factura anulada con éxito y stock reintegrado al inventario.',
      facturaId: id
    });

  } catch (error) {
    await t.rollback();
    console.error('[facturas] POST /:id/anular error:', error);
    res.status(500).json({ error: 'Error al anular la factura: ' + error.message });
  }
});

// 6. ELIMINAR FACTURA (PROHIBIDO POR REGLA DE NEGOCIO)
router.delete('/:id', auth, async (req, res) => {
  return res.status(403).json({ error: 'Las facturas y ventas no se eliminan; use Anular' });
});

module.exports = router;
