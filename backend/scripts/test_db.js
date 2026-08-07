const sequelize = require('../database/sequelize');

(async function(){
  try {
    await sequelize.authenticate();
    console.log('Sequelize: conexión a la BD OK');
    const [results] = await sequelize.query('SELECT VERSION() as version');
    console.log('MySQL version:', results[0].version || results[0].VERSION());
    process.exit(0);
  } catch (err) {
    console.error('Sequelize: error conectando a la BD');
    console.error(err && err.stack ? err.stack : err);
    process.exit(1);
  }
})();
