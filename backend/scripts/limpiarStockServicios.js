/**
 * Script para asegurar que ningún servicio tenga existencias en inventario.
 * Pone en 0 el stock en 'producto_almacen' y en 'productos' para todos los productos de tipo 'servicio'.
 * 
 * Uso: node backend/scripts/limpiarStockServicios.js
 */

const path = require('path');
const { Op } = require('sequelize');

// Cargar variables de entorno
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const sequelize = require('../database/sequelize');
const { Producto, ProductoAlmacen } = require('../models');

async function main() {
  try {
    console.log('===========================================================');
    console.log('     LIMPIEZA DE STOCK PARA SERVICIOS (TIPO = SERVICIO)     ');
    console.log('===========================================================\n');

    await sequelize.authenticate();
    console.log('✓ Conectado a la base de datos.\n');

    // Buscar todos los productos que son de tipo servicio
    const servicios = await Producto.findAll({
      where: {
        [Op.or]: [
          { tipo: 'servicio' },
          sequelize.where(sequelize.fn('LOWER', sequelize.col('categoria')), 'LIKE', '%servicio%')
        ]
      }
    });

    console.log(`Total de servicios identificados: ${servicios.length}`);

    if (servicios.length === 0) {
      console.log('No se encontraron productos registrados como servicio.');
      await sequelize.close();
      process.exit(0);
    }

    const servicioIds = servicios.map(s => s.id);

    // 1. Poner en 0 el stock en producto_almacen
    const [filasAlmacenAfectadas] = await ProductoAlmacen.update(
      { stock: 0 },
      {
        where: {
          productoId: { [Op.in]: servicioIds },
          stock: { [Op.ne]: 0 }
        }
      }
    );

    // 2. Poner en 0 el stock en la tabla productos si existe la columna stock
    let filasProductosAfectadas = 0;
    try {
      const [resProd] = await Producto.update(
        { stock: 0 },
        {
          where: {
            id: { [Op.in]: servicioIds }
          }
        }
      );
      filasProductosAfectadas = resProd;
    } catch (e) {
      // Ignorar si la tabla productos no maneja columna stock directamente
    }

    console.log('--- Resumen de la operación ---');
    console.log(`• Servicios actualizados: ${servicios.length}`);
    console.log(`• Registros de almacén reseteados a stock 0: ${filasAlmacenAfectadas}`);
    console.log(`• Registros de productos reseteados: ${filasProductosAfectadas}\n`);

    console.log('✓ Limpieza completada con éxito. Ningún servicio cuenta ahora con existencias.');

    await sequelize.close();
    process.exit(0);
  } catch (error) {
    console.error('✗ Error ejecutando limpieza de stock de servicios:', error);
    try { await sequelize.close(); } catch (_) {}
    process.exit(1);
  }
}

main();
