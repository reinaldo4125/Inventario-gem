const { DataTypes } = require('sequelize');
const sequelize = require('../database/sequelize');
const Venta = require('./Venta');
const Producto = require('./Producto');

const DetalleVenta = sequelize.define('DetalleVenta', {
  cantidad: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  precio_unitario: {
    type: DataTypes.DECIMAL(10,2),
    allowNull: false
  }
}, {
  tableName: 'detalle_ventas',
  timestamps: false
});

// Relaciones
Venta.hasMany(DetalleVenta, { foreignKey: 'ventaId' });
DetalleVenta.belongsTo(Venta, { foreignKey: 'ventaId' });
Producto.hasMany(DetalleVenta, { foreignKey: 'productoId' });
DetalleVenta.belongsTo(Producto, { foreignKey: 'productoId' });

module.exports = DetalleVenta;
