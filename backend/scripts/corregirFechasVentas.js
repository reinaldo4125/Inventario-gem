/**
 * Script para corregir ventas y facturas cuya hora sea exactamente 00:00:00,
 * actualizándolas a la misma fecha con hora '12:00:00'.
 * 
 * Uso: node backend/scripts/corregirFechasVentas.js
 * NOTA: Muestra la cantidad de registros a modificar y pide confirmación interactiva antes de guardar.
 */

const path = require('path');
const readline = require('readline');

// Cargar variables de entorno desde .env si existe en backend o en la raíz
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const sequelize = require('../database/sequelize');

function extraerFechaYFormatearMediodia(fechaVal) {
  if (!fechaVal) return null;
  const str = String(fechaVal);
  // Extraer YYYY-MM-DD
  const ymd = str.slice(0, 10);
  return `${ymd} 12:00:00`;
}

async function main() {
  try {
    console.log('=====================================================');
    console.log('   CORRECCIÓN DE FECHAS (HORA 00:00:00 -> 12:00:00)  ');
    console.log('=====================================================\n');

    await sequelize.authenticate();
    console.log('✓ Conectado a la base de datos correctamente.\n');

    console.log('Buscando ventas y facturas con SQL directo donde TIME(fecha) = \'00:00:00\'...');
    const [ventasACorregir] = await sequelize.query(`
      SELECT id, fecha FROM ventas 
      WHERE TIME(fecha) = '00:00:00'
    `);

    const [facturasACorregir] = await sequelize.query(`
      SELECT id, fecha FROM facturas 
      WHERE TIME(fecha) = '00:00:00'
    `);

    console.log(`\nResultados del análisis:`);
    console.log(`  - Ventas con TIME(fecha) = '00:00:00':    ${ventasACorregir.length}`);
    console.log(`  - Facturas con TIME(fecha) = '00:00:00':  ${facturasACorregir.length}`);

    if (ventasACorregir.length === 0 && facturasACorregir.length === 0) {
      console.log('\n✓ No se encontraron registros con hora 00:00:00. Todo está al día.');
      await sequelize.close();
      process.exit(0);
    }

    // Mostrar una muestra de hasta 5 registros si existen
    if (ventasACorregir.length > 0) {
      console.log('\nEjemplo de ventas a actualizar:');
      ventasACorregir.slice(0, 5).forEach(v => {
        const nueva = extraerFechaYFormatearMediodia(v.fecha);
        console.log(`  Venta ID #${v.id}: Fecha actual=${v.fecha} -> Nueva fecha=${nueva}`);
      });
    }

    if (facturasACorregir.length > 0) {
      console.log('\nEjemplo de facturas a actualizar:');
      facturasACorregir.slice(0, 5).forEach(f => {
        const nueva = extraerFechaYFormatearMediodia(f.fecha);
        console.log(`  Factura ID #${f.id}: Fecha actual=${f.fecha} -> Nueva fecha=${nueva}`);
      });
    }

    // Solicitar confirmación interactiva
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    rl.question(`\n¿Desea aplicar estos cambios en la base de datos? (s/N): `, async (respuesta) => {
      const resp = (respuesta || '').trim().toLowerCase();
      if (resp === 's' || resp === 'si' || resp === 'y' || resp === 'yes') {
        console.log('\nAplicando correcciones en transacción...');
        const t = await sequelize.transaction();
        try {
          let ventasActualizadas = 0;
          for (const v of ventasACorregir) {
            const nuevaFecha = extraerFechaYFormatearMediodia(v.fecha);
            await sequelize.query(
              'UPDATE ventas SET fecha = :nuevaFecha WHERE id = :id',
              { replacements: { nuevaFecha, id: v.id }, transaction: t }
            );
            ventasActualizadas++;
          }

          let facturasActualizadas = 0;
          for (const f of facturasACorregir) {
            const nuevaFecha = extraerFechaYFormatearMediodia(f.fecha);
            await sequelize.query(
              'UPDATE facturas SET fecha = :nuevaFecha WHERE id = :id',
              { replacements: { nuevaFecha, id: f.id }, transaction: t }
            );
            facturasActualizadas++;
          }

          await t.commit();
          console.log(`\n✓ Éxito: Se actualizaron ${ventasActualizadas} ventas y ${facturasActualizadas} facturas a las 12:00:00.`);
        } catch (updateError) {
          await t.rollback();
          console.error('\n✗ Error al actualizar registros. Se realizó rollback:', updateError.message);
        }
      } else {
        console.log('\n✕ Operación cancelada. No se realizó ningún cambio en la base de datos.');
      }

      rl.close();
      await sequelize.close();
      process.exit(0);
    });

  } catch (error) {
    console.error('\n✗ Error durante la ejecución:', error);
    try { await sequelize.close(); } catch (_) {}
    process.exit(1);
  }
}

main();
