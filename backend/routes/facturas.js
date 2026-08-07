const express = require('express');
const { body, validationResult } = require('express-validator');
const auth = require('../middleware/auth');
const requireRole = require('../middleware/roles');
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

// 1. OBTENER TODAS LAS FACTURAS (CON FILTROS Y BÚSQUEDA)
router.get('/', auth, async (req, res) => {
  try {
    const usuario = req.user || {};
    const isAdmin = usuario.rol === 'admin';
    const whereFactura = {};

    const { almacenId, estado, fechaInicio, fechaFin, q, clienteId } = req.query;

    // Filtros por Bodega
    if (almacenId && almacenId !== 'Todos') {
      whereFactura.almacenId = almacenId;
    } else if (!isAdmin && usuario.almacenId) {
      whereFactura.almacenId = usuario.almacenId;
    }

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

    // Traer facturas con detalles y relaciones
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

      const estadoVenta = venta ? venta.estado : (f.notas && f.notas.toLowerCase().includes('anulada') ? 'Anulada' : 'Pagada');
      const metodoPago = venta ? venta.metodoPago : 'Efectivo';
      const vendedor = venta ? venta.vendedor : 'Sistema';
      const almacenNombre = (f.almacen && f.almacen.nombre) || (venta && venta.almacen && venta.almacen.nombre) || 'Sede Principal';

      return {
        ...json,
        ventaId: venta ? venta.id : null,
        estadoVenta,
        metodoPago,
        vendedor,
        almacenNombre,
        productos
      };
    });

    // Aplicar filtro de estado si se solicita
    let resultadoFinal = facturasProcesadas;
    if (estado && estado !== 'Todos') {
      resultadoFinal = facturasProcesadas.filter(f => f.estadoVenta === estado);
    }

    res.json(resultadoFinal);
  } catch (error) {
    console.error('[facturas] GET / error:', error);
    res.status(500).json({ error: 'Error al obtener facturas', detalle: error.message });
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
        { model: Almacen, as: 'almacen' }
      ]
    });

    if (!factura) return res.status(404).json({ error: 'Factura no encontrada' });

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

    res.json({
      factura,
      venta,
      empresa
    });
  } catch (error) {
    console.error('[facturas] GET /:id error:', error);
    res.status(500).json({ error: 'Error al consultar la factura' });
  }
});

// 3. CREAR UNA FACTURA NUEVA (CON TRANSACCIÓN Y DESCUENTO DE INVENTARIO)
router.post('/', auth, requireRole('admin', 'vendedor'), [
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
    const almacenBaseId = almacenId || (usuario && usuario.almacenId) || 1;

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
      fecha: fecha ? new Date(fecha) : new Date()
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

      // 3. Registrar Venta correspondiente
      const venta = await Venta.create({
        total: Number(total) || 0,
        clienteId: clienteId || 1,
        metodoPago: metodoPago || 'Efectivo',
        descuento: Number(descuento) || 0,
        impuestos: Number(impuestos) || 0,
        notas: notas || '',
        vendedor: vendedor || usuario.nombre || 'Sistema',
        estado: 'Pagada',
        direccion: direccion || '',
        telefono: telefono || '',
        fecha: fecha ? new Date(fecha) : new Date(),
        facturaId: factura.id,
        almacenId: almacenBaseId
      }, { transaction: t });

      // Registrar DetalleVenta
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

// 4. EDITAR UNA FACTURA EXISTENTE (ADMIN)
router.put('/:id', auth, requireRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { cliente, documento, direccion, telefono, correo, notas, total, fecha } = req.body;

    const factura = await Factura.findByPk(id);
    if (!factura) return res.status(404).json({ error: 'Factura no encontrada' });

    if (cliente) factura.cliente = cliente;
    if (documento !== undefined) factura.documento = documento;
    if (direccion !== undefined) factura.direccion = direccion;
    if (telefono !== undefined) factura.telefono = telefono;
    if (correo !== undefined) factura.correo = correo;
    if (notas !== undefined) factura.notas = notas;
    if (total !== undefined) factura.total = total;
    if (fecha) factura.fecha = new Date(fecha);

    await factura.save();

    res.json({ mensaje: 'Factura actualizada exitosamente', factura });
  } catch (error) {
    console.error('[facturas] PUT /:id error:', error);
    res.status(500).json({ error: 'Error al actualizar factura' });
  }
});

// 5. ANULAR FACTURA Y DEVOLVER INVENTARIO A LA BODEGA
router.post('/:id/anular', auth, requireRole('admin'), async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;
    const { motivoAnulacion } = req.body || {};

    const factura = await Factura.findByPk(id, {
      include: [{ model: DetalleFactura, as: 'DetalleFacturas' }],
      transaction: t
    });

    if (!factura) {
      await t.rollback();
      return res.status(404).json({ error: 'Factura no encontrada' });
    }

    if (factura.notas && factura.notas.includes('[ANULADA]')) {
      await t.rollback();
      return res.status(400).json({ error: 'La factura ya se encuentra anulada.' });
    }

    // Reintegrar productos de la factura al inventario de la bodega
    const detalles = factura.DetalleFacturas || [];
    for (const d of detalles) {
      const prodId = d.productoId;
      const cant = Number(d.cantidad || 0);
      const almId = factura.almacenId || 1;

      if (!prodId || cant <= 0) continue;

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

    // Actualizar notas de la Factura indicando la anulación
    const usuario = req.user ? (req.user.nombre || req.user.correo || 'admin') : 'admin';
    const motivoText = motivoAnulacion ? ` Motivo: ${motivoAnulacion}` : '';
    const marcaAnulada = `[ANULADA] Por ${usuario} el ${new Date().toLocaleDateString()}.${motivoText}`;
    
    factura.notas = factura.notas ? `${factura.notas} | ${marcaAnulada}` : marcaAnulada;
    await factura.save({ transaction: t });

    // Anular venta asociada si existe
    const venta = await Venta.findOne({ where: { facturaId: id }, transaction: t });
    if (venta) {
      venta.estado = 'Anulada';
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

// 6. ELIMINAR FACTURA (ADMIN)
router.delete('/:id', auth, requireRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const factura = await Factura.findByPk(id);
    if (!factura) return res.status(404).json({ error: 'Factura no encontrada' });

    await DetalleFactura.destroy({ where: { facturaId: id } });
    await Factura.destroy({ where: { id } });

    res.json({ mensaje: 'Factura eliminada correctamente' });
  } catch (error) {
    console.error('[facturas] DELETE /:id error:', error);
    res.status(500).json({ error: 'Error al eliminar la factura' });
  }
});

module.exports = router;
