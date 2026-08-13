module.exports = function requireRole(...allowedRoles) {
  return (req, res, next) => {
    const user = req.user;
    if (!user) return res.status(401).json({ error: 'No autenticado' });
    if (allowedRoles.length === 0) return next();
    if (!allowedRoles.includes(user.rol)) {
      return res.status(403).json({ error: 'Acceso denegado' });
    }
    next();
  };
};
