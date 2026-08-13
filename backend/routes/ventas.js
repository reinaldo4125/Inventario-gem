const express = require('express');
const { body, validationResult } = require('express-validator');
const auth = require('../middleware/auth');
const requireRole = require('../middleware/roles');
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

// 1. OBTENER TODAS LAS VENTAS (CON FILTROS Y ESTADÍSTICAS)
router.get('/', auth, async (req, res) => {
  try {
    const usuario = req.user || {};
    const isAdmin = usuario.rol === 'admin';
    const where = {};

    // Filtros por Query Params
    const { almacenId, estado, fechaInicio, fechaFin, clienteId, vendedor, q } = req.query;

    if (almacenId) {
      where.almacenId = almacenId;
    } else if (!isAdmin && usuario.almacenId) {
      where.almacenId = usuario.almacenId;
    }

    if (!isAdmin && !usuario.almacenId && usuario.nombre) {
      where.vendedor = usuario.nombre;
    }

    if (estado && ['Pendiente', 'Pagada', 'Anulada'].includes(estado)) {
      where.estado = estado;
    }

    if (clienteId) {
      where.clienteId = clienteId;
    }

    if (vendedor) {
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

    res.json(ventas);
  } catch (error) {
    console.error('[ventas] GET / error:', error);
    res.status(500).json({ error: 'Error al obtener ventas', detalles: error.message });
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

    res.json({
      empresa,
      venta: ventaPlain
    });
  } catch (error) {
    console.error('[ventas] GET /:id/comprobante error:', error);
    res.status(500).json({ error: 'Error al generar comprobante de venta' });
  }
});

// 3. HISTORIAL DE VENTAS POR CLIENTE
router.get('/cliente/:clienteId', auth, async (req, res) => {
  try {
    const ventas = await Venta.findAll({
      where: { clienteId: req.params.clienteId },
      include: [
        { model: DetalleVenta, include: [Producto] },
        { model: Almacen, as: 'almacen', attributes: ['id', 'nombre'] }
      ],
      order: [['fecha', 'DESC']]
    });
    res.json(ventas);
  } catch (error) {
    console.error('[ventas] GET /cliente/:clienteId error:', error);
    res.status(500).json({ error: 'Error al obtener historial de compras' });
  }
});

// 4. CREAR NUEVA VENTA (CON TRANSACCIÓN ATÓMICA Y DESCUENTO DE STOCK)
router.post('/', auth, requireRole('admin', 'vendedor'), async (req, res) => {
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

    // Determinar almacén base de la venta
    const almacenBaseId = reqAlmacenId || (usuario && usuario.almacenId) || 1;

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
    if (clienteId) {
      clienteObj = await Cliente.findByPk(clienteId, { transaction: t });
    }
    if (!clienteObj && cliente) {
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

    if (!clienteObj) {
      clienteObj = await Cliente.findOne({ transaction: t });
      if (!clienteObj) {
        await t.rollback();
        return res.status(400).json({ error: 'No hay clientes registrados en el sistema.' });
      }
    }

    // Subtotal de la venta
    const subtotalBruto = detallesValidos.reduce((sum, d) => sum + (d.precio * d.cantidad), 0);
    const descPct = Number(descuento) || 0;
    const impPct = Number(impuestos) || 0;
    const montoDescuento = subtotalBruto * (descPct / 100);
    const montoImpuestos = subtotalBruto * (impPct / 100);
    const totalNeto = subtotalBruto - montoDescuento + montoImpuestos;

    // Crear Factura
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
      fecha: fecha ? new Date(fecha) : new Date()
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
      estado: esCotizacion ? 'Pendiente' : (estado || 'Pagada'),
      direccion: direccion || clienteObj.direccion || '',
      telefono: telefono || clienteObj.telefono || '',
      impuestos: impPct,
      fecha: fecha ? new Date(fecha) : new Date(),
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
router.post('/:id/convertir-factura', auth, requireRole('admin', 'vendedor'), async (req, res) => {
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

router.put('/:id/pagar', auth, requireRole('admin', 'vendedor'), async (req, res) => {
  try {
    const { id } = req.params;
    const venta = await Venta.findByPk(id);

    if (!venta) return res.status(404).json({ error: 'Venta no encontrada' });
    if (venta.estado === 'Anulada') return res.status(400).json({ error: 'No se puede marcar como pagada una venta anulada' });

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

    const venta = await Venta.findByPk(id, {
      include: [{ model: DetalleVenta }],
      transaction: t
    });

    if (!venta) {
      await t.rollback();
      return res.status(404).json({ error: 'Venta no encontrada' });
    }

    if (venta.estado === 'Anulada') {
      await t.rollback();
      return res.status(400).json({ error: 'La venta ya se encuentra anulada.' });
    }

    const detalles = venta.DetalleVentas || venta.DetalleVenta || [];

    // Reintegrar stock por cada producto en la bodega
    for (const d of detalles) {
      const productoId = d.productoId;
      const cantidad = Number(d.cantidad || 0);
      const almacenId = d.almacenId || venta.almacenId || 1;

      if (!productoId || cantidad <= 0) continue;

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
    const notaAnulacion = motivoAnulacion ? `Anulada: ${motivoAnulacion}` : 'Anulada por solicitud';
    venta.estado = 'Anulada';
    venta.notas = venta.notas ? `${venta.notas} | ${notaAnulacion}` : notaAnulacion;
    await venta.save({ transaction: t });

    // Actualizar factura asociada si existe
    if (venta.facturaId) {
      const factura = await Factura.findByPk(venta.facturaId, { transaction: t });
      if (factura) {
        factura.notas = factura.notas ? `${factura.notas} | Venta Anulada (${new Date().toLocaleDateString()})` : `Venta Anulada (${new Date().toLocaleDateString()})`;
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

router.post('/:id/anular', auth, requireRole('admin'), anularVentaHandler);
router.post('/:id/devolver', auth, requireRole('admin'), anularVentaHandler);

// 7. EDITAR DATOS GENERALES DE UNA VENTA (ADMIN)
router.put('/:id', auth, requireRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { clienteId, metodoPago, notas, estado, fecha } = req.body;

    const venta = await Venta.findByPk(id);
    if (!venta) return res.status(404).json({ error: 'Venta no encontrada' });

    if (clienteId) venta.clienteId = clienteId;
    if (metodoPago) venta.metodoPago = metodoPago;
    if (notas !== undefined) venta.notas = notas;
    if (estado) venta.estado = estado;
    if (fecha) venta.fecha = new Date(fecha);

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

// 8. ELIMINAR VENTA (ADMIN)
router.delete('/:id', auth, requireRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const venta = await Venta.findByPk(id);
    if (!venta) return res.status(404).json({ error: 'Venta no encontrada' });

    // Si la venta NO estaba anulada previamente, anularla primero para devolver stock
    if (venta.estado !== 'Anulada') {
      const detalles = await DetalleVenta.findAll({ where: { ventaId: id } });
      for (const d of detalles) {
        await ProductoAlmacen.increment({ stock: d.cantidad }, { where: { productoId: d.productoId, almacenId: d.almacenId || venta.almacenId } });
        await Producto.increment({ stock: d.cantidad }, { where: { id: d.productoId } });
      }
    }

    await DetalleVenta.destroy({ where: { ventaId: id } });
    await Venta.destroy({ where: { id } });

    res.json({ mensaje: 'Venta eliminada correctamente' });
  } catch (error) {
    console.error('[ventas] DELETE /:id error:', error);
    res.status(500).json({ error: 'Error al eliminar venta' });
  }
});

module.exports = router;
