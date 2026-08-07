const { DataTypes } = require('sequelize');
const sequelize = require('../database/sequelize');
const Producto = require('./Producto');


const Venta = sequelize.define('Venta', {
  almacenId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'almacenes',
      key: 'id'
    }
  },
  fecha: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  total: {
    type: DataTypes.DECIMAL(10,2),
    allowNull: false
  },
  clienteId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'clientes',
      key: 'id'
    }
  },
  descuento: {
    type: DataTypes.DECIMAL(5,2),
    allowNull: true
  },
  metodoPago: {
    type: DataTypes.STRING,
    allowNull: true
  },
  notas: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  vendedor: {
    type: DataTypes.STRING,
    allowNull: true
  },
  estado: {
    type: DataTypes.ENUM('Pendiente', 'Pagada', 'Anulada'),
    allowNull: false,
    defaultValue: 'Pendiente'
  },
  direccion: {
    type: DataTypes.STRING,
    allowNull: true
  },
  telefono: {
    type: DataTypes.STRING,
    allowNull: true
  },
  impuestos: {
    type: DataTypes.DECIMAL(5,2),
    allowNull: true
  },
  facturaId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'facturas',
      key: 'id'
    }
  }
}, {
  tableName: 'ventas',
  timestamps: true
});

const Cliente = require('./Cliente');
const Almacen = require('./Almacen');
Venta.belongsTo(Cliente, { foreignKey: 'clienteId' });
Venta.belongsTo(Almacen, { foreignKey: 'almacenId', as: 'almacen' });
module.exports = Venta;
