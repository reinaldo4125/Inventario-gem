
const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const Venta = require('../models/Venta');
const Cliente = require('../models/Cliente');
const DetalleVenta = require('../models/DetalleVenta');
const sequelize = require('../database/sequelize');
const Producto = require('../models/Producto');
const { authRole, authToken } = require('./auth');

// Reporte: ganancia por producto por almacén (monto y %)
router.get('/ganancia-producto', authRole(['admin']), async (req, res) => {
  try {
    // Evitar respuestas en cache (304) para que la API siempre devuelva datos frescos
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    const { desde, hasta, almacenId, productoId } = req.query;
    // pagination / sorting / export
    const page = parseInt(req.query.page) || 1;
    const pageSize = Math.min(parseInt(req.query.pageSize) || 10, 500);
    const sortKey = req.query.sortKey || '';
    const sortDir = (req.query.sortDir || 'asc').toLowerCase() === 'desc' ? 'DESC' : 'ASC';
    const exportAll = req.query.export === '1' || req.query.export === 'true';

    const replacements = {
      desde: desde ? new Date(desde) : null,
      hasta: hasta ? new Date(hasta) : null,
      almacenId: almacenId ? parseInt(almacenId) : null,
      productoId: productoId ? parseInt(productoId) : null,
      limit: pageSize,
      offset: (page - 1) * pageSize
    };

    const innerSql = `SELECT
      dv.productoId AS productoId,
      p.nombre AS productoNombre,
      v.almacenId AS almacenId,
      a.nombre AS almacenNombre,
  SUM(dv.cantidad) AS cantidad_total,
  SUM(dv.cantidad * dv.precio_unitario) AS ventas_total,
  -- total neto aplicando descuento porcentual de la venta (venta.descuento)
  SUM(dv.cantidad * dv.precio_unitario * (1 - COALESCE(v.descuento,0)/100)) AS ventas_total_neto,
      -- intentar obtener costo desde tabla producto_costos por fecha/almacen; si no hay, usar p.costo o p.precio
      SUM(dv.cantidad * COALESCE(
        (
          SELECT pc.costo FROM producto_costos pc
          WHERE pc.productoId = p.id
            AND (pc.almacenId IS NULL OR pc.almacenId = v.almacenId)
            AND v.fecha BETWEEN pc.fecha_inicio AND COALESCE(pc.fecha_fin, '9999-12-31')
          ORDER BY (pc.almacenId IS NOT NULL) DESC, pc.fecha_inicio DESC
          LIMIT 1
        ),
        CASE WHEN p.costo IS NULL OR p.costo = 0 THEN p.precio ELSE p.costo END
      )) AS costo_total,
      -- ganancias calculadas sobre el total neto (ventas_total_neto) menos el costo_total
      SUM(dv.cantidad * dv.precio_unitario * (1 - COALESCE(v.descuento,0)/100)) - SUM(dv.cantidad * COALESCE((
        SELECT pc.costo FROM producto_costos pc
          WHERE pc.productoId = p.id
            AND (pc.almacenId IS NULL OR pc.almacenId = v.almacenId)
            AND v.fecha BETWEEN pc.fecha_inicio AND COALESCE(pc.fecha_fin, '9999-12-31')
          ORDER BY (pc.almacenId IS NOT NULL) DESC, pc.fecha_inicio DESC
          LIMIT 1
      ), CASE WHEN p.costo IS NULL OR p.costo = 0 THEN p.precio ELSE p.costo END)) AS ganancia_monetaria,
      CASE WHEN SUM(dv.cantidad * COALESCE((
        SELECT pc.costo FROM producto_costos pc
          WHERE pc.productoId = p.id
            AND (pc.almacenId IS NULL OR pc.almacenId = v.almacenId)
            AND v.fecha BETWEEN pc.fecha_inicio AND COALESCE(pc.fecha_fin, '9999-12-31')
          ORDER BY (pc.almacenId IS NOT NULL) DESC, pc.fecha_inicio DESC
          LIMIT 1
      ), CASE WHEN p.costo IS NULL OR p.costo = 0 THEN p.precio ELSE p.costo END)) = 0 THEN NULL
        ELSE 100 * (SUM(dv.cantidad * dv.precio_unitario * (1 - COALESCE(v.descuento,0)/100)) - SUM(dv.cantidad * COALESCE((
          SELECT pc.costo FROM producto_costos pc
            WHERE pc.productoId = p.id
              AND (pc.almacenId IS NULL OR pc.almacenId = v.almacenId)
              AND v.fecha BETWEEN pc.fecha_inicio AND COALESCE(pc.fecha_fin, '9999-12-31')
            ORDER BY (pc.almacenId IS NOT NULL) DESC, pc.fecha_inicio DESC
            LIMIT 1
        ), CASE WHEN p.costo IS NULL OR p.costo = 0 THEN p.precio ELSE p.costo END))) / SUM(dv.cantidad * COALESCE((
          SELECT pc.costo FROM producto_costos pc
            WHERE pc.productoId = p.id
              AND (pc.almacenId IS NULL OR pc.almacenId = v.almacenId)
              AND v.fecha BETWEEN pc.fecha_inicio AND COALESCE(pc.fecha_fin, '9999-12-31')
            ORDER BY (pc.almacenId IS NOT NULL) DESC, pc.fecha_inicio DESC
            LIMIT 1
        ), CASE WHEN p.costo IS NULL OR p.costo = 0 THEN p.precio ELSE p.costo END))
      END AS ganancia_pct
  FROM detalle_ventas dv
  JOIN ventas v ON dv.ventaId = v.id
  JOIN productos p ON dv.productoId = p.id
  LEFT JOIN almacenes a ON v.almacenId = a.id
    WHERE (:desde IS NULL OR v.fecha >= :desde)
      AND (:hasta IS NULL OR v.fecha <= :hasta)
      AND (:almacenId IS NULL OR v.almacenId = :almacenId)
      AND (:productoId IS NULL OR dv.productoId = :productoId)
    GROUP BY dv.productoId, v.almacenId
    ORDER BY p.nombre, v.almacenId`;

    // Allowed sort columns (must match aliases from inner query)
    const allowedSort = new Set(['productoNombre','almacenNombre','cantidad_total','ventas_total','ventas_total_neto','costo_total','ganancia_monetaria','ganancia_pct']);
    let orderClause = 'ORDER BY productoNombre, almacenId';
    if (sortKey && allowedSort.has(sortKey)) {
      orderClause = `ORDER BY ${sortKey} ${sortDir}`;
    }

    // Count total rows (for pagination)
    const countSql = `SELECT COUNT(*) as total_count FROM (${innerSql}) AS t`;
    const countResult = await sequelize.query(countSql, { replacements, type: sequelize.QueryTypes.SELECT });
    const totalCount = countResult && countResult[0] ? parseInt(countResult[0].total_count) : 0;

    // Build final SQL with ordering and optional pagination
    let finalSql = `SELECT * FROM (${innerSql}) AS t ${orderClause}`;
    if (!exportAll) {
      finalSql += ` LIMIT :limit OFFSET :offset`;
    }

    const rows = await sequelize.query(finalSql, { replacements, type: sequelize.QueryTypes.SELECT });
    // Debug: mostrar muestra de filas para verificar que ventas_total_neto está presente
    try {
      console.log('>>> [ganancia-producto] filas ejemplo:', JSON.stringify(rows.slice(0,10), null, 2));
    } catch (e) {
      console.log('>>> [ganancia-producto] Error al serializar rows para debug', e && e.message);
    }
    res.json({ rows, total: totalCount });
  } catch (error) {
    console.error('[ganancia-producto] Error:', error);
    res.status(500).json({ error: 'Error al generar reporte de ganancia por producto' });
  }
});

// Ventas pendientes vs facturadas por día
router.get('/ventas-pendientes-vs-facturadas', authToken, async (req, res) => {
  try {
    const { desde, hasta, vendedor, cliente } = req.query;
    // respetar rol: vendedores solo verán su almacén
    const user = req.user || {};
    let almacenId = req.query.almacenId;
    if (user.rol === 'vendedor') {
      almacenId = user.almacenId;
    }
    const where = {};
    if (desde || hasta) {
      where.fecha = {};
      if (desde) where.fecha[Op.gte] = new Date(desde);
      if (hasta) where.fecha[Op.lte] = new Date(hasta);
    }
    if (almacenId) where.almacenId = almacenId;
    // aplicar filtro por vendedor/cliente cuando sean provistos (admin)
    if (user.rol !== 'vendedor') {
      if (vendedor) where.vendedor = vendedor;
      if (cliente) where.clienteId = cliente;
    }

    // Agrupar por fecha y estado
    const result = await Venta.findAll({
      where,
      attributes: [
        [Venta.sequelize.fn('DATE', Venta.sequelize.col('fecha')), 'dia'],
        'estado',
        [Venta.sequelize.fn('COUNT', Venta.sequelize.col('id')), 'cantidad']
      ],
      group: [Venta.sequelize.fn('DATE', Venta.sequelize.col('fecha')), 'estado'],
      order: [[Venta.sequelize.fn('DATE', Venta.sequelize.col('fecha')), 'ASC']]
    });

    // Formatear para frontend: { dia: { Pendiente: n, Pagada: n } }
    const resumen = {};
    result.forEach(r => {
      const dia = r.get('dia');
      const estado = r.get('estado');
      const cantidad = parseInt(r.get('cantidad'));
      if (!resumen[dia]) resumen[dia] = { Pendiente: 0, Pagada: 0 };
      if (estado === 'Pendiente' || estado === 'Pagada') {
        resumen[dia][estado] = cantidad;
      }
    });
    res.json(resumen);
  } catch (error) {
    res.status(500).json({ error: 'Error al generar reporte de pendientes vs facturadas' });
  }
});

// Ventas agrupadas por tipo de cliente
router.get('/ventas-por-tipo-cliente', authToken, async (req, res) => {
  try {
    const user = req.user || {};
    const where = {};
    let almacenId = req.query.almacenId;
    if (user.rol === 'vendedor') almacenId = user.almacenId;
    if (almacenId) where.almacenId = almacenId;
    const ventas = await Venta.findAll({
      where,
      include: [{ model: Cliente, attributes: ['tipo_cliente'] }]
    });
    const resumen = {};
    ventas.forEach(v => {
      const tipo = v.Cliente ? v.Cliente.tipo_cliente : 'Desconocido';
      if (!resumen[tipo]) resumen[tipo] = { total: 0, cantidad: 0 };
      // Aplicar descuento de la venta (venta.descuento es porcentaje)
      const totalVenta = parseFloat(v.total) || 0;
      const descuentoPct = parseFloat(v.descuento) || 0;
      const neto = totalVenta - (descuentoPct / 100) * totalVenta;
      resumen[tipo].total += neto;
      resumen[tipo].cantidad++;
    });
    res.json(resumen);
  } catch (error) {
    res.status(500).json({ error: 'Error al generar reporte por tipo de cliente' });
  }
});


// Reporte avanzado: Ventas agrupadas y filtradas
router.get('/ventas-agrupadas', authToken, async (req, res) => {
  try {
    const { desde, hasta, tipo_cliente, vendedor: vendedorQuery, producto, agrupacion } = req.query;
    const user = req.user || {};
    const whereVenta = { estado: 'Pagada' };
    if (desde || hasta) {
      whereVenta.fecha = {};
      if (desde) whereVenta.fecha[Op.gte] = new Date(desde);
      if (hasta) whereVenta.fecha[Op.lte] = new Date(hasta);
    }
    // Si es vendedor, forzar filtro: preferir almacenId, si no usar vendedor
    if (user.rol === 'vendedor') {
      if (user.almacenId) {
        whereVenta.almacenId = user.almacenId;
      } else if (user.nombre) {
        whereVenta.vendedor = user.nombre;
      }
    } else {
      // Admin u otros roles pueden pasar filtros
      if (vendedorQuery) whereVenta.vendedor = vendedorQuery;
      if (req.query.almacenId) whereVenta.almacenId = req.query.almacenId;
    }

    // Para tipo_cliente, se filtra en include

    // Agrupación SQL
    let group = [];
    let attributes = [];
    let include = [];
    let model = Venta;
    let raw = true;

  if (agrupacion === 'mes') {
      const isSqlite = Venta.sequelize.getDialect() === 'sqlite';
      const monthFn = isSqlite
        ? Venta.sequelize.fn('strftime', '%Y-%m', Venta.sequelize.col('fecha'))
        : Venta.sequelize.fn('DATE_FORMAT', Venta.sequelize.col('fecha'), '%Y-%m');
      attributes = [
        [monthFn, 'mes'],
        [Venta.sequelize.fn('SUM', Venta.sequelize.col('total')), 'total'],
        [Venta.sequelize.fn('COUNT', Venta.sequelize.col('id')), 'cantidad']
      ];
      group = [monthFn];
    } else if (agrupacion === 'almacen') {
      attributes = [
        'almacenId',
        [Venta.sequelize.fn('SUM', Venta.sequelize.col('total')), 'total'],
        [Venta.sequelize.fn('COUNT', Venta.sequelize.col('id')), 'cantidad']
      ];
      group = ['almacenId'];
    } else if (agrupacion === 'vendedor') {
      attributes = [
        'vendedor',
        [Venta.sequelize.fn('SUM', Venta.sequelize.col('total')), 'total'],
        [Venta.sequelize.fn('COUNT', Venta.sequelize.col('id')), 'cantidad']
      ];
      group = ['vendedor'];
    } else if (agrupacion === 'metodoPago') {
      attributes = [
        'metodoPago',
        [Venta.sequelize.fn('SUM', Venta.sequelize.col('total')), 'total'],
        [Venta.sequelize.fn('COUNT', Venta.sequelize.col('id')), 'cantidad']
      ];
      group = ['metodoPago'];
    } else if (agrupacion === 'producto') {
      // Agrupación por producto usando DetalleVenta
      const DetalleVenta = require('../models/DetalleVenta');
      const Producto = require('../models/Producto');
      model = DetalleVenta;
      attributes = [
        'productoId',
        [DetalleVenta.sequelize.fn('SUM', DetalleVenta.sequelize.col('cantidad')), 'cantidad'],
        [DetalleVenta.sequelize.fn('SUM', DetalleVenta.sequelize.col('precio_unitario')), 'total']
      ];
      group = ['productoId'];
      include = [{ model: Producto, attributes: ['nombre'] }];
      raw = false;
    } else {
      // Default: tipo_cliente
      attributes = [
        [Venta.sequelize.col('Cliente.tipo_cliente'), 'tipo_cliente'],
        [Venta.sequelize.fn('SUM', Venta.sequelize.col('total')), 'total'],
        [Venta.sequelize.fn('COUNT', Venta.sequelize.col('Venta.id')), 'cantidad']
      ];
      group = [Venta.sequelize.col('Cliente.tipo_cliente')];
      include = [{ model: Cliente, attributes: [] }];
    }

    // Filtro por tipo_cliente si aplica
    if (tipo_cliente && agrupacion !== 'producto') {
      include = include || [];
      include.push({ model: Cliente, where: { tipo_cliente }, attributes: [] });
    }

    // Filtro por producto (solo si agrupacion=producto)
    if (producto && agrupacion === 'producto') {
      const Producto = require('../models/Producto');
      include = include || [];
      include.push({ model: Producto, where: { nombre: producto }, attributes: [] });
    }

    const result = await model.findAll({
      where: whereVenta,
      attributes,
      group,
      include,
      raw
    });

    console.log('>>> [ventas-agrupadas] agrupacion:', agrupacion);
    console.log('>>> [ventas-agrupadas] whereVenta:', whereVenta);
    console.log('>>> [ventas-agrupadas] result:', JSON.stringify(result, null, 2));

    // Formatear respuesta para frontend
    let resumen = {};
  if (agrupacion === 'mes') {
      result.forEach(r => {
        resumen[r.mes] = { total: parseFloat(r.total), cantidad: parseInt(r.cantidad) };
      });
    } else if (agrupacion === 'almacen') {
      result.forEach(r => {
        const almacen = r.almacenId || 'Sin asignar';
        resumen[almacen] = { total: parseFloat(r.total), cantidad: parseInt(r.cantidad) };
      });
    } else if (agrupacion === 'vendedor') {
      result.forEach(r => {
        const vend = r.vendedor || 'Sin asignar';
        resumen[vend] = { total: parseFloat(r.total), cantidad: parseInt(r.cantidad) };
      });
    } else if (agrupacion === 'metodoPago') {
      result.forEach(r => {
        const metodo = r.metodoPago || 'Sin especificar';
        resumen[metodo] = { total: parseFloat(r.total), cantidad: parseInt(r.cantidad) };
      });
    } else if (agrupacion === 'producto') {
      result.forEach(r => {
        const prod = r.Producto ? r.Producto.nombre : 'Desconocido';
        resumen[prod] = { total: parseFloat(r.total), cantidad: parseInt(r.cantidad) };
      });
    } else {
      // tipo_cliente
      result.forEach(r => {
        const tipo = r.tipo_cliente || 'Desconocido';
        resumen[tipo] = { total: parseFloat(r.total), cantidad: parseInt(r.cantidad) };
      });
    }

    console.log('>>> [ventas-agrupadas] resumen:', resumen);
    res.json(resumen);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al generar reporte' });
  }
});

module.exports = router;
