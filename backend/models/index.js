const Usuario = require('./Usuario');
const Producto = require('./Producto');
const Venta = require('./Venta');
const Factura = require('./Factura');
const DetalleVenta = require('./DetalleVenta');
const Cliente = require('./Cliente');
const DetalleFactura = require('./DetalleFactura');
const Empresa = require('./Empresa');
const Almacen = require('./Almacen');
const ProductoAlmacen = require('./ProductoAlmacen');
const ProductoCosto = require('./ProductoCosto');
const Traslado = require('./Traslado');
const DetalleTraslado = require('./DetalleTraslado');
const Kardex = require('./Kardex');
const Caja = require('./Caja');
const Abono = require('./Abono');

// Relaciones
Venta.belongsTo(Cliente, { foreignKey: 'clienteId' });
Venta.hasMany(DetalleVenta, { foreignKey: 'ventaId' });
DetalleVenta.belongsTo(Venta, { foreignKey: 'ventaId' });
DetalleVenta.belongsTo(Producto, { foreignKey: 'productoId' });

// Relación Facturas y Abonos (Cuentas por Cobrar)
Factura.hasMany(Abono, { foreignKey: 'facturaId', as: 'Abonos' });
Abono.belongsTo(Factura, { foreignKey: 'facturaId', as: 'Factura' });

// Relación Facturas y Ventas
if (!Venta.associations.factura) {
  Venta.belongsTo(Factura, { foreignKey: 'facturaId', as: 'factura' });
}

// Relación de costes de producto
Producto.hasMany(ProductoCosto, { foreignKey: 'productoId' });
ProductoCosto.belongsTo(Producto, { foreignKey: 'productoId' });

// Relación de productos y almacenes (muchos a muchos con stock)
Producto.belongsToMany(Almacen, { through: ProductoAlmacen, foreignKey: 'productoId', otherKey: 'almacenId', as: 'almacenes' });
Almacen.belongsToMany(Producto, { through: ProductoAlmacen, foreignKey: 'almacenId', otherKey: 'productoId', as: 'productos' });

// Relaciones Traslados
Traslado.belongsTo(Almacen, { as: 'almacenOrigen', foreignKey: 'almacenOrigenId' });
Traslado.belongsTo(Almacen, { as: 'almacenDestino', foreignKey: 'almacenDestinoId' });
Traslado.hasMany(DetalleTraslado, { foreignKey: 'trasladoId', as: 'detalles' });
DetalleTraslado.belongsTo(Traslado, { foreignKey: 'trasladoId' });
DetalleTraslado.belongsTo(Producto, { foreignKey: 'productoId' });

// Relaciones Kardex
Kardex.belongsTo(Producto, { foreignKey: 'productoId' });
Kardex.belongsTo(Almacen, { foreignKey: 'almacenId' });

module.exports = {
  Usuario,
  Producto,
  Venta,
  Factura,
  DetalleVenta,
  DetalleFactura,
  Cliente,
  Empresa,
  Almacen,
  ProductoAlmacen,
  ProductoCosto,
  Traslado,
  DetalleTraslado,
  Kardex,
  Caja,
  Abono
};

