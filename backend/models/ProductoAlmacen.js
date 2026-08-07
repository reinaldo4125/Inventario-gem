const { DataTypes } = require('sequelize');
const sequelize = require('../database/sequelize');
const Producto = require('./Producto');
const Almacen = require('./Almacen');

const ProductoAlmacen = sequelize.define('ProductoAlmacen', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
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
    allowNull: false,
    references: {
      model: 'almacenes',
      key: 'id'
    }
  },
  stock: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  }
}, {
  tableName: 'producto_almacen',
  timestamps: false
});

Producto.belongsToMany(Almacen, { through: ProductoAlmacen, foreignKey: 'productoId', otherKey: 'almacenId' });
Almacen.belongsToMany(Producto, { through: ProductoAlmacen, foreignKey: 'almacenId', otherKey: 'productoId' });
ProductoAlmacen.belongsTo(Producto, { foreignKey: 'productoId' });
ProductoAlmacen.belongsTo(Almacen, { foreignKey: 'almacenId' });

module.exports = ProductoAlmacen;
