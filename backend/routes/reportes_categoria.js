const express = require('express');
const router = express.Router();
const Venta = require('../models/Venta');
const Producto = require('../models/Producto');
const { authToken } = require('./auth');

// Reporte: Ventas por categoría de producto
const DetalleVenta = require('../models/DetalleVenta');
router.get('/ventas-por-categoria', authToken, async (req, res) => {
  try {
    // Evitar respuestas en cache (304) para que la API siempre devuelva datos frescos
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    // Si el usuario es vendedor, forzar filtro por su almacén o nombre
    const user = req.user || {};
    const whereVenta = {};
    if (user.rol === 'vendedor') {
      if (user.almacenId) whereVenta.almacenId = user.almacenId;
      if (user.nombre) whereVenta.vendedor = user.nombre;
    } else {
      // Admin puede pasar ?almacenId= to filter
      if (req.query.almacenId) whereVenta.almacenId = req.query.almacenId;
      if (req.query.vendedor) whereVenta.vendedor = req.query.vendedor;
    }

    // Traer detalles de venta incluyendo Venta con whereVenta y Producto
    // Traer detalles y ventas relacionados para poder aplicar descuentos de la venta
    let detalles = await DetalleVenta.findAll({
      include: [
        { model: Producto, attributes: ['categoria'] },
        { model: Venta, where: Object.keys(whereVenta).length ? whereVenta : undefined, attributes: ['id', 'total', 'descuento'] }
      ]
    });

    // Si no se encontraron detalles (posible efecto del include+where), intentar fallback:
    if (!detalles || detalles.length === 0) {
      console.log('>>> [ventas-por-categoria] primeros detalles: 0 encontrados — intentando fallback por ventas filtradas');
      const ventasFiltradas = await Venta.findAll({ where: Object.keys(whereVenta).length ? whereVenta : {}, attributes: ['id'] });
      const ventasIds = ventasFiltradas.map(v => v.id);
      console.log('>>> [ventas-por-categoria] ventas filtradas ids:', ventasIds);
      if (ventasIds.length) {
        detalles = await DetalleVenta.findAll({
          where: { ventaId: ventasIds },
          include: [ { model: Producto, attributes: ['categoria'] }, { model: Venta, attributes: ['id', 'total', 'descuento'] } ]
        });
        console.log('>>> [ventas-por-categoria] detalles obtenidos tras fallback:', detalles.length);
      }
    } else {
      console.log('>>> [ventas-por-categoria] detalles encontrados:', detalles.length);
    }

    // Helper: extraer la venta incluida (sequelize a veces usa otro alias, ej. Ventum)
    const getVentaFromDetalle = (dv) => {
      if (!dv) return null;
      if (dv.Venta) return dv.Venta;
      if (dv.Ventum) return dv.Ventum;
      // fallback: buscar en dataValues
      const dvVals = dv.dataValues || {};
      if (dvVals.Venta) return dvVals.Venta;
      if (dvVals.Ventum) return dvVals.Ventum;
      return null;
    };

    // Agrupar por venta para calcular el subtotal por venta (para distribuir descuento proporcionalmente)
    const ventasMap = {}; // ventaId -> { subtotal: number, descuentoPct: number }
    detalles.forEach(dv => {
      const v = getVentaFromDetalle(dv);
      if (!v) return; // skip if no venta
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
      // Calcular el descuento proporcional basado en el % de la venta
      const descuentoPct = ventaInfo.descuentoPct || 0;
      const descuentoLinea = (descuentoPct / 100) * lineTotal;
      const netoLinea = lineTotal - descuentoLinea;
      if (!Number.isFinite(netoLinea)) return; // protege contra NaN
      if (!resumen[categoria]) resumen[categoria] = 0;
      resumen[categoria] += netoLinea;
    });
    // Logear algunos pares categoría:valor para diagnóstico rápido
    const sample = Object.entries(resumen).slice(0,3);
    console.log('>>> [ventas-por-categoria] sample resumen:', sample);
  console.log('>>> [ventas-por-categoria] resumen keys:', Object.keys(resumen));
  res.json(resumen);
  } catch (error) {
    console.error('[ventas-por-categoria] Error:', error);
    res.status(500).json({ error: 'Error al generar reporte por categoría', details: error.message });
  }
});

module.exports = router;
