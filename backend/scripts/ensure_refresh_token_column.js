const sequelize = require('../database/sequelize');

(async function(){
  try {
    console.log('Comprobando columna refresh_token en tabla usuarios...');
    const [rows] = await sequelize.query("SELECT COUNT(*) as cnt FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'usuarios' AND COLUMN_NAME = 'refresh_token'");
    const exists = rows && rows[0] && (rows[0].cnt || rows[0].CNT || rows[0]['COUNT(*)']);
    if (exists) {
      console.log('La columna refresh_token ya existe. No se hace nada.');
      process.exit(0);
    }
    console.log('Columna no encontrada. Añadiendo columna refresh_token (VARCHAR(255) NULL)...');
    await sequelize.query("ALTER TABLE usuarios ADD COLUMN refresh_token VARCHAR(255) NULL");
    console.log('Columna añadida correctamente.');
    process.exit(0);
  } catch (err) {
    console.error('Error al comprobar/crear columna refresh_token:', err && err.stack ? err.stack : err);
    process.exit(1);
  }
})();
