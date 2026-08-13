const sequelize = require('./sequelize');
const Almacen = require('../models/Almacen');
const Usuario = require('../models/Usuario');
const Producto = require('../models/Producto');
const Venta = require('../models/Venta');
const DetalleVenta = require('../models/DetalleVenta');
const ProductoAlmacen = require('../models/ProductoAlmacen');

async function syncAll() {
  try {
    await sequelize.authenticate();
    console.log('Conexión a MySQL exitosa.');
    // Crear tabla `almacenes` primero usando SQL directo para evitar posibles
    // problemas de dependencia circular entre modelos al importarlos.
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS almacenes (
        id INT NOT NULL AUTO_INCREMENT,
        nombre VARCHAR(255) NOT NULL,
        ubicacion VARCHAR(255),
        PRIMARY KEY (id)
      ) ENGINE=InnoDB;
    `);
    console.log('Tabla almacenes verificada/creada.');
    // También crear tablas padre necesarias para claves foráneas que usan ventas/facturas
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS clientes (
        id INT NOT NULL AUTO_INCREMENT,
        almacenId INT,
        nombre VARCHAR(255) NOT NULL,
        tipo_cliente ENUM('Detal','Mayor','Almacén') NOT NULL,
        documento VARCHAR(255) NOT NULL UNIQUE,
        tipo_documento ENUM('CC','NIT','CE','Otro') NOT NULL,
        telefono VARCHAR(255),
        correo VARCHAR(255),
        direccion VARCHAR(255),
        ciudad VARCHAR(255),
        pais VARCHAR(255) DEFAULT 'Colombia',
        notas TEXT,
        createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY(id)
      ) ENGINE=InnoDB;
    `);
    console.log('Tabla clientes verificada/creada.');
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS facturas (
        id INT NOT NULL AUTO_INCREMENT,
        cliente VARCHAR(255) NOT NULL,
        documento VARCHAR(255),
        tipo_documento VARCHAR(255),
        direccion VARCHAR(255),
        telefono VARCHAR(255),
        correo VARCHAR(255),
        notas TEXT,
        total DECIMAL(10,2) NOT NULL,
        almacenId INT,
        fecha DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY(id)
      ) ENGINE=InnoDB;
    `);
    console.log('Tabla facturas verificada/creada.');
    await Usuario.sync({ alter: true });
    await Producto.sync({ alter: true });
    // Asegurar la tabla de empresas
    const Empresa = require('../models/Empresa');
    await Empresa.sync({ alter: true });
    // Asegurar la tabla intermedia producto_almacen
    await ProductoAlmacen.sync({ alter: true });
    await Venta.sync({ alter: true });
    await DetalleVenta.sync({ alter: true });
    console.log('Tablas sincronizadas correctamente.');
  } catch (error) {
    console.error('Error al sincronizar las tablas:', error);
  } finally {
    await sequelize.close();
  }
}

syncAll();
