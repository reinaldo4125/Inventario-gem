/**
 * Centralización de Roles y Permisos de la aplicación.
 * 
 * ROLES DISPONIBLES:
 * - 'admin': Administrador General (acceso total '*')
 * - 'admin_pos': Administrador de Punto / Sede
 * - 'vendedor': Vendedor
 * - 'almacen': Encargado de Almacén
 */

const PERMISOS_POR_ROL = {
  admin: ['*'],

  admin_pos: [
    'dashboard.ver',
    'ventas.crear',
    'ventas.cobrar',
    'ventas.anular',
    'facturas.crear',
    'facturas.anular',
    'caja.operar',
    'caja.historial',
    'cartera.ver',
    'cartera.abonar',
    'clientes.crear',
    'clientes.editar',
    'productos.ver',
    'stock.ajustar',
    'traslados.crear',
    'traslados.recibir',
    'kardex.ver',
    'reportes.ver',
    'usuarios.gestionar_vendedores'
  ],

  vendedor: [
    'dashboard.ver',
    'ventas.crear',
    'ventas.cobrar',
    'facturas.crear',
    'caja.operar',
    'cartera.abonar',
    'clientes.crear',
    'clientes.editar',
    'productos.ver',
    'reportes.ver_propios'
  ],

  almacen: [
    'dashboard.stock',
    'productos.ver',
    'stock.ajustar',
    'traslados.crear',
    'traslados.recibir',
    'kardex.ver'
  ]
};

/**
 * Verifica si un rol tiene un permiso asignado
 * @param {string} rol 
 * @param {string|string[]} permiso - Puede ser un permiso o un array de permisos (basta tener uno)
 * @returns {boolean}
 */
function tienePermiso(rol, permiso) {
  if (!rol || !permiso) return false;
  if (rol === 'admin') return true;
  const permisos = PERMISOS_POR_ROL[rol] || [];
  if (permisos.includes('*')) return true;

  if (Array.isArray(permiso)) {
    return permiso.some(p => permisos.includes(p));
  }
  return permisos.includes(permiso);
}

module.exports = {
  PERMISOS_POR_ROL,
  tienePermiso
};
