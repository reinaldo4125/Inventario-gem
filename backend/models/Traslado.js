const { DataTypes } = require('sequelize');
const sequelize = require('../database/sequelize');

const Traslado = sequelize.define('Traslado', {
  almacenOrigenId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'almacenes',
      key: 'id'
    }
  },
  almacenDestinoId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'almacenes',
      key: 'id'
    }
  },
  usuarioNombre: {
    type: DataTypes.STRING,
    allowNull: true
  },
  fecha: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  estado: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'Completado'
  },
  observaciones: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  tableName: 'traslados',
  timestamps: true
});

module.exports = Traslado;
