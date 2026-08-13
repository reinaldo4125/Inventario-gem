const { DataTypes } = require('sequelize');
const sequelize = require('../database/sequelize');

const Factura = sequelize.define('Factura', {
  cliente: {
    type: DataTypes.STRING,
    allowNull: false
  },
  documento: {
    type: DataTypes.STRING,
    allowNull: true
  },
  tipo_documento: {
    type: DataTypes.STRING,
    allowNull: true
  },
  direccion: {
    type: DataTypes.STRING,
    allowNull: true
  },
  telefono: {
    type: DataTypes.STRING,
    allowNull: true
  },
  correo: {
    type: DataTypes.STRING,
    allowNull: true
  },
  notas: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  total: {
    type: DataTypes.DECIMAL(10,2),
    allowNull: false
  },
  almacenId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'almacenes',
      key: 'id'
    }
  },
  fecha: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'facturas',
  timestamps: false
});

// Asociaciones para incluir productos en la factura con alias correctos
const DetalleFactura = require('./DetalleFactura');
const Producto = require('./Producto');
const Almacen = require('./Almacen');
Factura.hasMany(DetalleFactura, { foreignKey: 'facturaId', as: 'DetalleFacturas' });
DetalleFactura.belongsTo(Factura, { foreignKey: 'facturaId', as: 'Factura' });
DetalleFactura.belongsTo(Producto, { foreignKey: 'productoId', as: 'Producto' });
Producto.hasMany(DetalleFactura, { foreignKey: 'productoId', as: 'DetalleFacturas' });
Factura.belongsTo(Almacen, { foreignKey: 'almacenId', as: 'almacen' });

module.exports = Factura;