const bcrypt = require('bcryptjs');
const Usuario = require('../models/Usuario');

async function setPass() {
  const newPass = process.env.NEW_PASS || 'adminReset123!';
  const correo = 'admin@admin.com';
  try {
    const hash = await bcrypt.hash(newPass, 10);
    let user = await Usuario.findOne({ where: { correo } });
    if (!user) {
      user = await Usuario.create({ nombre: 'Administrador', correo, rol: 'admin', password: hash });
      console.log('Usuario admin creado:', correo, newPass);
    } else {
      user.password = hash;
      await user.save();
      console.log('Password actualizado para', correo, '->', newPass);
    }
  } catch (err) {
    console.error('Error al crear/actualizar admin:', err && err.stack ? err.stack : err);
    process.exit(1);
  }
  process.exit(0);
}

setPass();
