/* Seed script for test DB: creates an almacen and two users (admin and vendedor)
   Usage: NODE_ENV=test node backend/scripts/seed_test_db.js
*/
const bcrypt = require('bcryptjs');
const sequelize = require('../database/sequelize');
const { Almacen, Usuario } = require('../models');

async function run() {
  try {
    console.log('Conectando a la BD...');
    await sequelize.authenticate();
    console.log('Conectado. Creando seed...');

    const [almacen] = await Almacen.findOrCreate({ where: { nombre: 'Almacen Test' }, defaults: { nombre: 'Almacen Test', ubicacion: 'Local' } });

    const passwordAdmin = await bcrypt.hash('admin123', 10);
    const passwordVendedor = await bcrypt.hash('vendedor123', 10);

    const [admin] = await Usuario.findOrCreate({
      where: { correo: 'admin@test.local' },
      defaults: { nombre: 'Admin Test', correo: 'admin@test.local', password: passwordAdmin, rol: 'admin', almacenId: null }
    });

    const [vendedor] = await Usuario.findOrCreate({
      where: { correo: 'vendedor@test.local' },
      defaults: { nombre: 'Vendedor Test', correo: 'vendedor@test.local', password: passwordVendedor, rol: 'vendedor', almacenId: almacen.id }
    });

    console.log('Seed creado: almacenId=', almacen.id, 'adminId=', admin.id, 'vendedorId=', vendedor.id);
    process.exit(0);
  } catch (err) {
    console.error('Error seed:', err && err.stack ? err.stack : err);
    process.exit(1);
  }
}

run();
