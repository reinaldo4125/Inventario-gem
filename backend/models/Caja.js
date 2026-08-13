const { DataTypes } = require('sequelize');
const sequelize = require('../database/sequelize');

const Caja = sequelize.define('Caja', {
  almacenId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1
  },
  usuarioNombre: {
    type: DataTypes.STRING,
    allowNull: false
  },
  monto_apertura: {
    type: DataTypes.DECIMAL(10,2),
    allowNull: false,
    defaultValue: 0
  },
  monto_cierre: {
    type: DataTypes.DECIMAL(10,2),
    allowNull: true
  },
  monto_esperado: {
    type: DataTypes.DECIMAL(10,2),
    allowNull: true
  },
  diferencia: {
    type: DataTypes.DECIMAL(10,2),
    allowNull: true
  },
  fecha_apertura: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  fecha_cierre: {
    type: DataTypes.DATE,
    allowNull: true
  },
  estado: {
    type: DataTypes.STRING, // 'Abierta', 'Cerrada'
    allowNull: false,
    defaultValue: 'Abierta'
  },
  observaciones: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  resumen_metodos: {
    type: DataTypes.TEXT, // JSON string
    allowNull: true
  }
}, {
  tableName: 'cajas',
  timestamps: true
});

module.exports = Caja;
