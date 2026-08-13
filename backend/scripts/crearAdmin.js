const bcrypt = require('bcryptjs');
const Usuario = require('../models/Usuario');

async function crearAdmin() {
  const nombre = 'Administrador';
  const correo = 'admin@admin.com';
  const rol = 'admin';
  const password = 'admin123';
  const hash = await bcrypt.hash(password, 10);
  try {
    const existe = await Usuario.findOne({ where: { correo } });
    if (existe) {
      console.log('El usuario admin ya existe');
      return;
    }
    await Usuario.create({ nombre, correo, rol, password: hash });
    console.log('Usuario admin creado:', correo, password);
  } catch (err) {
    console.error('Error creando admin:', err);
  }
}

crearAdmin();
