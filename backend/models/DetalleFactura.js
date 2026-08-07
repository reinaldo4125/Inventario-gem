const { DataTypes } = require('sequelize');
const sequelize = require('../database/sequelize');
const Factura = require('./Factura');
const Producto = require('./Producto');

const DetalleFactura = sequelize.define('DetalleFactura', {
  facturaId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'facturas',
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
  },
  precio_unitario: {
    type: DataTypes.DECIMAL(10,2),
    allowNull: false
  }
}, {
  tableName: 'detalle_facturas',
  timestamps: false
});


module.exports = DetalleFactura;
