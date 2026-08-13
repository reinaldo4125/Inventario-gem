const sequelize = require('../database/sequelize');

async function alter() {
  try {
    await sequelize.authenticate();
    console.log('[alterCostoAllowNull] Conectado a la DB');
    const sql = "ALTER TABLE productos MODIFY COLUMN costo DECIMAL(10,2) NULL";
    console.log('[alterCostoAllowNull] Ejecutando:', sql);
    await sequelize.query(sql);
    console.log('[alterCostoAllowNull] Columna modificada para permitir NULL');
    process.exit(0);
  } catch (err) {
    console.error('[alterCostoAllowNull] Error:', err);
    process.exit(1);
  }
}

alter();
