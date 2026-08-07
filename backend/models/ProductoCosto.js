const { DataTypes } = require('sequelize');
const sequelize = require('../database/sequelize');

const ProductoCosto = sequelize.define('ProductoCosto', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  productoId: { type: DataTypes.INTEGER, allowNull: false },
  almacenId: { type: DataTypes.INTEGER, allowNull: true },
  costo: { type: DataTypes.DECIMAL(10,2), allowNull: false },
  fecha_inicio: { type: DataTypes.DATE, allowNull: false },
  fecha_fin: { type: DataTypes.DATE, allowNull: true }
}, {
  tableName: 'producto_costos',
  timestamps: false
});

module.exports = ProductoCosto;
