const sequelize = require('../database/sequelize');

async function testConnection() {
  try {
    await sequelize.authenticate();
    console.log('Conexión a MySQL exitosa.');
  } catch (error) {
    console.error('No se pudo conectar a MySQL:', error);
  }
}

testConnection();
