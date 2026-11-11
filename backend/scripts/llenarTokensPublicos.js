const crypto = require('crypto');
const sequelize = require('../database/sequelize');
const Venta = require('../models/Venta');
const Factura = require('../models/Factura');
const Abono = require('../models/Abono');

async function llenarTokensPublicos() {
  console.log('[llenarTokensPublicos] Verificando columnas y actualizando tokens...');
  try {
    // Asegurar que las columnas existan en la base de datos
    try { await sequelize.query("ALTER TABLE ventas ADD COLUMN token_publico VARCHAR(64);"); } catch (e) {}
    try { await sequelize.query("ALTER TABLE facturas ADD COLUMN token_publico VARCHAR(64);"); } catch (e) {}
    try { await sequelize.query("ALTER TABLE abonos ADD COLUMN token_publico VARCHAR(64);"); } catch (e) {}

    // Llenar Ventas sin token
    const ventas = await Venta.findAll({ where: { token_publico: null } });
    for (const v of ventas) {
      v.token_publico = crypto.randomUUID();
      await v.save();
    }
    console.log(`[llenarTokensPublicos] Tokens asignados a ${ventas.length} ventas.`);

    // Llenar Facturas sin token
    const facturas = await Factura.findAll({ where: { token_publico: null } });
    for (const f of facturas) {
      f.token_publico = crypto.randomUUID();
      await f.save();
    }
    console.log(`[llenarTokensPublicos] Tokens asignados a ${facturas.length} facturas.`);

    // Llenar Abonos sin token
    const abonos = await Abono.findAll({ where: { token_publico: null } });
    for (const a of abonos) {
      a.token_publico = crypto.randomUUID();
      await a.save();
    }
    console.log(`[llenarTokensPublicos] Tokens asignados a ${abonos.length} abonos.`);

    console.log('[llenarTokensPublicos] Proceso completado exitosamente.');
  } catch (err) {
    console.error('[llenarTokensPublicos] Error llenando tokens:', err);
  }
}

if (require.main === module) {
  llenarTokensPublicos().then(() => {
    process.exit(0);
  }).catch(err => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = llenarTokensPublicos;
