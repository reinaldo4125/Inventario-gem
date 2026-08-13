const { DataTypes } = require('sequelize');
const sequelize = require('../database/sequelize');

const Almacen = sequelize.define('Almacen', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  codigo: {
    type: DataTypes.STRING,
    allowNull: true
  },
  nombre: {
    type: DataTypes.STRING,
    allowNull: false
  },
  ubicacion: {
    type: DataTypes.STRING,
    allowNull: true
  },
  telefono: {
    type: DataTypes.STRING,
    allowNull: true
  },
  email: {
    type: DataTypes.STRING,
    allowNull: true
  },
  responsable: {
    type: DataTypes.STRING,
    allowNull: true
  },
  direccion: {
    type: DataTypes.STRING,
    allowNull: true
  },
  ciudad: {
    type: DataTypes.STRING,
    allowNull: true
  },
  activo: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true
  }
}, {
  tableName: 'almacenes',
  timestamps: false
});

module.exports = Almacen;
