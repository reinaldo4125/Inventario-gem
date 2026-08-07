const sequelize = require('../database/sequelize');
const Producto = require('../models/Producto');

async function run() {
  try {
    await sequelize.authenticate();
    console.log('[archiveProduct] Conectado a la DB');
    const productId = process.argv[2] || 13;

    // Comprobar si la columna activo existe
    const [cols] = await sequelize.query("SHOW COLUMNS FROM productos LIKE 'activo'");
    if (!cols || cols.length === 0) {
      console.log('[archiveProduct] Columna `activo` no encontrada. Creando columna...');
      await sequelize.query("ALTER TABLE productos ADD COLUMN activo TINYINT(1) NOT NULL DEFAULT 1");
      console.log('[archiveProduct] Columna `activo` creada');
    } else {
      console.log('[archiveProduct] Columna `activo` ya existe');
    }

    // Actualizar el producto directamente vía SQL para evitar problemas si el modelo no refleja la columna
    const [result] = await sequelize.query('UPDATE productos SET activo = 0 WHERE id = ?', { replacements: [productId] });
    // depending on dialect/result, result may be affectedRows or an object; normalize
    let affected = 0;
    if (typeof result === 'number') affected = result;
    else if (result && typeof result.affectedRows === 'number') affected = result.affectedRows;
    else if (Array.isArray(result) && typeof result[0] === 'number') affected = result[0];

    if (affected > 0) {
      console.log(`[archiveProduct] Producto ${productId} archivado correctamente (rows=${affected})`);
    } else {
      console.log(`[archiveProduct] Producto ${productId} no encontrado o ya archivado (rows=${affected})`);
    }
    process.exit(0);
  } catch (err) {
    console.error('[archiveProduct] Error:', err && err.stack ? err.stack : err);
    process.exit(1);
  }
}

run();
