const jwt = require('jsonwebtoken');
const { Usuario } = require('../models');

async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization || req.headers.Authorization;
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : (req.cookies && req.cookies.token);
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secreto123');
    // Refresh user from DB to ensure almacenId and role are current
    try {
      const dbUser = await Usuario.findByPk(decoded.id);
      if (!dbUser) return res.status(401).json({ error: 'Usuario no encontrado' });
      req.user = {
        id: dbUser.id,
        nombre: dbUser.nombre,
        rol: dbUser.rol,
        correo: dbUser.correo,
        almacenId: dbUser.almacenId
      };
    } catch (dbErr) {
      // If DB lookup fails, fallback to token payload but log warning
      console.warn('auth middleware DB lookup failed:', dbErr && dbErr.message ? dbErr.message : dbErr);
      req.user = {
        id: decoded.id,
        nombre: decoded.nombre,
        rol: decoded.rol,
        correo: decoded.correo,
        almacenId: decoded.almacenId
      };
    }
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

function authRole(roles = []) {
  return (req, res, next) => {
    authMiddleware(req, res, () => {
      if (roles.length && !roles.includes(req.user?.rol)) {
        return res.status(403).json({ error: 'Sin permisos' });
      }
      next();
    });
  };
}

module.exports = authMiddleware;
module.exports.authMiddleware = authMiddleware;
module.exports.authToken = authMiddleware;
module.exports.authRole = authRole;

