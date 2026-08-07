const express = require('express');
const router = express.Router();
const Usuario = require('../models/Usuario');
const Producto = require('../models/Producto');
const Venta = require('../models/Venta');
const Factura = require('../models/Factura');
const { authToken } = require('./auth');
const { Op, fn, col, where } = require('sequelize');


// GET /api/dashboard - métricas generales
router.get('/', authToken, async (req, res) => {
  console.log('>> [DASHBOARD] Endpoint llamado');
  try {
    const almacenIdParam = req.query.almacenId;
    const usuario = req.user || {};
    const ventaWhere = {};

    // Para vendedores: usar el almacén asignado para contar todas las ventas de su almacén,
    // independientemente de que el campo "vendedor" esté vacío o no.
    if (usuario.rol === 'vendedor') {
      if (usuario.almacenId) {
        ventaWhere.almacenId = usuario.almacenId;
      } else if (usuario.nombre) {
        ventaWhere.vendedor = usuario.nombre;
      }
    } else {
      // Para admin (u otros roles), se respeta el filtro opcional por almacén recibido por query
      if (almacenIdParam) ventaWhere.almacenId = almacenIdParam;
    }
    const [usuarios, productos, ventas, facturas] = await Promise.all([
      Usuario.count(),
      Producto.count(),
      Venta.count({ where: ventaWhere }),
      Factura.count()
    ]);
    console.log('>> [DASHBOARD] Métricas:', { usuarios, productos, ventas, facturas });
    res.json({ usuarios, productos, ventas, facturas });
  } catch (err) {
    console.error('>> [DASHBOARD] Error:', err);
    res.status(500).json({ error: 'Error al obtener métricas', details: err.message });
  }
});

// GET /api/dashboard/kpis - KPIs rápidos para dashboard
router.get('/kpis', authToken, async (req, res) => {
  try {
    // Ventas de hoy (ajustado a zona horaria Colombia UTC-5)
    const now = new Date();
    // UTC-5: Colombia
    const offsetMs = -5 * 60 * 60 * 1000;
    const local = new Date(now.getTime() + offsetMs);
    const year = local.getUTCFullYear();
    const month = String(local.getUTCMonth() + 1).padStart(2, '0');
    const day = String(local.getUTCDate()).padStart(2, '0');
    const hoyStr = `${year}-${month}-${day}`;
    console.log('>> [KPIS] Fecha hoy (Colombia):', hoyStr);
    const usuario = req.user || {};
    const almacenIdQuery = req.query.almacenId;
    // Para vendedores, forzar el almacén asignado; para admin, usar el de la query si viene
    let effectiveAlmacenId = almacenIdQuery || null;
    if (usuario.rol === 'vendedor' && usuario.almacenId) {
      effectiveAlmacenId = usuario.almacenId;
    }
    const whereKpi = {
      estado: 'Pagada',
      [Op.and]: [
        where(fn('DATE', col('fecha')), '=', hoyStr)
      ]
    };
    if (effectiveAlmacenId) whereKpi.almacenId = effectiveAlmacenId;
    const ventasHoy = await Venta.findAll({
      where: whereKpi
    });
    console.log('>> [KPIS] Ventas hoy encontradas:', ventasHoy.length, ventasHoy.map(v=>({id:v.id,fecha:v.fecha,total:v.total})));
  const totalVentasHoy = ventasHoy.length;
  const ingresosHoy = ventasHoy.reduce((sum, v) => {
    const descuentoPct = parseFloat(v.descuento || 0) || 0;
    const total = parseFloat(v.total || 0) || 0;
    return sum + total * (1 - descuentoPct / 100);
  }, 0);

    // Ingresos del mes actual (usando fecha local Colombia)
    const inicioMes = new Date(local.getUTCFullYear(), local.getUTCMonth(), 1);
    const mesStr = `${inicioMes.getUTCFullYear()}-${String(inicioMes.getUTCMonth() + 1).padStart(2, '0')}`;
    console.log('>> [KPIS] Inicio mes (Colombia):', inicioMes, 'mesStr:', mesStr);
    const isSqlite = require('../database/sequelize').getDialect() === 'sqlite';
    const monthFormat = isSqlite ? fn('strftime', '%Y-%m', col('fecha')) : fn('DATE_FORMAT', col('fecha'), '%Y-%m');
    const whereMes = {
      estado: 'Pagada',
      [Op.and]: [
        where(monthFormat, '=', mesStr)
      ]
    };
    if (effectiveAlmacenId) whereMes.almacenId = effectiveAlmacenId;
    const ventasMes = await Venta.findAll({
      where: whereMes
    });
    console.log('>> [KPIS] Ventas mes encontradas:', ventasMes.length, ventasMes.map(v=>({id:v.id,fecha:v.fecha,total:v.total})));
    const ingresosMes = ventasMes.reduce((sum, v) => {
      const descuentoPct = parseFloat(v.descuento || 0) || 0;
      const total = parseFloat(v.total || 0) || 0;
      return sum + total * (1 - descuentoPct / 100);
    }, 0);
    const totalVentasMes = ventasMes.length;

    // Ticket promedio del mes
    const ticketPromedio = totalVentasMes > 0 ? ingresosMes / totalVentasMes : 0;

    // Productos en stock crítico (excluyendo servicios)
    const Producto = require('../models/Producto');
    const Cliente = require('../models/Cliente');
    const todosProds = await Producto.findAll();
    const productosCriticos = todosProds.filter(p => {
      const isServ = p.tipo === 'servicio' || (p.categoria && p.categoria.toLowerCase().includes('servicio'));
      if (isServ) return false;
      const min = (p.stock_minimo !== undefined && p.stock_minimo !== null && p.stock_minimo !== '') ? Number(p.stock_minimo) : 5;
      const st = Number(p.stock || 0);
      return st <= min || st <= 0;
    }).length;

    const totalProductosCount = await Producto.count();
    const totalClientesCount = await Cliente.count();

    res.json({
      ventasHoy: totalVentasHoy,
      ingresosHoy,
      ingresosMes,
      ticketPromedio,
      productosCriticos,
      totalProductos: totalProductosCount,
      totalClientes: totalClientesCount
    });
    console.log('-----------------------------');
  } catch (err) {
    console.error('>> [DASHBOARD/KPIS] Error:', err);
    res.status(500).json({ error: 'Error al obtener KPIs', details: err.message });
  }
});

module.exports = router;

// GET /api/dashboard/net-revenue?desde=YYYY-MM-DD&hasta=YYYY-MM-DD&group=day|month&almacenId=
router.get('/net-revenue', authToken, async (req, res) => {
  try {
    const { desde, hasta, group } = req.query;
    const usuario = req.user || {};
    const almacenIdQuery = req.query.almacenId;
    // Para vendedores, usar siempre su almacén asignado; para admin, el que venga en la query
    let effectiveAlmacenId = almacenIdQuery || null;
    if (usuario.rol === 'vendedor' && usuario.almacenId) {
      effectiveAlmacenId = usuario.almacenId;
    }
    // default group = day
    const agrup = group === 'month' ? 'month' : 'day';

    // Build SQL depending on group
    let dateExpr;
    const isSqlite = require('../database/sequelize').getDialect() === 'sqlite';
    if (agrup === 'month') {
      dateExpr = isSqlite ? "strftime('%Y-%m', v.fecha)" : "DATE_FORMAT(v.fecha, '%Y-%m')";
    } else {
      dateExpr = "DATE(v.fecha)";
    }

    const replacements = { desde: desde || null, hasta: hasta || null, almacenId: effectiveAlmacenId || null };

    let whereClauses = [];
    if (desde) whereClauses.push("v.fecha >= :desde");
    if (hasta) whereClauses.push("v.fecha <= :hasta");
    if (effectiveAlmacenId) whereClauses.push("v.almacenId = :almacenId");
    // Only Paid sales
    whereClauses.push("v.estado = 'Pagada'");

    const whereSql = whereClauses.length ? 'WHERE ' + whereClauses.join(' AND ') : '';

    const sql = `SELECT ${dateExpr} AS label, 
      SUM(v.total * (1 - COALESCE(v.descuento,0)/100)) AS net_revenue,
      SUM(v.total) AS gross_revenue,
      SUM(v.total * COALESCE(v.descuento,0)/100) AS discounts
      FROM ventas v
      ${whereSql}
      GROUP BY ${dateExpr}
      ORDER BY ${dateExpr}`;

    const rows = await require('../database/sequelize').query(sql, { replacements, type: require('sequelize').QueryTypes.SELECT });
    // Normalize numeric types
    const result = rows.map(r => ({ label: r.label, net_revenue: Number(r.net_revenue || 0), gross_revenue: Number(r.gross_revenue || 0), discounts: Number(r.discounts || 0) }));
    res.json({ labels: result.map(r => r.label), net_revenue: result.map(r => r.net_revenue), gross_revenue: result.map(r => r.gross_revenue), discounts: result.map(r => r.discounts) });
  } catch (err) {
    console.error('>> [DASHBOARD/net-revenue] Error:', err);
    res.status(500).json({ error: 'Error al obtener net revenue', details: err.message });
  }
});
