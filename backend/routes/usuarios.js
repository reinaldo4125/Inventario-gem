const express = require('express');
const { body, validationResult } = require('express-validator');
const router = express.Router();
const Usuario = require('../models/Usuario');
const bcrypt = require('bcryptjs');
const auth = require('../middleware/auth');
const requirePermiso = require('../middleware/roles');
const { Op } = require('sequelize');

// Editar un usuario por ID
router.put('/:id', auth, requirePermiso('usuarios.gestionar_vendedores'), [
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
    const id = Number(req.params.id);
    let { nombre, correo, rol, almacenId, password, activo, telefono, documento, cargo, direccion, comision, notas } = req.body;

    const targetUser = await Usuario.findByPk(id);
    if (!targetUser) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    // Reglas de seguridad para admin_pos
    if (req.user.rol === 'admin_pos') {
      // Si se edita a sí mismo, no puede cambiarse el rol ni el almacén
      if (Number(id) === req.user.id) {
        if (rol && rol !== targetUser.rol) {
          return res.status(403).json({ error: 'No puede modificar su propio rol' });
        }
        almacenId = req.user.almacenId;
      } else {
        // Solo puede editar usuarios con rol 'vendedor' de su misma sede
        if (targetUser.rol !== 'vendedor') {
          return res.status(403).json({ error: 'Solo puede modificar usuarios con rol vendedor' });
        }
        if (targetUser.almacenId !== req.user.almacenId) {
          return res.status(403).json({ error: 'No puede modificar usuarios pertenecientes a otra sede' });
        }
        if (rol && rol !== 'vendedor') {
          return res.status(403).json({ error: 'Solo puede asignar el rol vendedor' });
        }
        almacenId = req.user.almacenId;
      }
    }

    // Verificar si el correo ya está en uso por otro usuario
    const correoExiste = await Usuario.findOne({ where: { correo } });
    if (correoExiste && correoExiste.id !== id) {
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

// Obtener usuarios (admin ve todos; admin_pos ve los de su almacén)
router.get('/', auth, requirePermiso('usuarios.gestionar_vendedores'), async (req, res) => {
  try {
    const whereCondition = {};
    if (req.user.rol === 'admin_pos') {
      whereCondition.almacenId = req.user.almacenId;
      whereCondition.rol = { [Op.ne]: 'admin' };
    }

    const usuarios = await Usuario.findAll({
      where: whereCondition,
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

// Crear un nuevo usuario (admin o admin_pos para vendedores de su sede)
router.post('/', auth, requirePermiso('usuarios.gestionar_vendedores'), [
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
    let { nombre, correo, rol, almacenId, password, activo, telefono, documento, cargo, direccion, comision, notas } = req.body;
    
    // Reglas para admin_pos
    if (req.user.rol === 'admin_pos') {
      if (rol !== 'vendedor') {
        return res.status(403).json({ error: 'Solo puede crear usuarios con rol vendedor' });
      }
      // Forzar que el nuevo usuario quede en el almacén del admin_pos
      almacenId = req.user.almacenId;
    }

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

// Cambiar estado activo/inactivo
router.patch('/:id/toggle-estado', auth, requirePermiso('usuarios.gestionar_vendedores'), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (req.user && req.user.id === id) {
      return res.status(400).json({ error: 'No puede desactivar su propia cuenta en sesión activa.' });
    }
    const usuario = await Usuario.findByPk(id);
    if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' });

    if (req.user.rol === 'admin_pos') {
      if (usuario.rol !== 'vendedor') {
        return res.status(403).json({ error: 'Solo puede modificar usuarios con rol vendedor' });
      }
      if (usuario.almacenId !== req.user.almacenId) {
        return res.status(403).json({ error: 'No puede alterar usuarios de otra sede' });
      }
    }

    usuario.activo = !usuario.activo;
    await usuario.save();
    res.json({ mensaje: `Usuario ${usuario.activo ? 'activado' : 'desactivado'} correctamente`, activo: usuario.activo });
  } catch (error) {
    res.status(500).json({ error: 'Error al cambiar estado del usuario' });
  }
});

// Eliminar un usuario por ID (admin o admin_pos dentro de su sede)
router.delete('/:id', auth, requirePermiso('usuarios.gestionar_vendedores'), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (req.user && req.user.id === id) {
      return res.status(400).json({ error: 'No puede eliminar su propia cuenta de usuario en sesión activa.' });
    }

    const usuario = await Usuario.findByPk(id);
    if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' });

    if (req.user.rol === 'admin_pos') {
      if (usuario.rol !== 'vendedor') {
        return res.status(403).json({ error: 'Solo puede eliminar usuarios con rol vendedor' });
      }
      if (usuario.almacenId !== req.user.almacenId) {
        return res.status(403).json({ error: 'No puede eliminar usuarios de otra sede' });
      }
    }

    await usuario.destroy();
    res.json({ mensaje: 'Usuario eliminado correctamente' });
  } catch (error) {
    res.status(500).json({ error: 'Error al eliminar usuario' });
  }
});

module.exports = router;
