const express = require('express');
const router = express.Router();
const Usuario = require('../models/Usuario');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Op } = require('sequelize');
const sequelize = require('../database/sequelize');

if (!process.env.JWT_SECRET) {
  console.error("Falta JWT_SECRET en .env");
  process.exit(1);
}
if (!process.env.REFRESH_SECRET) {
  console.error("Falta REFRESH_SECRET en .env");
  process.exit(1);
}

const JWT_SECRET = process.env.JWT_SECRET;
const REFRESH_SECRET = process.env.REFRESH_SECRET;

// Login
router.post('/login', async (req, res) => {
  const { correo, password, usuario: reqUsuario, username, contrasena, clave } = req.body || {};
  const identifier = (correo || reqUsuario || username || '').trim();
  const rawPassword = password || contrasena || clave || '';
  const trimmedPassword = rawPassword.trim();

  try {
    let usuario;
    try {
      const lower = identifier.toLowerCase();
      const searchConditions = [
        sequelize.where(sequelize.fn('LOWER', sequelize.col('Usuario.correo')), lower),
        sequelize.where(sequelize.fn('LOWER', sequelize.col('Usuario.nombre')), lower)
      ];
      if (lower === 'admin' || lower === 'administrador') {
        searchConditions.push({ correo: 'admin@admin.com' });
        searchConditions.push({ rol: 'admin' });
      }

      usuario = await Usuario.findOne({ 
        where: {
          [Op.or]: searchConditions
        }, 
        include: [{ association: 'almacen' }] 
      });
    } catch (dbErr) {
      console.error('DB error en Usuario.findOne:', {
        name: dbErr && dbErr.name,
        message: dbErr && dbErr.message,
        sql: dbErr && (dbErr.sql || dbErr.sqlMessage)
      });
      throw dbErr;
    }
    if (!usuario) return res.status(401).json({ error: 'Credenciales incorrectas' });
    if (usuario.activo === false || usuario.activo === 0) {
      return res.status(403).json({ error: 'Su cuenta de usuario se encuentra desactivada. Contacte al administrador.' });
    }

    const isValidPassword = Boolean(
      usuario.password && (
        (await bcrypt.compare(rawPassword, usuario.password)) ||
        (await bcrypt.compare(trimmedPassword, usuario.password)) ||
        (await bcrypt.compare(rawPassword.toLowerCase(), usuario.password)) ||
        (await bcrypt.compare(trimmedPassword.toLowerCase(), usuario.password))
      )
    );

    if (!isValidPassword) {
      return res.status(401).json({ error: 'Credenciales incorrectas' });
    }
    // Actualizar último acceso
    usuario.ultimoAcceso = new Date();
    const almacen = usuario.almacen ? {
      id: usuario.almacen.id,
      nombre: usuario.almacen.nombre,
      ubicacion: usuario.almacen.ubicacion
    } : null;
    const token = jwt.sign({
      id: usuario.id,
      rol: usuario.rol,
      nombre: usuario.nombre,
      correo: usuario.correo,
      almacenId: usuario.almacenId,
      almacenNombre: almacen ? almacen.nombre : null,
      almacen: almacen
    }, JWT_SECRET, { expiresIn: '8h' });
    // Crear refresh token y guardarlo en la BD
    const refreshToken = jwt.sign({ id: usuario.id }, REFRESH_SECRET, { expiresIn: '7d' });
    usuario.refreshToken = refreshToken;
    await usuario.save();
    res.json({
      token,
      refreshToken,
      nombre: usuario.nombre,
      rol: usuario.rol,
      correo: usuario.correo,
      almacenId: usuario.almacenId,
      almacen: almacen
    });
  } catch (err) {
    console.error('Error en /auth/login:', err && err.stack ? err.stack : err);
    res.status(500).json({ error: 'Error en login' });
  }
});

// Refresh token endpoint
router.post('/refresh', async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(400).json({ error: 'refreshToken requerido' });
  try {
    const payload = jwt.verify(refreshToken, REFRESH_SECRET);
    const usuario = await Usuario.findByPk(payload.id);
    if (!usuario || usuario.refreshToken !== refreshToken) return res.status(401).json({ error: 'Refresh token inválido' });
    const newToken = jwt.sign({ id: usuario.id, rol: usuario.rol, nombre: usuario.nombre, correo: usuario.correo, almacenId: usuario.almacenId }, JWT_SECRET, { expiresIn: '8h' });
    const newRefresh = jwt.sign({ id: usuario.id }, REFRESH_SECRET, { expiresIn: '7d' });
    usuario.refreshToken = newRefresh;
    await usuario.save();
    res.json({ token: newToken, refreshToken: newRefresh });
  } catch (err) {
    console.error('Error en /auth/refresh:', err && err.stack ? err.stack : err);
    res.status(401).json({ error: 'Refresh token inválido' });
  }
});

// Logout endpoint: borrar refresh token
router.post('/logout', async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(400).json({ error: 'refreshToken requerido' });
  try {
    const payload = jwt.verify(refreshToken, REFRESH_SECRET);
    const usuario = await Usuario.findByPk(payload.id);
    if (usuario) {
      usuario.refreshToken = null;
      await usuario.save();
    }
    res.json({ ok: true });
  } catch (err) {
    console.error('Error en /auth/logout:', err && err.stack ? err.stack : err);
    res.status(400).json({ error: 'Logout fallido' });
  }
});

// Middleware para verificar token y rol
function authRole(roles = []) {
  return (req, res, next) => {
    const auth = req.headers.authorization;
    if (!auth) return res.status(401).json({ error: 'No autenticado' });
    const token = auth.split(' ')[1];
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = decoded;
      if (roles.length && !roles.includes(decoded.rol)) {
        return res.status(403).json({ error: 'Sin permisos' });
      }
      next();
    } catch {
      res.status(401).json({ error: 'Token inválido' });
    }
  };
}

// Middleware para verificar solo token (sin roles)
function authToken(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: 'No autenticado' });
  const token = auth.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ error: 'Token inválido' });
  }
}

module.exports = router; 
module.exports.authRole = authRole; 
module.exports.authToken = authToken;
