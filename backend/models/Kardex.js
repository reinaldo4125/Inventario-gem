const { DataTypes } = require('sequelize');
const sequelize = require('../database/sequelize');

const Kardex = sequelize.define('Kardex', {
  productoId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'productos',
      key: 'id'
    }
  },
  almacenId: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  tipo: {
    type: DataTypes.STRING, // 'Entrada', 'Salida', 'Traslado', 'Ajuste'
    allowNull: false
  },
  origen_destino: {
    type: DataTypes.STRING, // e.g. 'Venta #12', 'Traslado Bodega A -> B', 'Ajuste Manual'
    allowNull: true
  },
  cantidad: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  stock_anterior: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  stock_nuevo: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  usuario: {
    type: DataTypes.STRING,
    allowNull: true
  },
  fecha: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  referencia_id: {
    type: DataTypes.INTEGER,
    allowNull: true
  }
}, {
  tableName: 'kardex',
  timestamps: true
});

module.exports = Kardex;
