const sequelize = require('./sequelize');
const Usuario = require('../models/Usuario');

async function syncUsuario() {
  try {
    await sequelize.authenticate();
    console.log('Conexión a MySQL exitosa.');
    await Usuario.sync({ alter: true });
    console.log('Tabla de usuarios sincronizada correctamente.');
  } catch (error) {
    console.error('Error al sincronizar la tabla de usuarios:', error);
  } finally {
    await sequelize.close();
  }
}

syncUsuario();
