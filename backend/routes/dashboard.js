const express = require('express');
const router = express.Router();
const Usuario = require('../models/Usuario');
const Producto = require('../models/Producto');
const Venta = require('../models/Venta');
const Factura = require('../models/Factura');
const auth = require('../middleware/auth');
const requirePermiso = require('../middleware/roles');
const { almacenDelUsuario, sanitizarCostos } = require('../utils/almacenScope');
const { Op, fn, col, where } = require('sequelize');

// GET /api/dashboard - métricas generales
router.get('/', auth, requirePermiso(['dashboard.ver', 'dashboard.stock']), async (req, res) => {
  try {
    const usuario = req.user || {};
    const isAdmin = usuario.rol === 'admin';
    const scopedAlmacenId = almacenDelUsuario(req, res);
    if (scopedAlmacenId === undefined && !isAdmin) return;

    const ventaWhere = { estado: 'Pagada' };

    if (scopedAlmacenId) {
      ventaWhere.almacenId = scopedAlmacenId;
    }

    if (usuario.rol === 'vendedor' && usuario.nombre) {
      ventaWhere.vendedor = usuario.nombre;
    }

    const [usuarios, productos, ventas, facturas] = await Promise.all([
      Usuario.count(),
      Producto.count(),
      Venta.count({ where: ventaWhere }),
      Factura.count(scopedAlmacenId ? { where: { almacenId: scopedAlmacenId } } : {})
    ]);
    res.json({ usuarios, productos, ventas, facturas });
  } catch (err) {
    console.error('>> [DASHBOARD] Error:', err);
    res.status(500).json({ error: 'Error al obtener métricas', details: err.message });
  }
});

// GET /api/dashboard/kpis - KPIs rápidos para dashboard
router.get('/kpis', auth, requirePermiso(['dashboard.ver', 'dashboard.stock']), async (req, res) => {
  try {
    const usuario = req.user || {};
    const isAdmin = usuario.rol === 'admin';
    const scopedAlmacenId = almacenDelUsuario(req, res);
    if (scopedAlmacenId === undefined && !isAdmin) return;

    // Ventas de hoy (ajustado a zona horaria Colombia UTC-5)
    const now = new Date();
    const offsetMs = -5 * 60 * 60 * 1000;
    const local = new Date(now.getTime() + offsetMs);
    const year = local.getUTCFullYear();
    const month = String(local.getUTCMonth() + 1).padStart(2, '0');
    const day = String(local.getUTCDate()).padStart(2, '0');
    const hoyStr = `${year}-${month}-${day}`;

    const whereKpi = {
      estado: 'Pagada',
      [Op.and]: [
        where(fn('DATE', col('fecha')), '=', hoyStr)
      ]
    };
    if (scopedAlmacenId) whereKpi.almacenId = scopedAlmacenId;
    if (usuario.rol === 'vendedor' && usuario.nombre) {
      whereKpi.vendedor = usuario.nombre;
    }

    const ventasHoy = await Venta.findAll({ where: whereKpi });
    const totalVentasHoy = ventasHoy.length;
    const ingresosHoy = ventasHoy.reduce((sum, v) => {
      const descuentoPct = parseFloat(v.descuento || 0) || 0;
      const total = parseFloat(v.total || 0) || 0;
      return sum + total * (1 - descuentoPct / 100);
    }, 0);

    // Ingresos del mes actual (usando fecha local Colombia)
    const inicioMes = new Date(local.getUTCFullYear(), local.getUTCMonth(), 1);
    const mesStr = `${inicioMes.getUTCFullYear()}-${String(inicioMes.getUTCMonth() + 1).padStart(2, '0')}`;
    const isSqlite = require('../database/sequelize').getDialect() === 'sqlite';
    const monthFormat = isSqlite ? fn('strftime', '%Y-%m', col('fecha')) : fn('DATE_FORMAT', col('fecha'), '%Y-%m');
    const whereMes = {
      estado: 'Pagada',
      [Op.and]: [
        where(monthFormat, '=', mesStr)
      ]
    };
    if (scopedAlmacenId) whereMes.almacenId = scopedAlmacenId;
    if (usuario.rol === 'vendedor' && usuario.nombre) {
      whereMes.vendedor = usuario.nombre;
    }

    const ventasMes = await Venta.findAll({ where: whereMes });
    const ingresosMes = ventasMes.reduce((sum, v) => {
      const descuentoPct = parseFloat(v.descuento || 0) || 0;
      const total = parseFloat(v.total || 0) || 0;
      return sum + total * (1 - descuentoPct / 100);
    }, 0);
    const totalVentasMes = ventasMes.length;

    // Ticket promedio del mes
    const ticketPromedio = totalVentasMes > 0 ? ingresosMes / totalVentasMes : 0;

    // Productos en stock crítico según la regla única unificada
    const { obtenerProductosCriticos } = require('../utils/stockCritico');
    const alertasStock = await obtenerProductosCriticos({ almacenId: scopedAlmacenId });
    const productosCriticos = new Set(alertasStock.map(a => a.productoId)).size;
    const Cliente = require('../models/Cliente');

    const totalProductosCount = await Producto.count();
    const totalClientesCount = await Cliente.count();

    const kpisResponse = {
      ventasHoy: totalVentasHoy,
      ingresosHoy,
      ingresosMes,
      ticketPromedio,
      productosCriticos,
      totalProductos: totalProductosCount,
      totalClientes: totalClientesCount
    };

    res.json(sanitizarCostos(kpisResponse, req.user));
  } catch (err) {
    console.error('>> [DASHBOARD/KPIS] Error:', err);
    res.status(500).json({ error: 'Error al obtener KPIs', details: err.message });
  }
});

// GET /api/dashboard/net-revenue?desde=YYYY-MM-DD&hasta=YYYY-MM-DD&group=day|month
router.get('/net-revenue', auth, requirePermiso(['dashboard.ver', 'dashboard.stock']), async (req, res) => {
  try {
    const { desde, hasta, group } = req.query;
    const usuario = req.user || {};
    const isAdmin = usuario.rol === 'admin';
    const scopedAlmacenId = almacenDelUsuario(req, res);
    if (scopedAlmacenId === undefined && !isAdmin) return;

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

    const replacements = { 
      desde: desde || null, 
      hasta: hasta || null, 
      almacenId: scopedAlmacenId || null,
      vendedorNombre: usuario.rol === 'vendedor' ? usuario.nombre : null
    };

    let whereClauses = [];
    if (desde) whereClauses.push("v.fecha >= :desde");
    if (hasta) whereClauses.push("v.fecha <= :hasta");
    if (scopedAlmacenId) whereClauses.push("v.almacenId = :almacenId");
    if (usuario.rol === 'vendedor' && usuario.nombre) {
      whereClauses.push("v.vendedor = :vendedorNombre");
    }
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
    const result = rows.map(r => ({ label: r.label, net_revenue: Number(r.net_revenue || 0), gross_revenue: Number(r.gross_revenue || 0), discounts: Number(r.discounts || 0) }));
    res.json({ labels: result.map(r => r.label), net_revenue: result.map(r => r.net_revenue), gross_revenue: result.map(r => r.gross_revenue), discounts: result.map(r => r.discounts) });
  } catch (err) {
    console.error('>> [DASHBOARD/net-revenue] Error:', err);
    res.status(500).json({ error: 'Error al obtener net revenue', details: err.message });
  }
});

module.exports = router;
