const express = require('express');
const { body, validationResult } = require('express-validator');
const router = express.Router();
const Usuario = require('../models/Usuario');
const bcrypt = require('bcryptjs');
const auth = require('../middleware/auth');
const requireRole = require('../middleware/roles');

// Editar un usuario por ID
router.put('/:id', auth, requireRole('admin'), [
  body('nombre').notEmpty().withMessage('El nombre es obligatorio'),
  body('correo').isEmail().withMessage('Correo inválido'),
  body('rol').notEmpty().withMessage('El rol es obligatorio'),
  body('almacenId').optional({ nullable: true }).isInt().withMessage('El almacén debe ser un número entero'),
  body('password').optional({ checkFalsy: true }).isLength({ min: 6 }).withMessage('La contraseña debe tener al menos 6 caracteres'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  try {
    const id = req.params.id;
    const { nombre, correo, rol, almacenId, password, activo, telefono, documento, cargo, direccion, comision, notas } = req.body;

    // Verificar si el correo ya está en uso por otro usuario
    const correoExiste = await Usuario.findOne({ where: { correo } });
    if (correoExiste && correoExiste.id !== Number(id)) {
      return res.status(400).json({ error: 'El correo electrónico ya está registrado por otro usuario.' });
    }

    const updateData = { nombre, correo, rol };
    if (typeof almacenId !== 'undefined') updateData.almacenId = almacenId || null;
    if (typeof activo !== 'undefined') updateData.activo = activo;
    if (typeof telefono !== 'undefined') updateData.telefono = telefono;
    if (typeof documento !== 'undefined') updateData.documento = documento;
    if (typeof cargo !== 'undefined') updateData.cargo = cargo;
    if (typeof direccion !== 'undefined') updateData.direccion = direccion;
    if (typeof comision !== 'undefined') updateData.comision = comision ? parseFloat(comision) : 0;
    if (typeof notas !== 'undefined') updateData.notas = notas;
    if (password && password.trim() !== '') updateData.password = await bcrypt.hash(password, 10);
    const [actualizado] = await Usuario.update(updateData, { where: { id } });
    if (actualizado) {
      const usuarioActualizado = await Usuario.findByPk(id, { attributes: { exclude: ['password'] } });
      res.json(usuarioActualizado);
    } else {
      res.status(404).json({ error: 'Usuario no encontrado' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Error al actualizar usuario: ' + error.message });
  }
});

// Obtener todos los usuarios
router.get('/', auth, requireRole('admin'), async (req, res) => {
  try {
    const usuarios = await Usuario.findAll({
      attributes: { exclude: ['password'] },
      include: [{
        association: 'almacen',
        attributes: ['id', 'nombre']
      }]
    });
    // Formatear para incluir almacenNombre directo
    const usuariosConAlmacen = usuarios.map(u => ({
      ...u.toJSON(),
      almacenNombre: u.almacen ? u.almacen.nombre : null
    }));
    res.json(usuariosConAlmacen);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener usuarios' });
  }
});

// Crear un nuevo usuario (solo admin)
router.post('/', auth, requireRole('admin'), [
  body('nombre').notEmpty().withMessage('El nombre es obligatorio'),
  body('correo').isEmail().withMessage('Correo inválido'),
  body('rol').notEmpty().withMessage('El rol es obligatorio'),
  body('almacenId').optional({ nullable: true }).isInt().withMessage('El almacén debe ser un número entero'),
  body('password').isLength({ min: 6 }).withMessage('La contraseña debe tener al menos 6 caracteres'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  try {
    const { nombre, correo, rol, almacenId, password, activo, telefono, documento, cargo, direccion, comision, notas } = req.body;
    
    // Verificar si el correo ya existe
    const existe = await Usuario.findOne({ where: { correo } });
    if (existe) {
      return res.status(400).json({ error: 'El correo electrónico ya se encuentra registrado.' });
    }

    const hash = await bcrypt.hash(password, 10);
    const nuevoUsuario = await Usuario.create({
      nombre,
      correo,
      rol,
      almacenId: almacenId || null,
      telefono: telefono || '',
      documento: documento || '',
      cargo: cargo || '',
      direccion: direccion || '',
      comision: comision ? parseFloat(comision) : 0,
      notas: notas || '',
      activo: typeof activo !== 'undefined' ? activo : true,
      password: hash
    });
    res.status(201).json({ 
      id: nuevoUsuario.id, 
      nombre, 
      correo, 
      rol, 
      almacenId, 
      activo: nuevoUsuario.activo, 
      telefono: nuevoUsuario.telefono,
      documento: nuevoUsuario.documento,
      cargo: nuevoUsuario.cargo,
      direccion: nuevoUsuario.direccion,
      comision: nuevoUsuario.comision,
      notas: nuevoUsuario.notas
    });
  } catch (error) {
    res.status(500).json({ error: 'Error al crear usuario: ' + error.message });
  }
});

// Cambiar estado activo/inactivo rápidamente
router.patch('/:id/toggle-estado', auth, requireRole('admin'), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (req.user && req.user.id === id) {
      return res.status(400).json({ error: 'No puede desactivar su propia cuenta en sesión activa.' });
    }
    const usuario = await Usuario.findByPk(id);
    if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' });

    usuario.activo = !usuario.activo;
    await usuario.save();
    res.json({ mensaje: `Usuario ${usuario.activo ? 'activado' : 'desactivado'} correctamente`, activo: usuario.activo });
  } catch (error) {
    res.status(500).json({ error: 'Error al cambiar estado del usuario' });
  }
});

// Eliminar un usuario por ID (solo admin)
router.delete('/:id', auth, requireRole('admin'), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (req.user && req.user.id === id) {
      return res.status(400).json({ error: 'No puede eliminar su propia cuenta de usuario en sesión activa.' });
    }

    const eliminado = await Usuario.destroy({ where: { id } });
    if (eliminado) {
      res.json({ mensaje: 'Usuario eliminado correctamente' });
    } else {
      res.status(404).json({ error: 'Usuario no encontrado' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Error al eliminar usuario' });
  }
});

module.exports = router;
