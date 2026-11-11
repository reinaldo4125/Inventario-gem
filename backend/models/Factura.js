const { DataTypes } = require('sequelize');
const sequelize = require('../database/sequelize');

const crypto = require('crypto');

const Factura = sequelize.define('Factura', {
  token_publico: {
    type: DataTypes.STRING(64),
    allowNull: true,
    unique: true,
    defaultValue: () => crypto.randomUUID()
  },
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
  },
  estado: {
    type: DataTypes.ENUM('Pendiente', 'Pagada', 'Anulada'),
    defaultValue: 'Pagada',
    allowNull: false
  },
  anuladaPor: {
    type: DataTypes.STRING,
    allowNull: true
  },
  motivoAnulacion: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  fechaAnulacion: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  tableName: 'facturas',
  timestamps: false,
  hooks: {
    beforeCreate: (inst) => {
      if (!inst.token_publico) {
        inst.token_publico = crypto.randomUUID();
      }
    }
  }
});

// Asociaciones para incluir productos en la factura con alias correctos
const DetalleFactura = require('./DetalleFactura');
const Producto = require('./Producto');
const Almacen = require('./Almacen');
const Venta = require('./Venta');
Factura.hasMany(DetalleFactura, { foreignKey: 'facturaId', as: 'DetalleFacturas' });
DetalleFactura.belongsTo(Factura, { foreignKey: 'facturaId', as: 'Factura' });
DetalleFactura.belongsTo(Producto, { foreignKey: 'productoId', as: 'Producto' });
Producto.hasMany(DetalleFactura, { foreignKey: 'productoId', as: 'DetalleFacturas' });
Factura.belongsTo(Almacen, { foreignKey: 'almacenId', as: 'almacen' });
Factura.hasOne(Venta, { foreignKey: 'facturaId', as: 'venta' });

module.exports = Factura;