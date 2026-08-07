const bcrypt = require('bcryptjs');
require('dotenv').config();
const { Usuario } = require('../models');

async function main() {
  const newPass = process.argv[2] || process.env.NEW_PASS;
  if (!newPass) {
    console.error('Uso: node changeAdminPassword.js <nueva-contraseña>');
    process.exit(1);
  }
  const hash = await bcrypt.hash(newPass, 10);
  const usuario = await Usuario.findOne({ where: { correo: 'admin@admin.com' } });
  if (!usuario) {
    console.error('No se encontró usuario admin@admin.com');
    process.exit(1);
  }
  usuario.password = hash;
  await usuario.save();
  console.log('Contraseña actualizada para admin@admin.com');
  process.exit(0);
}

main().catch(err => {
  console.error('Error al cambiar contraseña:', err);
  process.exit(1);
});
