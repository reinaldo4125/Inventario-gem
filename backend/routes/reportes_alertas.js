const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const requirePermiso = require('../middleware/roles');
const { almacenDelUsuario } = require('../utils/almacenScope');

// Productos con stock bajo (alerta)
router.get('/alertas-inventario', auth, requirePermiso(['reportes.ver', 'reportes.ver_propios', 'dashboard.stock']), async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    const user = req.user || {};
    const scopedAlmacenId = almacenDelUsuario(req, res);
    if (scopedAlmacenId === undefined && user.rol !== 'admin') return;
    const targetAlmacenId = scopedAlmacenId;

    const { obtenerProductosCriticos } = require('../utils/stockCritico');
    const todasAlertas = await obtenerProductosCriticos({ almacenId: targetAlmacenId });

    if (targetAlmacenId) {
      // Filtrado para un almacén específico
      const alertas = todasAlertas.map(a => ({
        id: a.productoId,
        nombre: a.nombre,
        categoria: a.categoria,
        marca: a.marca,
        modelo: a.modelo,
        stock: a.stockSede,
        stockSede: a.stockSede,
        stockTotal: a.stockTotal,
        stock_minimo: a.stock_minimo,
        foto: a.foto,
        estado: a.estado,
        almacenId: a.almacenId,
        almacenNombre: a.almacenNombre
      }));
      return res.json(alertas);
    }

    // Visión consolidada global: consolidar por producto único mostrando stockTotal
    const mapaProductos = new Map();
    for (const a of todasAlertas) {
      if (!mapaProductos.has(a.productoId)) {
        mapaProductos.set(a.productoId, {
          id: a.productoId,
          nombre: a.nombre,
          categoria: a.categoria,
          marca: a.marca,
          modelo: a.modelo,
          stock: a.stockTotal,
          stockTotal: a.stockTotal,
          stock_minimo: a.stock_minimo,
          foto: a.foto,
          estado: a.estado
        });
      }
    }

    const alertas = Array.from(mapaProductos.values());
    res.json(alertas);
  } catch (err) {
    console.error('[reportes_alertas] error:', err);
    res.status(500).json({ error: 'Error al obtener alertas de inventario', details: err.message });
  }
});

module.exports = router;
