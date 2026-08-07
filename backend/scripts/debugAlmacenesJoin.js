const sequelize = require('../database/sequelize');

async function run() {
  try {
    await sequelize.authenticate();
    console.log('[debugAlmacenesJoin] Conectado a DB');
    const sql = `SELECT v.id as ventaId, v.almacenId, a.id as almacen_id, a.nombre as almacenNombre
      FROM ventas v
      LEFT JOIN almacenes a ON v.almacenId = a.id
      LIMIT 50`;
    const rows = await sequelize.query(sql, { type: sequelize.QueryTypes.SELECT });
    console.log('[debugAlmacenesJoin] filas:', rows.length);
    rows.forEach(r => console.log(r));
    process.exit(0);
  } catch (err) {
    console.error('[debugAlmacenesJoin] Error:', err);
    process.exit(1);
  }
}

run();
