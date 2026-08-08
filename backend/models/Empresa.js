const { DataTypes } = require('sequelize');
const sequelize = require('../database/sequelize');

const Empresa = sequelize.define('Empresa', {
  nombre: {
    type: DataTypes.STRING,
    allowNull: false
  },
  nit: {
    type: DataTypes.STRING,
    allowNull: false
  },
  actividad_economica: {
    type: DataTypes.STRING,
    allowNull: true
  },
  representante_legal: {
    type: DataTypes.STRING,
    allowNull: true
  },
  direccion: {
    type: DataTypes.STRING,
    allowNull: false
  },
  ciudad: {
    type: DataTypes.STRING,
    allowNull: true
  },
  telefono: {
    type: DataTypes.STRING,
    allowNull: false
  },
  telefono_secundario: {
    type: DataTypes.STRING,
    allowNull: true
  },
  correo: {
    type: DataTypes.STRING,
    allowNull: false
  },
  sitio_web: {
    type: DataTypes.STRING,
    allowNull: true
  },
  logo_url: {
    type: DataTypes.TEXT('long'),
    allowNull: true
  },
  moneda: {
    type: DataTypes.STRING,
    defaultValue: '$'
  },
  impuesto_porcentaje: {
    type: DataTypes.FLOAT,
    defaultValue: 0
  },
  pie_pagina_factura: {
    type: DataTypes.TEXT('long'),
    allowNull: true
  }
}, {
  tableName: 'empresas',
  timestamps: false
});

module.exports = Empresa;

