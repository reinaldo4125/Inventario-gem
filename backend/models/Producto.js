const { DataTypes } = require('sequelize');
const sequelize = require('../database/sequelize');

const Producto = sequelize.define('Producto', {
  nombre: {
    type: DataTypes.STRING,
    allowNull: false
  },
  descripcion: {
    type: DataTypes.STRING,
    allowNull: true
  },
  categoria: {
    type: DataTypes.STRING,
    allowNull: true
  },
  marca: {
    type: DataTypes.STRING,
    allowNull: true
  },
  modelo: {
    type: DataTypes.STRING,
    allowNull: true
  },
  compatibilidad: {
    type: DataTypes.STRING,
    allowNull: true
  },
  codigo_oem: {
    type: DataTypes.STRING,
    allowNull: true
  },
  stock: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  stock_minimo: {
    type: DataTypes.INTEGER,
    allowNull: true,
    defaultValue: 0
  },
  precio: {
    type: DataTypes.DECIMAL(10,2),
    allowNull: false
  },
  precio_detal: {
    type: DataTypes.DECIMAL(10,2),
    allowNull: true
  },
  precio_mayor: {
    type: DataTypes.DECIMAL(10,2),
    allowNull: true
  },
  precio_almacen: {
    type: DataTypes.DECIMAL(10,2),
    allowNull: true
  },
  costo: {
    type: DataTypes.DECIMAL(10,2),
    allowNull: true,
    defaultValue: null
  },
  ubicacion_bodega: {
    type: DataTypes.STRING,
    allowNull: true
  },
  unidad_medida: {
    type: DataTypes.STRING,
    allowNull: true,
    defaultValue: 'Unidad'
  },
  proveedor: {
    type: DataTypes.STRING,
    allowNull: true
  },
  foto: {
    type: DataTypes.STRING,
    allowNull: true
  },
  tipo: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'producto' // 'producto' o 'servicio'
  },
  activo: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true
  }
}, {
  tableName: 'productos',
  timestamps: false
});

module.exports = Producto;
