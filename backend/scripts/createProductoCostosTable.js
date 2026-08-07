const sequelize = require('../database/sequelize');

async function createTable() {
  try {
    await sequelize.authenticate();
    console.log('[createProductoCostosTable] Conectado a la DB');
    const sql = `
      CREATE TABLE IF NOT EXISTS producto_costos (
        id INT AUTO_INCREMENT PRIMARY KEY,
        productoId INT NOT NULL,
        almacenId INT NULL,
        costo DECIMAL(10,2) NOT NULL,
        fecha_inicio DATE NOT NULL,
        fecha_fin DATE NULL,
        INDEX(productoId),
        INDEX(almacenId),
        FOREIGN KEY (productoId) REFERENCES productos(id)
      );
    `;
    await sequelize.query(sql);
    console.log('[createProductoCostosTable] Tabla creada o ya existe');
    process.exit(0);
  } catch (err) {
    console.error('[createProductoCostosTable] Error:', err);
    process.exit(1);
  }
}

createTable();
