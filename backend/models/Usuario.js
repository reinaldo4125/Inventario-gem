const { DataTypes } = require('sequelize');
const sequelize = require('../database/sequelize');


const Usuario = sequelize.define('Usuario', {
  nombre: {
    type: DataTypes.STRING,
    allowNull: false
  },
  correo: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  rol: {
    type: DataTypes.STRING,
    allowNull: false
  },
  password: {
    type: DataTypes.STRING,
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
  activo: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true
  },
  telefono: {
    type: DataTypes.STRING,
    allowNull: true
  },
  documento: {
    type: DataTypes.STRING,
    allowNull: true
  },
  cargo: {
    type: DataTypes.STRING,
    allowNull: true
  },
  direccion: {
    type: DataTypes.STRING,
    allowNull: true
  },
  comision: {
    type: DataTypes.FLOAT,
    allowNull: true,
    defaultValue: 0
  },
  notas: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  ultimoAcceso: {
    type: DataTypes.DATE,
    allowNull: true
  },
  refreshToken: {
    type: DataTypes.STRING,
    allowNull: true,
    field: 'refresh_token'
  }
}, {
  tableName: 'usuarios',
  timestamps: false
});

// Relación: Usuario pertenece a un Almacen
const Almacen = require('./Almacen');
Usuario.belongsTo(Almacen, { foreignKey: 'almacenId', as: 'almacen' });
module.exports = Usuario;
