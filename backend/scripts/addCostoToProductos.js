/* Script: addCostoToProductos.js
   Añade la columna `costo` en la tabla `productos` si no existe.
   Uso: node backend/scripts/addCostoToProductos.js
*/

const sequelize = require('../database/sequelize');

async function ensureCostoColumn() {
  try {
    console.log('[addCostoToProductos] Conectando a la DB...');
    await sequelize.authenticate();

    // Verificar si la columna existe (MySQL INFORMATION_SCHEMA)
    const [results] = await sequelize.query(
      "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'productos' AND COLUMN_NAME = 'costo'"
    );

    if (results.length > 0) {
      console.log('[addCostoToProductos] La columna `costo` ya existe. Nada que hacer.');
      process.exit(0);
    }

    // Ejecutar alter table
    const alterSql = "ALTER TABLE productos ADD COLUMN costo DECIMAL(10,2) NOT NULL DEFAULT 0.00";
    console.log('[addCostoToProductos] Ejecutando:', alterSql);
    const [res] = await sequelize.query(alterSql);
    console.log('[addCostoToProductos] ALTER ejecutado con resultado:', res);
    console.log('[addCostoToProductos] Columna `costo` agregada correctamente.');
    process.exit(0);
  } catch (error) {
    console.error('[addCostoToProductos] Error:', error);
    process.exit(1);
  }
}

ensureCostoColumn();
