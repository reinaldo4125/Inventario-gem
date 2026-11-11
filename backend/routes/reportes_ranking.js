const express = require('express');
const router = express.Router();
const { Venta, Producto, DetalleVenta } = require('../models');
const auth = require('../middleware/auth');
const requirePermiso = require('../middleware/roles');
const { almacenDelUsuario } = require('../utils/almacenScope');

// Ranking de productos más vendidos
router.get('/ranking', auth, requirePermiso(['reportes.ver', 'reportes.ver_propios']), async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    const user = req.user || {};
    const scopedAlmacenId = almacenDelUsuario(req, res);
    if (scopedAlmacenId === undefined && user.rol !== 'admin') return;

    const whereVenta = { estado: 'Pagada' };
    if (scopedAlmacenId) {
      whereVenta.almacenId = scopedAlmacenId;
    }
    if (user.rol === 'vendedor') {
      whereVenta.vendedor = user.nombre;
    } else if (req.query.vendedor) {
      whereVenta.vendedor = req.query.vendedor;
    }

    // Buscar los IDs de ventas que cumplen los filtros
    const ventasFiltradas = await Venta.findAll({
      where: whereVenta,
      attributes: ['id']
    });
    const ventasIds = ventasFiltradas.map(v => v.id);

    // Si no hay ventas que cumplan los filtros, retornar lista vacía
    if (ventasIds.length === 0) {
      return res.json([]);
    }

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
      where: { ventaId: ventasIds },
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
