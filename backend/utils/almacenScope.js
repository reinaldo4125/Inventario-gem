const { tienePermiso } = require('../config/permisos');

/**
 * Determina el almacén correspondiente a la solicitud según el rol del usuario:
 * - Para 'admin': devuelve req.query.almacenId (o null = todas las sedes).
 * - Para cualquier otro rol: devuelve SIEMPRE req.user.almacenId e IGNORE req.query.almacenId.
 * - Si un usuario no admin no tiene almacén asignado, responde 403 "Usuario sin sede asignada".
 * 
 * @param {object} req - Objeto Express Request
 * @param {object} [res] - Objeto Express Response opcional para enviar 403 directamente
 * @returns {number|null|undefined} ID del almacén, null para todas, o undefined si falló con respuesta enviada
 */
function almacenDelUsuario(req, res) {
  const user = req.user;
  if (!user) {
    if (res && !res.headersSent) {
      res.status(401).json({ error: 'No autenticado' });
    }
    return undefined;
  }

  // Administrador Global: puede filtrar por query o ver todas (null)
  if (user.rol === 'admin') {
    const q = req.query ? (req.query.almacenId || req.query.almacen) : null;
    if (q && q !== 'Todos' && q !== 'todas' && !isNaN(Number(q))) {
      return parseInt(q, 10);
    }
    return null; // Todas las sedes
  }

  // Cualquier otro rol (admin_pos, vendedor, almacen): SIEMPRE su sede asignada
  if (!user.almacenId) {
    if (res && !res.headersSent) {
      res.status(403).json({ error: 'Usuario sin sede asignada' });
    } else {
      const err = new Error('Usuario sin sede asignada');
      err.status = 403;
      throw err;
    }
    return undefined;
  }

  return parseInt(user.almacenId, 10);
}

/**
 * Sanitiza productos o reportes eliminando costo, precio_almacen y ganancia si el usuario
 * no tiene el permiso 'costos.ver'.
 * 
 * @param {object|array} data 
 * @param {object} user 
 * @returns {object|array}
 */
function sanitizarCostos(data, user) {
  if (!data) return data;
  const canSeeCosts = user && tienePermiso(user.rol, 'costos.ver');
  if (canSeeCosts) return data;

  const camposOcultos = [
    'costo',
    'precio_almacen',
    'ganancia',
    'gananciaTotal',
    'ganancia_neta',
    'margen',
    'margen_ganancia',
    'total_costo',
    'costoTotal',
    'costo_total',
    'utilidad'
  ];

  const limpiarObjeto = (obj) => {
    if (!obj || typeof obj !== 'object') return obj;
    // Si es instancia de Sequelize
    const plain = typeof obj.toJSON === 'function' ? obj.toJSON() : { ...obj };

    for (const c of camposOcultos) {
      delete plain[c];
    }

    if (plain.Producto) {
      plain.Producto = limpiarObjeto(plain.Producto);
    }
    if (plain.producto) {
      plain.producto = limpiarObjeto(plain.producto);
    }
    if (Array.isArray(plain.productos)) {
      plain.productos = plain.productos.map(limpiarObjeto);
    }
    if (Array.isArray(plain.DetalleVentas)) {
      plain.DetalleVentas = plain.DetalleVentas.map(limpiarObjeto);
    }
    if (Array.isArray(plain.DetalleFacturas)) {
      plain.DetalleFacturas = plain.DetalleFacturas.map(limpiarObjeto);
    }

    return plain;
  };

  if (Array.isArray(data)) {
    return data.map(limpiarObjeto);
  }
  return limpiarObjeto(data);
}

module.exports = {
  almacenDelUsuario,
  sanitizarCostos
};
