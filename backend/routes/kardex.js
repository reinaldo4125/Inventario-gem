const express = require('express');
const router = express.Router();
const { Kardex, Producto, Almacen, ProductoAlmacen } = require('../models');
const { authRole } = require('../middleware/auth');
const sequelize = require('../database/sequelize');

// Obtener Kardex de un producto
router.get('/producto/:id', authRole(['admin', 'vendedor']), async (req, res) => {
  try {
    const { id } = req.params;
    const movimientos = await Kardex.findAll({
      where: { productoId: id },
      include: [
        { model: Almacen, attributes: ['id', 'nombre'] },
        { model: Producto, attributes: ['id', 'nombre', 'codigo_oem'] }
      ],
      order: [['fecha', 'DESC'], ['id', 'DESC']]
    });

    res.json(movimientos);
  } catch (error) {
    console.error('Error al obtener kardex:', error);
    res.status(500).json({ error: 'Error al obtener el historial de movimientos' });
  }
});

// Registrar ajuste manual en Kardex
router.post('/ajuste', authRole(['admin']), async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { productoId, almacenId, tipo, cantidad, observaciones } = req.body;
    const usuarioNombre = req.user ? (req.user.nombre || req.user.correo) : 'Admin';

    const prod = await Producto.findByPk(productoId, { transaction: t });
    if (!prod) {
      await t.rollback();
      return res.status(404).json({ error: 'Producto no encontrado' });
    }

    const targetAlmacenId = almacenId || 1;
    let pa = await ProductoAlmacen.findOne({
      where: { productoId, almacenId: targetAlmacenId },
      transaction: t
    });

    const stockAnterior = pa ? Number(pa.stock || 0) : 0;
    const cantNum = Number(cantidad);
    const stockNuevo = tipo === 'Salida' ? (stockAnterior - cantNum) : (stockAnterior + cantNum);

    if (stockNuevo < 0) {
      await t.rollback();
      return res.status(400).json({ error: 'El stock resultante no puede ser menor a 0' });
    }

    if (!pa) {
      pa = await ProductoAlmacen.create({
        productoId,
        almacenId: targetAlmacenId,
        stock: stockNuevo,
        stock_minimo: 5
      }, { transaction: t });
    } else {
      pa.stock = stockNuevo;
      await pa.save({ transaction: t });
    }

    // Actualizar stock total en producto
    const allPa = await ProductoAlmacen.findAll({ where: { productoId }, transaction: t });
    const sumStock = allPa.reduce((acc, x) => acc + Number(x.stock || 0), 0);
    await Producto.update({ stock: sumStock }, { where: { id: productoId }, transaction: t });

    const nuevoKardex = await Kardex.create({
      productoId,
      almacenId: targetAlmacenId,
      tipo: tipo || 'Ajuste',
      origen_destino: observaciones || 'Ajuste Manual de Inventario',
      cantidad: tipo === 'Salida' ? -cantNum : cantNum,
      stock_anterior: stockAnterior,
      stock_nuevo: stockNuevo,
      usuario: usuarioNombre,
      fecha: new Date()
    }, { transaction: t });

    await t.commit();
    res.status(201).json({ mensaje: 'Ajuste de inventario registrado correctamente', kardex: nuevoKardex });
  } catch (error) {
    await t.rollback();
    console.error('Error en ajuste de kardex:', error);
    res.status(500).json({ error: 'Error al registrar el ajuste de inventario' });
  }
});

module.exports = router;
