/**
 * Centralización de Roles y Permisos en el Frontend.
 * 
 * ROLES DISPONIBLES:
 * - 'admin': Administrador General (acceso total '*')
 * - 'admin_pos': Administrador de Punto / Sede
 * - 'vendedor': Vendedor
 * - 'almacen': Encargado de Almacén
 */

export const PERMISOS_POR_ROL = {
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

export const NOMBRES_ROLES = {
  admin: 'Administrador General',
  admin_pos: 'Administrador de Punto',
  vendedor: 'Vendedor',
  almacen: 'Encargado de Almacén'
};

export function nombreRol(rol) {
  return NOMBRES_ROLES[rol] || rol || 'Sin rol';
}

/**
 * Verifica si un usuario tiene un permiso específico
 * @param {object|string} usuario - Objeto usuario o string del rol
 * @param {string|string[]} permiso - Permiso requerido o array de permisos alternativos
 * @returns {boolean}
 */
export function puede(usuario, permiso) {
  if (!usuario || !permiso) return false;
  const rol = typeof usuario === 'string' ? usuario : (usuario.rol || usuario.role);
  if (!rol) return false;
  if (rol === 'admin') return true;

  const permisos = PERMISOS_POR_ROL[rol] || [];
  if (permisos.includes('*')) return true;

  if (Array.isArray(permiso)) {
    return permiso.some(p => permisos.includes(p));
  }
  return permisos.includes(permiso);
}

export default puede;
