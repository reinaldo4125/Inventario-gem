const { Sequelize } = require('sequelize');
const path = require('path');
require('dotenv').config();

const dbHost = process.env.DB_HOST;
const useMysql = dbHost && dbHost !== 'localhost' && dbHost !== '127.0.0.1';

let sequelize;

if (useMysql) {
  if (!process.env.DB_PASSWORD) {
    console.error("Falta DB_PASSWORD en .env");
    process.exit(1);
  }
  const dbName = process.env.DB_NAME || process.env.MYSQL_DATABASE || 'inventario';
  const dbUser = process.env.DB_USER || process.env.MYSQL_USER || 'root';
  const dbPass = process.env.DB_PASSWORD;
  const dbPort = process.env.DB_PORT || 3306;

  sequelize = new Sequelize(dbName, dbUser, dbPass, {
    host: dbHost,
    port: dbPort,
    dialect: 'mysql',
    timezone: '-05:00',
    dialectOptions: {
      multipleStatements: false
    },
    logging: false
  });
} else {
  const dbPath = path.join(__dirname, '..', 'database.sqlite');
  sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: dbPath,
    logging: false
  });
}

module.exports = sequelize;

