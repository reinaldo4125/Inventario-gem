const { DataTypes } = require('sequelize');
const sequelize = require('../database/sequelize');

const DetalleTraslado = sequelize.define('DetalleTraslado', {
  trasladoId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'traslados',
      key: 'id'
    }
  },
  productoId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'productos',
      key: 'id'
    }
  },
  cantidad: {
    type: DataTypes.INTEGER,
    allowNull: false
  }
}, {
  tableName: 'detalle_traslados',
  timestamps: false
});

module.exports = DetalleTraslado;
