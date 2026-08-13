// Script de diagnóstico: imprime filas del reporte de ganancia y muestra p.precio/p.costo
const sequelize = require('../database/sequelize');

async function run() {
  try {
    await sequelize.authenticate();
    console.log('[debugGanancia] Conectado a DB');
    const sql = `SELECT
      dv.productoId AS productoId,
      p.nombre AS productoNombre,
      p.precio AS precio_importacion,
      p.costo AS costo_producto,
      v.almacenId AS almacenId,
      SUM(dv.cantidad) AS cantidad_total,
      SUM(dv.cantidad * dv.precio_unitario) AS ventas_total,
   SUM(dv.cantidad * (CASE WHEN p.costo IS NULL OR p.costo = 0 THEN p.precio ELSE p.costo END)) AS costo_total,
   SUM(dv.cantidad * dv.precio_unitario) - SUM(dv.cantidad * (CASE WHEN p.costo IS NULL OR p.costo = 0 THEN p.precio ELSE p.costo END)) AS ganancia_monetaria,
   CASE WHEN SUM(dv.cantidad * (CASE WHEN p.costo IS NULL OR p.costo = 0 THEN p.precio ELSE p.costo END)) = 0 THEN NULL
     ELSE 100 * (SUM(dv.cantidad * dv.precio_unitario) - SUM(dv.cantidad * (CASE WHEN p.costo IS NULL OR p.costo = 0 THEN p.precio ELSE p.costo END))) / SUM(dv.cantidad * (CASE WHEN p.costo IS NULL OR p.costo = 0 THEN p.precio ELSE p.costo END))
      END AS ganancia_pct
    FROM detalle_ventas dv
    JOIN ventas v ON dv.ventaId = v.id
    JOIN productos p ON dv.productoId = p.id
    GROUP BY dv.productoId, v.almacenId
    ORDER BY p.nombre, v.almacenId;`;

  const rows = await sequelize.query(sql, { type: sequelize.QueryTypes.SELECT });
    if (!rows || rows.length === 0) {
      console.log('[debugGanancia] No se obtuvieron filas.');
      process.exit(0);
    }
    console.log('[debugGanancia] Filas obtenidas:');
    rows.forEach(r => {
      console.log('---');
      console.log('productoId:', r.productoId);
      console.log('productoNombre:', r.productoNombre);
      console.log('precio_importacion:', r.precio_importacion !== null ? Number(r.precio_importacion) : null);
      console.log('costo_producto:', r.costo_producto !== null ? Number(r.costo_producto) : null);
      console.log('almacenId:', r.almacenId);
      console.log('cantidad_total:', Number(r.cantidad_total));
      console.log('ventas_total:', Number(r.ventas_total));
      console.log('costo_total:', Number(r.costo_total));
      console.log('ganancia_monetaria:', Number(r.ganancia_monetaria));
      console.log('ganancia_pct:', r.ganancia_pct !== null ? Number(r.ganancia_pct).toFixed(4) : null);
    });
    process.exit(0);
  } catch (error) {
    console.error('[debugGanancia] Error:', error);
    process.exit(1);
  }
}

run();
