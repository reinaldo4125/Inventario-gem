/**
 * Script para auditar y listar productos con costo sospechoso (null, 0 o menor a 100 pesos).
 * NO MODIFICA LA BASE DE DATOS.
 * Muestra el reporte en consola y exporta los resultados a un archivo CSV.
 * 
 * Uso: node backend/scripts/costosSospechosos.js
 */

const path = require('path');
const fs = require('fs');

// Cargar variables de entorno
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const sequelize = require('../database/sequelize');
const { Producto } = require('../models');

async function main() {
  try {
    console.log('===========================================================');
    console.log('   AUDITORÍA DE PRODUCTOS CON COSTOS SOSPECHOSOS (<= 100)  ');
    console.log('===========================================================\n');

    await sequelize.authenticate();
    console.log('✓ Conectado a la base de datos.\n');

    const productos = await Producto.findAll({
      order: [['nombre', 'ASC']]
    });

    // Filtrar productos con costo null, 0 o < 100
    const sospechosos = productos.filter(p => {
      const c = p.costo !== null && p.costo !== undefined ? Number(p.costo) : null;
      return c === null || isNaN(c) || c === 0 || c < 100;
    });

    console.log(`Total productos evaluados: ${productos.length}`);
    console.log(`Productos con costo sospechoso (null, 0 o < 100 pesos): ${sospechosos.length}\n`);

    if (sospechosos.length === 0) {
      console.log('✓ Todos los productos tienen un costo válido asignado superior a 100 pesos.');
      await sequelize.close();
      process.exit(0);
    }

    // Mostrar tabla en consola (primeros 50 para legibilidad)
    console.log('--- Listado de Productos Sospechosos ---');
    console.table(
      sospechosos.slice(0, 50).map(p => ({
        ID: p.id,
        Nombre: (p.nombre || '').slice(0, 30),
        'Código OEM': p.codigo_oem || '-',
        Tipo: p.tipo || 'producto',
        Costo: p.costo !== null && p.costo !== undefined ? `$${Number(p.costo).toLocaleString('es-CO')}` : 'FALTA (NULL)',
        'Precio Venta': p.precio_detal || p.precio ? `$${Number(p.precio_detal || p.precio).toLocaleString('es-CO')}` : '$0',
        Activo: p.activo !== false ? 'Sí' : 'No'
      }))
    );

    if (sospechosos.length > 50) {
      console.log(`... y ${sospechosos.length - 50} productos más (ver listado completo en el archivo CSV generado).\n`);
    }

    // Exportar a archivo CSV
    const csvHeader = 'ID,Nombre,Codigo_OEM,Categoria,Tipo,Costo,Precio_Venta,Activo\n';
    const csvRows = sospechosos.map(p => {
      const escape = (str) => `"${String(str || '').replace(/"/g, '""')}"`;
      const id = p.id;
      const nombre = escape(p.nombre);
      const oem = escape(p.codigo_oem || '-');
      const cat = escape(p.categoria || '-');
      const tipo = escape(p.tipo || 'producto');
      const costo = p.costo !== null && p.costo !== undefined ? p.costo : 'NULL';
      const precioVenta = p.precio_detal || p.precio || 0;
      const activo = p.activo !== false ? '1' : '0';
      return `${id},${nombre},${oem},${cat},${tipo},${costo},${precioVenta},${activo}`;
    }).join('\n');

    const csvContent = csvHeader + csvRows;
    const outputPath = path.resolve(__dirname, 'costos_sospechosos.csv');
    fs.writeFileSync(outputPath, csvContent, 'utf-8');

    console.log('===========================================================');
    console.log(`✓ Archivo CSV exportado con éxito en:`);
    console.log(`  ${outputPath}`);
    console.log('===========================================================\n');

    await sequelize.close();
    process.exit(0);
  } catch (error) {
    console.error('✗ Error ejecutando auditoría de costos:', error);
    try { await sequelize.close(); } catch (_) {}
    process.exit(1);
  }
}

main();
