const sequelize = require('../database/sequelize');

(async function(){
  const migrationName = '20251021-add-refresh-token-to-usuarios.js';
  try {
    // Ensure SequelizeMeta table exists
    await sequelize.query("CREATE TABLE IF NOT EXISTS `SequelizeMeta` (`name` VARCHAR(255) NOT NULL PRIMARY KEY);");
  } catch (e) {
    // ignore
  }
  try {
    const [rows] = await sequelize.query("SELECT COUNT(*) as cnt FROM SequelizeMeta WHERE name = ?", { replacements: [migrationName] });
    const exists = rows && rows[0] && (rows[0].cnt || rows[0]['COUNT(*)'] || rows[0].CNT);
    if (exists) {
      console.log('Migration already marked as executed:', migrationName);
      process.exit(0);
    }
    await sequelize.query("INSERT INTO SequelizeMeta (name) VALUES (?)", { replacements: [migrationName] });
    console.log('Marked migration as executed:', migrationName);
    process.exit(0);
  } catch (err) {
    console.error('Error marking migration executed:', err && err.stack ? err.stack : err);
    process.exit(1);
  }
})();
