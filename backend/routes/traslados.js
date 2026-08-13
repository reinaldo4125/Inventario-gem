const express = require('express');
const router = express.Router();
const { Traslado, DetalleTraslado, Producto, ProductoAlmacen, Almacen, Kardex } = require('../models');
const { authRole } = require('../middleware/auth');
const sequelize = require('../database/sequelize');

// Listar todos los traslados
router.get('/', authRole(['admin', 'vendedor']), async (req, res) => {
  try {
    const traslados = await Traslado.findAll({
      include: [
        { model: Almacen, as: 'almacenOrigen', attributes: ['id', 'nombre'] },
        { model: Almacen, as: 'almacenDestino', attributes: ['id', 'nombre'] },
        { 
          model: DetalleTraslado, 
          as: 'detalles',
          include: [{ model: Producto, attributes: ['id', 'nombre', 'codigo_oem', 'marca'] }]
        }
      ],
      order: [['fecha', 'DESC']]
    });
    res.json(traslados);
  } catch (error) {
    console.error('Error al obtener traslados:', error);
    res.status(500).json({ error: 'Error al obtener la lista de traslados' });
  }
});

// Crear un traslado entre bodegas
router.post('/', authRole(['admin', 'vendedor']), async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { almacenOrigenId, almacenDestinoId, observaciones, items } = req.body;
    const usuarioNombre = req.user ? (req.user.nombre || req.user.correo) : 'Usuario';

    if (!almacenOrigenId || !almacenDestinoId) {
      await t.rollback();
      return res.status(400).json({ error: 'Debe especificar el almacén de origen y de destino' });
    }

    if (Number(almacenOrigenId) === Number(almacenDestinoId)) {
      await t.rollback();
      return res.status(400).json({ error: 'El almacén de origen y destino no pueden ser el mismo' });
    }

    if (!Array.isArray(items) || items.length === 0) {
      await t.rollback();
      return res.status(400).json({ error: 'Debe agregar al menos un producto al traslado' });
    }

    // Verificar existencias en bodega de origen
    for (const item of items) {
      const prod = await Producto.findByPk(item.productoId, { transaction: t });
      if (!prod) {
        await t.rollback();
        return res.status(404).json({ error: `Producto ID ${item.productoId} no encontrado` });
      }

      const isServ = prod.tipo === 'servicio' || (prod.categoria && prod.categoria.toLowerCase().includes('servicio'));
      if (isServ) {
        await t.rollback();
        return res.status(400).json({ error: `El item "${prod.nombre}" es un servicio y no requiere traslados de inventario.` });
      }

      let paOrigen = await ProductoAlmacen.findOne({
        where: { productoId: item.productoId, almacenId: almacenOrigenId },
        transaction: t
      });

      const stockOrigenActual = paOrigen ? Number(paOrigen.stock || 0) : 0;
      if (stockOrigenActual < Number(item.cantidad)) {
        await t.rollback();
        return res.status(400).json({
          error: `Stock insuficiente para "${prod.nombre}" en almacén origen. Disponible: ${stockOrigenActual}, requerido: ${item.cantidad}`
        });
      }
    }

    // Crear registro principal de traslado
    const nuevoTraslado = await Traslado.create({
      almacenOrigenId,
      almacenDestinoId,
      usuarioNombre,
      observaciones,
      fecha: new Date(),
      estado: 'Completado'
    }, { transaction: t });

    const origenObj = await Almacen.findByPk(almacenOrigenId, { transaction: t });
    const destinoObj = await Almacen.findByPk(almacenDestinoId, { transaction: t });
    const origenNombre = origenObj ? origenObj.nombre : `Bodega #${almacenOrigenId}`;
    const destinoNombre = destinoObj ? destinoObj.nombre : `Bodega #${almacenDestinoId}`;

    // Procesar cada ítem
    for (const item of items) {
      const cant = Number(item.cantidad);
      await DetalleTraslado.create({
        trasladoId: nuevoTraslado.id,
        productoId: item.productoId,
        cantidad: cant
      }, { transaction: t });

      // Descontar origen
      let paOrigen = await ProductoAlmacen.findOne({
        where: { productoId: item.productoId, almacenId: almacenOrigenId },
        transaction: t
      });
      const stockOrigenAntes = paOrigen ? Number(paOrigen.stock || 0) : 0;
      const stockOrigenNuevo = stockOrigenAntes - cant;
      paOrigen.stock = stockOrigenNuevo;
      await paOrigen.save({ transaction: t });

      // Incrementar destino
      let paDestino = await ProductoAlmacen.findOne({
        where: { productoId: item.productoId, almacenId: almacenDestinoId },
        transaction: t
      });
      let stockDestinoAntes = 0;
      if (!paDestino) {
        paDestino = await ProductoAlmacen.create({
          productoId: item.productoId,
          almacenId: almacenDestinoId,
          stock: cant,
          stock_minimo: 5
        }, { transaction: t });
      } else {
        stockDestinoAntes = Number(paDestino.stock || 0);
        paDestino.stock = stockDestinoAntes + cant;
        await paDestino.save({ transaction: t });
      }

      // Recalcular stock global del producto
      const allPa = await ProductoAlmacen.findAll({ where: { productoId: item.productoId }, transaction: t });
      const sumStock = allPa.reduce((acc, x) => acc + Number(x.stock || 0), 0);
      await Producto.update({ stock: sumStock }, { where: { id: item.productoId }, transaction: t });

      // Registrar en Kardex
      await Kardex.create({
        productoId: item.productoId,
        almacenId: almacenOrigenId,
        tipo: 'Traslado (Salida)',
        origen_destino: `Traslado a ${destinoNombre} (Doc #${nuevoTraslado.id})`,
        cantidad: -cant,
        stock_anterior: stockOrigenAntes,
        stock_nuevo: stockOrigenNuevo,
        usuario: usuarioNombre,
        fecha: new Date(),
        referencia_id: nuevoTraslado.id
      }, { transaction: t });

      await Kardex.create({
        productoId: item.productoId,
        almacenId: almacenDestinoId,
        tipo: 'Traslado (Entrada)',
        origen_destino: `Traslado desde ${origenNombre} (Doc #${nuevoTraslado.id})`,
        cantidad: cant,
        stock_anterior: stockDestinoAntes,
        stock_nuevo: stockDestinoAntes + cant,
        usuario: usuarioNombre,
        fecha: new Date(),
        referencia_id: nuevoTraslado.id
      }, { transaction: t });
    }

    await t.commit();
    res.status(201).json({ mensaje: 'Traslado realizado con éxito', traslado: nuevoTraslado });
  } catch (error) {
    await t.rollback();
    console.error('Error al realizar traslado:', error);
    res.status(500).json({ error: 'Error al procesar el traslado entre almacenes: ' + (error.message || error) });
  }
});

module.exports = router;
