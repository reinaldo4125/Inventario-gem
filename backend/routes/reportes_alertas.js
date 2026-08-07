const express = require('express');
const router = express.Router();
const { Producto } = require('../models');
const { Op } = require('sequelize');
const { authToken } = require('./auth');

// Productos con stock bajo (alerta)
router.get('/alertas-inventario', authToken, async (req, res) => {
  try {
    // Evitar respuestas en cache (304) para que la API siempre devuelva datos frescos
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    const user = req.user || {};
    const reqAlmacenId = req.query.almacenId ? parseInt(req.query.almacenId, 10) : null;
    const userAlmacenId = user.rol === 'vendedor' ? user.almacenId : null;
    const targetAlmacenId = reqAlmacenId || userAlmacenId;

    const ProductoAlmacen = require('../models/ProductoAlmacen');
    const Almacen = require('../models/Almacen');

    if (targetAlmacenId) {
      // Filtrar alertas para un almacén específico
      const results = await ProductoAlmacen.findAll({
        where: { almacenId: targetAlmacenId },
        include: [{
          model: Producto,
          where: {}
        }]
      });

      const alertas = results
        .filter(r => {
          const p = r.Producto;
          if (!p) return false;
          const isServicio = p.tipo === 'servicio' || (p.categoria && p.categoria.toLowerCase().includes('servicio'));
          if (isServicio) return false;
          const minStock = (p.stock_minimo !== undefined && p.stock_minimo !== null && p.stock_minimo !== '') ? Number(p.stock_minimo) : 5;
          const st = Number(r.stock || 0);
          return st <= minStock || st <= 0;
        })
        .map(r => ({
          id: r.Producto.id,
          nombre: r.Producto.nombre,
          categoria: r.Producto.categoria,
          marca: r.Producto.marca,
          modelo: r.Producto.modelo,
          stock: Number(r.stock || 0),
          stock_minimo: (r.Producto.stock_minimo !== undefined && r.Producto.stock_minimo !== null && r.Producto.stock_minimo !== '') ? Number(r.Producto.stock_minimo) : 5,
          foto: r.Producto.foto
        }));

      return res.json(alertas);
    }

    // Visión consolidada global (Admin o sin filtro de almacén)
    const productos = await Producto.findAll({
      where: {},
      include: [{
        model: Almacen,
        as: 'almacenes',
        through: { attributes: ['stock'] }
      }]
    });

    const alertas = [];

    for (const p of productos) {
      const isServicio = p.tipo === 'servicio' || (p.categoria && p.categoria.toLowerCase().includes('servicio'));
      if (isServicio) continue;

      const almacenesList = p.almacenes || [];
      let totalStock = 0;

      if (almacenesList.length > 0) {
        totalStock = almacenesList.reduce((sum, a) => sum + (a.ProductoAlmacen ? Number(a.ProductoAlmacen.stock || 0) : 0), 0);
      } else {
        totalStock = Number(p.stock || 0);
      }

      // Sincronizar columna stock en productos si estaba desalineada
      if (p.stock !== totalStock) {
        p.stock = totalStock;
        await p.save().catch(() => {});
      }

      const minStock = (p.stock_minimo !== undefined && p.stock_minimo !== null && p.stock_minimo !== '') ? Number(p.stock_minimo) : 5;

      if (totalStock <= minStock || totalStock <= 0) {
        alertas.push({
          id: p.id,
          nombre: p.nombre,
          categoria: p.categoria,
          marca: p.marca,
          modelo: p.modelo,
          stock: totalStock,
          stock_minimo: minStock,
          foto: p.foto
        });
      }
    }

    res.json(alertas);
  } catch (err) {
    console.error('[reportes_alertas] error:', err);
    res.status(500).json({ error: 'Error al obtener alertas de inventario', details: err.message });
  }
});

module.exports = router;

