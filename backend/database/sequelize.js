const { Sequelize } = require('sequelize');
const path = require('path');
require('dotenv').config();

const dbHost = process.env.DB_HOST;
const useMysql = dbHost && dbHost !== 'localhost' && dbHost !== '127.0.0.1';

let sequelize;

if (useMysql) {
  const dbName = process.env.DB_NAME || process.env.MYSQL_DATABASE || 'inventario';
  const dbUser = process.env.DB_USER || process.env.MYSQL_USER || 'root';
  const dbPass = process.env.DB_PASSWORD || process.env.MYSQL_PASSWORD || 'Salome2016.';
  const dbPort = process.env.DB_PORT || 3306;

  sequelize = new Sequelize(dbName, dbUser, dbPass, {
    host: dbHost,
    port: dbPort,
    dialect: 'mysql',
    dialectOptions: {
      multipleStatements: true
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

