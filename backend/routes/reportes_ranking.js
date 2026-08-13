const express = require('express');
const router = express.Router();
const { Venta, Producto, DetalleVenta } = require('../models');
const { authToken } = require('./auth');

// Ranking de productos más vendidos
router.get('/ranking', authToken, async (req, res) => {
  try {
    // Evitar respuestas en cache (304) para que la API siempre devuelva datos frescos
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    // Agrupa por producto y suma la cantidad vendida
    // Leer filtros de almacén y vendedor
    let { almacenId, vendedor } = req.query;
    const user = req.user || {};
    if (user.rol === 'vendedor') {
      // Forzar filtro por almacén del vendedor
      almacenId = user.almacenId;
      vendedor = user.nombre;
    }
    // Filtrar DetalleVenta por ventas del almacén y vendedor
    const Venta = require('../models/Venta');
    const whereVenta = {};
    if (almacenId) whereVenta.almacenId = almacenId;
    if (vendedor) whereVenta.vendedor = vendedor;
    // Buscar los IDs de ventas que cumplen los filtros
    const ventasFiltradas = await Venta.findAll({
      where: whereVenta,
      attributes: ['id']
    });
    const ventasIds = ventasFiltradas.map(v => v.id);
    // Filtrar DetalleVenta por ventasIds
    const ranking = await DetalleVenta.findAll({
      attributes: [
        'productoId',
        [
          DetalleVenta.sequelize.fn('SUM', DetalleVenta.sequelize.col('cantidad')),
          'total_vendida'
        ]
      ],
      include: [{
        model: Producto,
        attributes: ['nombre', 'categoria', 'marca', 'modelo', 'foto', 'stock', 'tipo']
      }],
      where: ventasIds.length ? { ventaId: ventasIds } : {},
      group: ['productoId', 'Producto.id'],
      order: [[DetalleVenta.sequelize.literal('total_vendida'), 'DESC']],
      limit: 10
    });
    res.json(ranking);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener ranking de productos', details: err.message });
  }
});

module.exports = router;
