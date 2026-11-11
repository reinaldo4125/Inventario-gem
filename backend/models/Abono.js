const { DataTypes } = require('sequelize');
const sequelize = require('../database/sequelize');

const crypto = require('crypto');

const Abono = sequelize.define('Abono', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  token_publico: {
    type: DataTypes.STRING(64),
    allowNull: true,
    unique: true,
    defaultValue: () => crypto.randomUUID()
  },
  facturaId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'facturas',
      key: 'id'
    }
  },
  ventaId: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  clienteId: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  clienteNombre: {
    type: DataTypes.STRING,
    allowNull: false
  },
  documento: {
    type: DataTypes.STRING,
    allowNull: true
  },
  telefono: {
    type: DataTypes.STRING,
    allowNull: true
  },
  monto: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  saldo_anterior: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0
  },
  saldo_nuevo: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0
  },
  metodoPago: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'Efectivo'
  },
  referencia: {
    type: DataTypes.STRING,
    allowNull: true
  },
  recibo_caja_no: {
    type: DataTypes.STRING,
    allowNull: true
  },
  observaciones: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  usuarioNombre: {
    type: DataTypes.STRING,
    allowNull: true,
    defaultValue: 'Caja'
  },
  fecha: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'abonos',
  timestamps: true,
  hooks: {
    beforeCreate: (inst) => {
      if (!inst.token_publico) {
        inst.token_publico = crypto.randomUUID();
      }
    }
  }
});

module.exports = Abono;
