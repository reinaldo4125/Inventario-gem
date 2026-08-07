const { DataTypes } = require('sequelize');
const sequelize = require('../database/sequelize');

const Cliente = sequelize.define('Cliente', {
  almacenId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'almacenes',
      key: 'id'
    }
  },
  nombre: {
    type: DataTypes.STRING,
    allowNull: false
  },
  empresa: {
    type: DataTypes.STRING,
    allowNull: true
  },
  tipo_cliente: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'Detal'
  },
  documento: {
    type: DataTypes.STRING,
    allowNull: false
  },
  tipo_documento: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'NIT'
  },
  telefono: {
    type: DataTypes.STRING,
    allowNull: true
  },
  correo: {
    type: DataTypes.STRING,
    allowNull: true
  },
  direccion: {
    type: DataTypes.STRING,
    allowNull: true
  },
  ciudad: {
    type: DataTypes.STRING,
    allowNull: true
  },
  departamento: {
    type: DataTypes.STRING,
    allowNull: true
  },
  pais: {
    type: DataTypes.STRING,
    allowNull: true,
    defaultValue: 'Colombia'
  },
  descuentoEspecial: {
    type: DataTypes.FLOAT,
    allowNull: true,
    defaultValue: 0
  },
  cupoCredito: {
    type: DataTypes.FLOAT,
    allowNull: true,
    defaultValue: 0
  },
  activo: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true
  },
  notas: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  tableName: 'clientes',
  timestamps: true
});

// Relación para poder incluir el nombre del almacén
const Almacen = require('./Almacen');
Cliente.belongsTo(Almacen, { foreignKey: 'almacenId', as: 'almacen' });

module.exports = Cliente;
