const sequelize = require('../database/sequelize');

async function migrate() {
  try {
    await sequelize.authenticate();
    console.log('[migrateCostoZeroToNull] Conectado a la DB');
    const [res] = await sequelize.query("UPDATE productos SET costo = NULL WHERE costo = 0");
    console.log('[migrateCostoZeroToNull] Resultado:', res);
    process.exit(0);
  } catch (err) {
    console.error('[migrateCostoZeroToNull] Error:', err);
    process.exit(1);
  }
}

migrate();
