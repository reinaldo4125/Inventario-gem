const express = require('express');
const router = express.Router();
const Venta = require('../models/Venta');
const Producto = require('../models/Producto');
const DetalleVenta = require('../models/DetalleVenta');
const auth = require('../middleware/auth');
const requirePermiso = require('../middleware/roles');
const { almacenDelUsuario } = require('../utils/almacenScope');

// Reporte: Ventas por categoría de producto
router.get('/ventas-por-categoria', auth, requirePermiso(['reportes.ver', 'reportes.ver_propios']), async (req, res) => {
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

    // Traer detalles de venta incluyendo Venta con whereVenta y Producto
    let detalles = await DetalleVenta.findAll({
      include: [
        { model: Producto, attributes: ['categoria'] },
        { model: Venta, where: whereVenta, attributes: ['id', 'total', 'descuento'] }
      ]
    });

    // Fallback si no se encontraron detalles
    if (!detalles || detalles.length === 0) {
      const ventasFiltradas = await Venta.findAll({ where: whereVenta, attributes: ['id'] });
      const ventasIds = ventasFiltradas.map(v => v.id);
      if (ventasIds.length) {
        detalles = await DetalleVenta.findAll({
          where: { ventaId: ventasIds },
          include: [ { model: Producto, attributes: ['categoria'] }, { model: Venta, attributes: ['id', 'total', 'descuento'] } ]
        });
      }
    }

    const getVentaFromDetalle = (dv) => {
      if (!dv) return null;
      if (dv.Venta) return dv.Venta;
      if (dv.Ventum) return dv.Ventum;
      const dvVals = dv.dataValues || {};
      if (dvVals.Venta) return dvVals.Venta;
      if (dvVals.Ventum) return dvVals.Ventum;
      return null;
    };

    const ventasMap = {};
    detalles.forEach(dv => {
      const v = getVentaFromDetalle(dv);
      if (!v) return;
      const ventaId = v.id;
      if (!ventasMap[ventaId]) ventasMap[ventaId] = { subtotal: 0, descuentoPct: parseFloat(v.descuento) || 0 };
      const precio = parseFloat(dv.precio_unitario) || 0;
      const cantidad = Number(dv.cantidad) || 0;
      ventasMap[ventaId].subtotal += precio * cantidad;
    });

    const resumen = {};
    detalles.forEach(dv => {
      let categoria = dv.Producto ? dv.Producto.categoria : null;
      if (!categoria) categoria = 'Sin categoría';
      const v = getVentaFromDetalle(dv);
      if (!v) return;
      const ventaInfo = ventasMap[v.id] || { subtotal: 0, descuentoPct: 0 };
      const precio = parseFloat(dv.precio_unitario) || 0;
      const cantidad = Number(dv.cantidad) || 0;
      const lineTotal = precio * cantidad;
      const descuentoPct = ventaInfo.descuentoPct || 0;
      const descuentoLinea = (descuentoPct / 100) * lineTotal;
      const netoLinea = lineTotal - descuentoLinea;
      if (!Number.isFinite(netoLinea)) return;
      if (!resumen[categoria]) resumen[categoria] = 0;
      resumen[categoria] += netoLinea;
    });

    res.json(resumen);
  } catch (error) {
    console.error('[ventas-por-categoria] Error:', error);
    res.status(500).json({ error: 'Error al generar reporte por categoría', details: error.message });
  }
});

module.exports = router;
