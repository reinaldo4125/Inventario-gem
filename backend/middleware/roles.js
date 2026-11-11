const { tienePermiso } = require('../config/permisos');

/**
 * Middleware que verifica si el usuario autenticado tiene un permiso específico
 * @param {string|string[]} permiso - Permiso requerido o array de permisos alternativos
 */
function requirePermiso(permiso) {
  return (req, res, next) => {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: 'No autenticado' });
    }

    if (!tienePermiso(user.rol, permiso)) {
      const permisoStr = Array.isArray(permiso) ? permiso.join(' o ') : permiso;
      return res.status(403).json({ 
        error: `Acceso denegado: se requiere el permiso '${permisoStr}'`,
        codigo: 'PERMISO_DENEGADO',
        permisoRequerido: permiso
      });
    }

    next();
  };
}

/**
 * Compatibilidad hacia atrás para requireRole
 */
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    const user = req.user;
    if (!user) return res.status(401).json({ error: 'No autenticado' });
    if (allowedRoles.length === 0) return next();
    if (!allowedRoles.includes(user.rol)) {
      return res.status(403).json({ error: 'Acceso denegado' });
    }
    next();
  };
}

module.exports = requirePermiso;
module.exports.requirePermiso = requirePermiso;
module.exports.requireRole = requireRole;
