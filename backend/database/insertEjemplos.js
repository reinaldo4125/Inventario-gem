const { Usuario, Cliente, Producto, Venta, DetalleVenta } = require('../models');
const sequelize = require('./sequelize');

async function insertarEjemplos() {
  await sequelize.sync();

  // Crear usuario admin
  await Usuario.findOrCreate({
    where: { correo: 'admin@admin.com' },
    defaults: { nombre: 'Admin', password: 'admin123', rol: 'admin' }
  });

  // Crear cliente
  const [cliente] = await Cliente.findOrCreate({
    where: { correo: 'cliente@ejemplo.com' },
    defaults: {
      nombre: 'Cliente Ejemplo',
      tipo_cliente: 'Detal',
      documento: '123456789',
      tipo_documento: 'CC',
      telefono: '3001234567',
      direccion: 'Calle 123',
    }
  });

  // Crear producto
  const [producto] = await Producto.findOrCreate({
    where: { nombre: 'Inyector Bosch' },
    defaults: {
      descripcion: 'Inyector de alta presión',
      categoria: 'Inyectores',
      marca: 'Bosch',
      modelo: '0445110XXX',
      compatibilidad: 'Renault, Chevrolet',
      codigo_oem: '0445110XXX',
      stock: 50,
      stock_minimo: 10,
      precio: 500000,
      precio_detal: 520000,
      precio_mayor: 480000,
      precio_almacen: 450000,
      foto: ''
    }
  });

  // Crear venta
  const venta = await Venta.create({
    fecha: new Date(),
    total: 1040000,
    clienteId: cliente.id
  });

  // Crear detalle de venta
  await DetalleVenta.create({
    cantidad: 2,
    precio_unitario: 520000,
    ventaId: venta.id,
    productoId: producto.id
  });

  console.log('Datos de ejemplo insertados.');
  process.exit();
}

insertarEjemplos();
