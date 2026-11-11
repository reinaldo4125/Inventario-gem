const express = require('express');
const { body, validationResult } = require('express-validator');
const auth = require('../middleware/auth');
const requirePermiso = require('../middleware/roles');
const { almacenDelUsuario, sanitizarCostos } = require('../utils/almacenScope');
const router = express.Router();
const { Op } = require('sequelize');
const sequelize = require('../database/sequelize');

const Venta = require('../models/Venta');
const DetalleVenta = require('../models/DetalleVenta');
const Producto = require('../models/Producto');
const Factura = require('../models/Factura');
const DetalleFactura = require('../models/DetalleFactura');
const Cliente = require('../models/Cliente');
const Almacen = require('../models/Almacen');
const ProductoAlmacen = require('../models/ProductoAlmacen');
const Empresa = require('../models/Empresa');
const Kardex = require('../models/Kardex');
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

// 1. OBTENER TODAS LAS VENTAS (CON FILTROS Y ESTADÍSTICAS)
router.get('/', auth, requirePermiso(['ventas.crear', 'dashboard.ver']), async (req, res) => {
  try {
    const usuario = req.user || {};
    const isAdmin = usuario.rol === 'admin';
    const where = {};

    const scopedAlmacenId = almacenDelUsuario(req, res);
    if (scopedAlmacenId === undefined && !isAdmin) return;

    if (scopedAlmacenId) {
      where.almacenId = scopedAlmacenId;
    }

    if (usuario.rol === 'vendedor') {
      where.vendedor = usuario.nombre;
    }

    // Filtros por Query Params
    const { estado, fechaInicio, fechaFin, clienteId, vendedor, q } = req.query;

    if (estado && ['Pendiente', 'Pagada', 'Anulada'].includes(estado)) {
      where.estado = estado;
    }

    if (clienteId) {
      where.clienteId = clienteId;
    }

    if (vendedor && usuario.rol !== 'vendedor') {
      where.vendedor = { [Op.like]: `%${vendedor}%` };
    }

    if (fechaInicio && fechaFin) {
      where.fecha = {
        [Op.between]: [`${fechaInicio} 00:00:00`, `${fechaFin} 23:59:59`]
      };
    } else if (fechaInicio) {
      where.fecha = { [Op.gte]: `${fechaInicio} 00:00:00` };
    } else if (fechaFin) {
      where.fecha = { [Op.lte]: `${fechaFin} 23:59:59` };
    }

    if (q && q.trim()) {
      const term = q.trim();
      const isNum = !isNaN(Number(term));
      where[Op.or] = [
        ...(isNum ? [{ id: Number(term) }] : []),
        { notas: { [Op.like]: `%${term}%` } },
        { metodoPago: { [Op.like]: `%${term}%` } },
        { vendedor: { [Op.like]: `%${term}%` } }
      ];
    }

    const ventas = await Venta.findAll({
      where,
      include: [
        { model: DetalleVenta, include: [{ model: Producto, attributes: ['id', 'nombre', 'codigo_oem', 'marca', 'categoria', 'precio', 'costo'] }] },
        { model: Cliente, attributes: ['id', 'nombre', 'documento', 'telefono', 'direccion', 'correo', 'tipo_cliente'] },
        { model: Almacen, as: 'almacen', attributes: ['id', 'nombre', 'codigo', 'ciudad', 'ubicacion'] }
      ],
      order: [['fecha', 'DESC'], ['id', 'DESC']]
    });

    res.json(sanitizarCostos(ventas, req.user));
  } catch (error) {
    console.error('[ventas] GET / error:', error);
    res.status(500).json({ error: 'Error al obtener ventas', detalles: error.message });
  }
});

// VISTA / COMPROBANTE PÚBLICO PARA CLIENTES DESDE WHATSAPP (SIN LOGIN)
router.get('/public/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const venta = await Venta.findOne({
      where: { token_publico: token },
      include: [
        { model: DetalleVenta, include: [Producto] },
        { model: Cliente },
        { model: Almacen, as: 'almacen' }
      ]
    });

    if (!venta) {
      return res.status(404).send('<h2 style="font-family:sans-serif;text-align:center;padding:50px;">Comprobante no encontrado o código inválido.</h2>');
    }

    const ventaPlain = venta.get({ plain: true });
    let detalles = ventaPlain.DetalleVentas || ventaPlain.DetalleVenta || ventaPlain.detalles || [];
    if (!detalles || detalles.length === 0) {
      detalles = await DetalleVenta.findAll({
        where: { ventaId: venta.id },
        include: [{ model: Producto }]
      });
      detalles = detalles.map(d => d.get({ plain: true }));
    }

    let empresa = await Empresa.findOne();
    empresa = empresa ? empresa.get({ plain: true }) : {
      nombre: 'MULTINYECTORES COLOMBIA',
      nit: '900.123.456-7',
      direccion: 'Carrera 26 # 28-45, Tuluá - Valle del Cauca',
      telefono: '(602) 224-5000',
      correo: 'contacto@multinyectores.com'
    };

    if (req.query.format === 'json') {
      return res.json({ venta: ventaPlain, empresa });
    }

    const isCotiz = ventaPlain.es_cotizacion || ventaPlain.estado === 'Cotizacion' || (ventaPlain.notas && ventaPlain.notas.toLowerCase().includes('cotiz'));
    const docTipo = isCotiz ? 'COTIZACIÓN' : 'COMPROBANTE DE VENTA';
    const docPrefix = isCotiz ? 'COT' : 'VEN';
    const totalFormateado = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(ventaPlain.total || 0);
    const fechaFormateada = ventaPlain.fecha ? new Date(ventaPlain.fecha).toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'America/Bogota' }) : '';

    const filasItems = detalles.map(d => `
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
  <title>${docTipo} #${docPrefix}-${ventaPlain.id} - ${empresa.nombre}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f8fafc; color: #1e293b; margin: 0; padding: 16px; }
    .card { max-width: 800px; margin: 0 auto; background: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); padding: 28px; }
    .header { display: flex; justify-content: space-between; border-bottom: 2px solid #2563eb; padding-bottom: 18px; margin-bottom: 20px; flex-wrap: wrap; gap: 16px; }
    .btn { background: #2563eb; color: #fff; border: none; padding: 10px 18px; border-radius: 6px; font-weight: 600; cursor: pointer; text-decoration: none; display: inline-flex; align-items: center; gap: 6px; font-size: 14px; }
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
        <h2 style="margin: 0 0 6px 0; font-size: 20px; color: #2563eb;">${docTipo} N° ${docPrefix}-${ventaPlain.id}</h2>
        <div style="font-size: 13px; color: #475569;">Fecha: ${fechaFormateada}</div>
        <div style="font-size: 13px; color: #475569;">Sede: ${ventaPlain.almacen?.nombre || 'Sede Principal'}</div>
        <div style="margin-top: 6px;"><span style="background:#dcfce7;color:#15803d;padding:4px 10px;border-radius:12px;font-size:12px;font-weight:700;">Estado: ${ventaPlain.estado || 'Completada'}</span></div>
      </div>
    </div>

    <div style="background: #f1f5f9; padding: 14px 18px; border-radius: 8px; margin-bottom: 20px; display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 10px; font-size: 13px;">
      <div><b>Cliente:</b> ${ventaPlain.Cliente?.nombre || 'Cliente General'}</div>
      <div><b>Doc/NIT:</b> ${ventaPlain.Cliente?.documento || 'Venta Mostrador'}</div>
      <div><b>Teléfono:</b> ${ventaPlain.Cliente?.telefono || 'N/A'}</div>
      <div><b>Método de Pago:</b> ${ventaPlain.metodoPago || 'Efectivo'}</div>
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
      <div style="min-width: 260px; background: #eff6ff; padding: 16px; border-radius: 8px; text-align: right; border: 1px solid #bfdbfe;">
        <div style="font-size: 13px; color: #1e40af; margin-bottom: 4px;">Valor Total</div>
        <div style="font-size: 24px; font-weight: 800; color: #1e3a8a;">${totalFormateado}</div>
      </div>
    </div>

    ${ventaPlain.notas ? `<div style="font-size: 12px; color: #64748b; margin-bottom: 16px; background: #f8fafc; padding: 10px; border-radius: 6px;"><b>Observaciones:</b> ${ventaPlain.notas}</div>` : ''}

    <div style="text-align: center; border-top: 1px dashed #cbd5e1; padding-top: 14px; font-size: 12px; color: #64748b;">
      ${empresa.pie_pagina_factura || 'Gracias por su compra en Multinyectores Colombia. Conserve este comprobante para su soporte o garantía.'}
    </div>
  </div>
</body>
</html>`);
  } catch (err) {
    console.error('[ventas] GET /public/:id error:', err);
    res.status(500).send('Error al consultar comprobante');
  }
});

// 2. OBTENER DETALLE O COMPROBANTE DE UNA VENTA ESPECÍFICA
router.get('/:id/comprobante', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const venta = await Venta.findByPk(id, {
      include: [
        { model: DetalleVenta, include: [Producto] },
        { model: Cliente },
        { model: Almacen, as: 'almacen' }
      ]
    });

    if (!venta) return res.status(404).json({ error: 'Venta no encontrada' });

    // CONTROL DE SEDE: si el usuario no es admin y el registro es de otra sede, responde 404
    const usuario = req.user || {};
    if (usuario.rol !== 'admin' && usuario.almacenId && venta.almacenId !== usuario.almacenId) {
      return res.status(404).json({ error: 'Venta no encontrada' });
    }

    const ventaPlain = venta.get({ plain: true });

    // Cargar detalles de forma explícita si no llegaron vinculados automáticamente
    let detalles = ventaPlain.DetalleVentas || ventaPlain.DetalleVenta || ventaPlain.detalles || [];
    if (!detalles || detalles.length === 0) {
      detalles = await DetalleVenta.findAll({
        where: { ventaId: id },
        include: [{ model: Producto }]
      });
      detalles = detalles.map(d => d.get({ plain: true }));
    }

    ventaPlain.DetalleVentas = detalles;

    // Cargar datos de la empresa para la cabecera
    let empresa = await Empresa.findOne();
    if (empresa) {
      empresa = empresa.get({ plain: true });
    } else {
      empresa = {
        nombre: 'MULTINYECTORES Y REPUESTOS S.A.S.',
        nit: '900.123.456-7',
        direccion: 'Carrera 26 # 28-45, Tuluá - Valle',
        telefono: '(602) 224-5000',
        correo: 'contacto@multinyectores.com'
      };
    }

    res.json(sanitizarCostos({
      empresa,
      venta: ventaPlain
    }, req.user));
  } catch (error) {
    console.error('[ventas] GET /:id/comprobante error:', error);
    res.status(500).json({ error: 'Error al generar comprobante de venta' });
  }
});

// 3. HISTORIAL DE VENTAS POR CLIENTE
router.get('/cliente/:clienteId', auth, async (req, res) => {
  try {
    const usuario = req.user || {};
    const where = { clienteId: req.params.clienteId };
    if (usuario.rol !== 'admin' && usuario.almacenId) {
      where.almacenId = usuario.almacenId;
    }
    const ventas = await Venta.findAll({
      where,
      include: [
        { model: DetalleVenta, include: [Producto] },
        { model: Almacen, as: 'almacen', attributes: ['id', 'nombre'] }
      ],
      order: [['fecha', 'DESC']]
    });

    if (usuario.rol !== 'admin' && usuario.almacenId && ventas.length === 0) {
      const existeOtraSede = await Venta.count({ where: { clienteId: req.params.clienteId } });
      if (existeOtraSede > 0) {
        return res.status(404).json({ error: 'Registro no encontrado en su sede' });
      }
    }

    res.json(sanitizarCostos(ventas, req.user));
  } catch (error) {
    console.error('[ventas] GET /cliente/:clienteId error:', error);
    res.status(500).json({ error: 'Error al obtener historial de compras' });
  }
});

// 4. CREAR NUEVA VENTA (CON TRANSACCIÓN ATÓMICA Y DESCUENTO DE STOCK)
router.post('/', auth, requirePermiso('ventas.crear'), async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const {
      detalles,
      almacenesSeleccionados,
      cliente,
      clienteId,
      metodoPago,
      descuento,
      notas,
      vendedor,
      estado,
      direccion,
      telefono,
      impuestos,
      fecha,
      almacenId: reqAlmacenId
    } = req.body;

    const usuario = req.user || {};

    if (!detalles || !Array.isArray(detalles) || detalles.length === 0) {
      await t.rollback();
      return res.status(400).json({ error: 'Debe incluir al menos un producto en la venta.' });
    }

    // Determinar almacén base de la venta según rol
    const scopedAlmacenId = almacenDelUsuario(req, res);
    if (scopedAlmacenId === undefined && usuario.rol !== 'admin') {
      await t.rollback();
      return;
    }
    const almacenBaseId = usuario.rol === 'admin' ? (reqAlmacenId || usuario.almacenId) : scopedAlmacenId;
    if (!almacenBaseId) {
      await t.rollback();
      return res.status(400).json({ error: 'Debe seleccionar un almacén o el usuario debe tener uno asignado.' });
    }

    const almacenExistente = await Almacen.findByPk(almacenBaseId, { transaction: t });
    if (!almacenExistente) {
      await t.rollback();
      return res.status(400).json({ error: 'El almacén especificado no existe.' });
    }

    // Si metodoPago es 'Efectivo', verificar que haya una caja con estado 'Abierta' en ese almacén
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

    // Verificar y preparar productos
    const detallesValidos = [];

    for (const d of detalles) {
      if (!d.productoId || !d.cantidad || d.cantidad <= 0) continue;

      const itemAlmacenId = (almacenesSeleccionados && almacenesSeleccionados[d.productoId]) || d.almacenId || almacenBaseId;

      const prod = await Producto.findByPk(d.productoId, { transaction: t });
      if (!prod) {
        await t.rollback();
        return res.status(400).json({ error: `Producto ID ${d.productoId} no encontrado en el sistema.` });
      }

      const esServicio = prod.tipo === 'servicio' || (prod.categoria && prod.categoria.toLowerCase().includes('servicio'));

      // Buscar stock específico en la bodega del almacén
      let prodAlmacen = await ProductoAlmacen.findOne({
        where: { productoId: d.productoId, almacenId: itemAlmacenId },
        transaction: t
      });

      if (!prodAlmacen) {
        prodAlmacen = await ProductoAlmacen.create({
          productoId: d.productoId,
          almacenId: itemAlmacenId,
          stock: esServicio ? 99999 : (prod.stock || 0)
        }, { transaction: t });
      }

      if (!esServicio && prodAlmacen.stock < d.cantidad) {
        await t.rollback();
        return res.status(400).json({
          error: `Stock insuficiente para "${prod.nombre}" en la bodega seleccionada. Stock disponible: ${prodAlmacen.stock}, Solicitado: ${d.cantidad}`
        });
      }

      detallesValidos.push({
        productoId: d.productoId,
        cantidad: Number(d.cantidad),
        precio: Number(d.precio) || Number(prod.precio_detal) || Number(prod.precio) || 0,
        prod,
        almacenId: itemAlmacenId
      });
    }

    if (!detallesValidos.length) {
      await t.rollback();
      return res.status(400).json({ error: 'No se encontraron productos válidos para procesar la venta.' });
    }

    // Buscar cliente
    let clienteObj = null;
    const clienteEspecificado = Boolean(clienteId || (cliente && String(cliente).trim() !== ''));

    if (clienteId) {
      clienteObj = await Cliente.findByPk(clienteId, { transaction: t });
    }
    if (!clienteObj && cliente && String(cliente).trim() !== '') {
      const isNumeric = !isNaN(Number(cliente));
      clienteObj = await Cliente.findOne({
        where: {
          [Op.or]: [
            { nombre: cliente },
            ...(isNumeric ? [{ id: Number(cliente) }] : [])
          ]
        },
        transaction: t
      });
    }

    if (clienteEspecificado && !clienteObj) {
      await t.rollback();
      return res.status(400).json({ error: 'El cliente especificado no existe.' });
    }

    if (!clienteObj) {
      // Cliente por defecto: CONSUMIDOR FINAL con documento 222222222222
      let [consumidorFinal] = await Cliente.findOrCreate({
        where: { documento: '222222222222' },
        defaults: {
          nombre: 'CONSUMIDOR FINAL',
          documento: '222222222222',
          tipo_documento: 'CC',
          telefono: '0000000',
          correo: 'consumidorfinal@sistema.com',
          direccion: 'Venta Mostrador',
          activo: 1
        },
        transaction: t
      });
      clienteObj = consumidorFinal;
    }

    // Subtotal de la venta
    const subtotalBruto = detallesValidos.reduce((sum, d) => sum + (d.precio * d.cantidad), 0);
    const descPct = Number(descuento) || 0;
    const impPct = Number(impuestos) || 0;
    const montoDescuento = subtotalBruto * (descPct / 100);
    const montoImpuestos = subtotalBruto * (impPct / 100);
    const totalNeto = subtotalBruto - montoDescuento + montoImpuestos;

    // Crear Factura
    const fechaFinal = calcularFechaVentaColombia(fecha);

    const factura = await Factura.create({
      cliente: clienteObj.nombre,
      documento: clienteObj.documento || '',
      tipo_documento: clienteObj.tipo_documento || '',
      direccion: clienteObj.direccion || '',
      telefono: clienteObj.telefono || '',
      correo: clienteObj.correo || '',
      notas: notas || '',
      total: totalNeto,
      almacenId: almacenBaseId,
      fecha: fechaFinal
    }, { transaction: t });

    // Crear Venta
    const esCotizacion = req.body.esCotizacion ? true : false;
    const metodosPagoStr = Array.isArray(req.body.metodosPago) ? JSON.stringify(req.body.metodosPago) : null;

    const venta = await Venta.create({
      total: totalNeto,
      clienteId: clienteObj.id,
      metodoPago: metodoPago || 'Efectivo',
      descuento: descPct,
      notas: notas || '',
      vendedor: vendedor || usuario.nombre || 'Sistema',
      estado: esCotizacion ? 'Pendiente' : (estado || 'Pendiente'),
      direccion: direccion || clienteObj.direccion || '',
      telefono: telefono || clienteObj.telefono || '',
      impuestos: impPct,
      fecha: fechaFinal,
      facturaId: factura.id,
      almacenId: almacenBaseId,
      es_cotizacion: esCotizacion,
      metodos_pago: metodosPagoStr
    }, { transaction: t });

    // Crear detalles y descontar inventarios
    for (const d of detallesValidos) {
      await DetalleVenta.create({
        ventaId: venta.id,
        productoId: d.productoId,
        cantidad: d.cantidad,
        precio_unitario: d.precio,
        almacenId: d.almacenId
      }, { transaction: t });

      const isServicio = d.prod && (d.prod.tipo === 'servicio' || (d.prod.categoria && d.prod.categoria.toLowerCase().includes('servicio')));

      if (!isServicio && !esCotizacion) {
        // Descontar en ProductoAlmacen
        await ProductoAlmacen.increment(
          { stock: -d.cantidad },
          { where: { productoId: d.productoId, almacenId: d.almacenId }, transaction: t }
        );

        // Descontar en Producto global
        await Producto.increment(
          { stock: -d.cantidad },
          { where: { id: d.productoId }, transaction: t }
        );

        // Registrar movimiento en Kardex
        try {
          const paActual = await ProductoAlmacen.findOne({ where: { productoId: d.productoId, almacenId: d.almacenId }, transaction: t });
          const stockNuevo = paActual ? Number(paActual.stock || 0) : 0;
          await Kardex.create({
            productoId: d.productoId,
            almacenId: d.almacenId,
            tipo: 'Salida (Venta)',
            origen_destino: `Venta #${venta.id} (Factura #${factura.id}) - Cliente: ${clienteObj.nombre}`,
            cantidad: -d.cantidad,
            stock_anterior: stockNuevo + d.cantidad,
            stock_nuevo: stockNuevo,
            usuario: vendedor || usuario.nombre || 'Sistema',
            fecha: new Date(),
            referencia_id: venta.id
          }, { transaction: t });
        } catch (kErr) {
          console.warn('Error registrando en kardex:', kErr);
        }
      }

      // Crear DetalleFactura si existe la tabla
      if (DetalleFactura) {
        try {
          await DetalleFactura.create({
            facturaId: factura.id,
            productoId: d.productoId,
            cantidad: d.cantidad,
            precio_unitario: d.precio
          }, { transaction: t });
        } catch (dfErr) {
          console.error('[ventas] Error creando DetalleFactura:', dfErr);
        }
      }
    }

    // Confirmar la transacción
    await t.commit();

    // Responder con la venta registrada y sus relaciones
    const ventaCompleta = await Venta.findByPk(venta.id, {
      include: [
        { model: DetalleVenta, include: [Producto] },
        { model: Cliente },
        { model: Almacen, as: 'almacen' }
      ]
    });

    const ventaPlain = ventaCompleta ? ventaCompleta.get({ plain: true }) : { id: venta.id };
    let detallesPost = ventaPlain.DetalleVentas || ventaPlain.DetalleVenta || ventaPlain.detalles || [];
    if (!detallesPost || detallesPost.length === 0) {
      detallesPost = await DetalleVenta.findAll({
        where: { ventaId: venta.id },
        include: [{ model: Producto }]
      });
      detallesPost = detallesPost.map(d => d.get({ plain: true }));
    }
    ventaPlain.DetalleVentas = detallesPost;

    res.status(201).json({
      mensaje: 'Venta registrada con éxito',
      venta: ventaPlain,
      facturaId: factura.id
    });

  } catch (error) {
    await t.rollback();
    console.error('[ventas] POST / error:', error);
    res.status(500).json({ error: 'Error al procesar la venta: ' + (error.message || 'Error del servidor') });
  }
});

// 5. MARCAR VENTA COMO PAGADA / CONVERTIR COTIZACIÓN A VENTA
router.post('/:id/convertir-factura', auth, requirePermiso('facturas.crear'), async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;
    const venta = await Venta.findByPk(id, {
      include: [{ model: DetalleVenta, include: [Producto] }, { model: Cliente }],
      transaction: t
    });

    if (!venta) {
      await t.rollback();
      return res.status(404).json({ error: 'Cotización / Venta no encontrada' });
    }

    if (!venta.es_cotizacion && venta.estado === 'Pagada') {
      await t.rollback();
      return res.status(400).json({ error: 'Esta venta ya se encuentra pagada y procesada.' });
    }

    const detalles = venta.DetalleVentas || venta.DetalleVenta || [];

    // Descontar inventarios si era cotización
    for (const d of detalles) {
      const productoId = d.productoId;
      const cantidad = Number(d.cantidad || 0);
      const almacenId = d.almacenId || venta.almacenId || 1;

      const prod = await Producto.findByPk(productoId, { transaction: t });
      if (!prod) continue;
      const isServ = prod.tipo === 'servicio' || (prod.categoria && prod.categoria.toLowerCase().includes('servicio'));

      if (!isServ) {
        let pa = await ProductoAlmacen.findOne({
          where: { productoId, almacenId },
          transaction: t
        });

        if (pa) {
          if (pa.stock < cantidad) {
            await t.rollback();
            return res.status(400).json({
              error: `Stock insuficiente para "${prod.nombre}" en la bodega. Disponible: ${pa.stock}, Requerido: ${cantidad}`
            });
          }
          pa.stock = pa.stock - cantidad;
          await pa.save({ transaction: t });
        }

        await Producto.decrement({ stock: cantidad }, { where: { id: productoId }, transaction: t });

        // Kardex
        try {
          const stockNuevo = pa ? pa.stock : 0;
          await Kardex.create({
            productoId,
            almacenId,
            tipo: 'Salida (Venta)',
            origen_destino: `Conversión Cotización #${venta.id} a Venta/Factura`,
            cantidad: -cantidad,
            stock_anterior: stockNuevo + cantidad,
            stock_nuevo: stockNuevo,
            usuario: req.user ? req.user.nombre : 'Sistema',
            fecha: new Date(),
            referencia_id: venta.id
          }, { transaction: t });
        } catch (e) {}
      }
    }

    venta.es_cotizacion = false;
    venta.estado = 'Pagada';
    await venta.save({ transaction: t });

    await t.commit();
    res.json({ mensaje: 'Cotización convertida a Venta y Factura con éxito', venta });
  } catch (error) {
    await t.rollback();
    console.error('Error convirtiendo cotización:', error);
    res.status(500).json({ error: 'Error al convertir la cotización a venta/factura: ' + (error.message || error) });
  }
});

router.put('/:id/pagar', auth, requirePermiso('ventas.cobrar'), async (req, res) => {
  try {
    const { id } = req.params;
    const venta = await Venta.findByPk(id);

    if (!venta) return res.status(404).json({ error: 'Venta no encontrada' });
    if (venta.estado === 'Anulada') return res.status(400).json({ error: 'No se puede marcar como pagada una venta anulada' });

    // Si el pago es en efectivo, verificar que la caja de la sede esté abierta
    const metodo = req.body?.metodoPago || venta.metodoPago;
    const esEfectivo = String(metodo || '').trim().toLowerCase() === 'efectivo' || String(metodo || '').toLowerCase().includes('efectivo');
    if (esEfectivo) {
      const cajaAbierta = await Caja.findOne({
        where: {
          almacenId: venta.almacenId,
          estado: 'Abierta'
        }
      });
      if (!cajaAbierta) {
        return res.status(400).json({
          error: 'Abra la caja antes de registrar ventas en efectivo',
          codigo: 'CAJA_CERRADA'
        });
      }
    }

    if (req.body?.metodoPago) venta.metodoPago = req.body.metodoPago;
    venta.estado = 'Pagada';
    await venta.save();

    res.json({ mensaje: 'Venta marcada como pagada exitosamente', venta });
  } catch (error) {
    console.error('[ventas] PUT /:id/pagar error:', error);
    res.status(500).json({ error: 'Error al marcar venta como pagada' });
  }
});

// 6. ANULAR Y DEVOLVER VENTA (CON RESTAURACIÓN DE STOCK EN TRANSACCIÓN)
const anularVentaHandler = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;
    const { motivoAnulacion } = req.body || {};

    if (!motivoAnulacion || !String(motivoAnulacion).trim()) {
      await t.rollback();
      return res.status(400).json({ error: 'El motivo de anulación es obligatorio.' });
    }

    const venta = await Venta.findByPk(id, {
      include: [{ model: DetalleVenta }],
      transaction: t
    });

    if (!venta) {
      await t.rollback();
      return res.status(404).json({ error: 'Venta no encontrada' });
    }

    if (venta.fechaAnulacion || venta.estado === 'Anulada') {
      await t.rollback();
      return res.status(400).json({ error: 'La venta ya se encuentra anulada.' });
    }

    // Validar que si no es admin, la venta pertenezca a la misma sede
    if (req.user && req.user.rol !== 'admin' && venta.almacenId !== req.user.almacenId) {
      await t.rollback();
      return res.status(403).json({ error: 'No puede anular ventas de otra sede' });
    }

    const detalles = venta.DetalleVentas || venta.DetalleVenta || [];

    // Reintegrar stock por cada producto en la bodega (solo si no es servicio)
    for (const d of detalles) {
      const productoId = d.productoId;
      const cantidad = Number(d.cantidad || 0);
      const almacenId = d.almacenId || venta.almacenId || 1;

      if (!productoId || cantidad <= 0) continue;

      const prod = await Producto.findByPk(productoId, { transaction: t });
      if (!prod) continue;
      const isServ = prod.tipo === 'servicio' || (prod.categoria && prod.categoria.toLowerCase().includes('servicio'));
      if (isServ) continue;

      // Reintegrar a ProductoAlmacen
      const pa = await ProductoAlmacen.findOne({
        where: { productoId, almacenId },
        transaction: t
      });

      if (pa) {
        await ProductoAlmacen.increment({ stock: cantidad }, { where: { productoId, almacenId }, transaction: t });
      } else {
        await ProductoAlmacen.create({ productoId, almacenId, stock: cantidad }, { transaction: t });
      }

      // Reintegrar a Producto global
      await Producto.increment({ stock: cantidad }, { where: { id: productoId }, transaction: t });
    }

    // Actualizar estado de la Venta
    const usuario = req.user ? (req.user.nombre || req.user.correo || 'Usuario') : 'Usuario';
    const ahora = new Date();
    const motivoLimpio = String(motivoAnulacion).trim();
    const notaAnulacion = `[ANULADA] Por ${usuario} el ${ahora.toLocaleDateString('es-CO')}. Motivo: ${motivoLimpio}`;
    venta.estado = 'Anulada';
    venta.anuladaPor = usuario;
    venta.motivoAnulacion = motivoLimpio;
    venta.fechaAnulacion = ahora;
    venta.notas = venta.notas ? `${venta.notas} | ${notaAnulacion}` : notaAnulacion;
    await venta.save({ transaction: t });

    // Actualizar factura asociada si existe
    if (venta.facturaId) {
      const factura = await Factura.findByPk(venta.facturaId, { transaction: t });
      if (factura) {
        factura.anuladaPor = usuario;
        factura.motivoAnulacion = motivoLimpio;
        factura.fechaAnulacion = ahora;
        factura.notas = factura.notas ? `${factura.notas} | ${notaAnulacion}` : notaAnulacion;
        await factura.save({ transaction: t });
      }
    }

    await t.commit();

    res.json({
      mensaje: 'Venta anulada con éxito y stock reinsertado en el inventario.',
      ventaId: venta.id
    });

  } catch (error) {
    await t.rollback();
    console.error('[ventas] Anular venta error:', error);
    res.status(500).json({ error: 'Error al anular la venta: ' + error.message });
  }
};

router.post('/:id/anular', auth, requirePermiso('ventas.anular'), anularVentaHandler);
router.post('/:id/devolver', auth, requirePermiso('ventas.anular'), anularVentaHandler);

// 7. EDITAR DATOS GENERALES DE UNA VENTA (ADMIN)
router.put('/:id', auth, requirePermiso('empresa.editar'), async (req, res) => {
  try {
    const { id } = req.params;
    const { clienteId, metodoPago, notas, estado, fecha } = req.body;

    const venta = await Venta.findByPk(id);
    if (!venta) return res.status(404).json({ error: 'Venta no encontrada' });

    if (clienteId) venta.clienteId = clienteId;
    if (metodoPago) venta.metodoPago = metodoPago;
    if (notas !== undefined) venta.notas = notas;
    if (estado) venta.estado = estado;
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
      const diaActual = obtenerDiaCol(venta.fecha);

      // Solo cambia la fecha si el día enviado es distinto al día actual del registro; si es el mismo día, conserva la hora original
      if (diaEnviado && diaActual && diaEnviado !== diaActual) {
        venta.fecha = calcularFechaVentaColombia(fecha);
      }
    }

    await venta.save();

    const ventaActualizada = await Venta.findByPk(id, {
      include: [
        { model: DetalleVenta, include: [Producto] },
        { model: Cliente },
        { model: Almacen, as: 'almacen' }
      ]
    });

    res.json(ventaActualizada);
  } catch (error) {
    console.error('[ventas] PUT /:id error:', error);
    res.status(500).json({ error: 'Error al actualizar venta' });
  }
});

// 8. ELIMINAR VENTA (PROHIBIDO POR REGLA DE NEGOCIO)
router.delete('/:id', auth, async (req, res) => {
  return res.status(403).json({ error: 'Las facturas y ventas no se eliminan; use Anular' });
});

module.exports = router;
