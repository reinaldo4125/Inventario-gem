const { Op } = require('sequelize');
const { Producto, ProductoAlmacen, Almacen, Kardex } = require('../models');
const sequelize = require('../database/sequelize');

/**
 * Función unificada para obtener los productos en alerta de stock crítico
 * según la REGLA ÚNICA de negocio:
 * 
 * 1. No aplica a servicios (tipo = 'servicio' ni categoría que incluya 'servicio')
 *    ni a productos inactivos (activo === false o 0).
 * 2. Stock del producto = suma de producto_almacen.stock de todas las sedes.
 *    (NO se usa la columna productos.stock).
 * 3. Si stock_minimo es null o 0, el producto NO genera alerta de "bajo mínimo",
 *    solo de "agotado" cuando su stock total es <= 0.
 * 4. Si stock_minimo > 0: alerta cuando stock total <= stock_minimo.
 * 5. Por sede: un producto cuenta en una sede solo si esa sede ha tenido
 *    existencias de él alguna vez (stock actual > 0 o al menos un movimiento
 *    en Kardex para ese producto y almacén). Las filas de producto_almacen con
 *    stock 0 que se crean automáticamente al registrar un producto NO cuentan.
 * 
 * @param {Object} [filtros]
 * @param {number|string|null} [filtros.almacenId] - Filtro opcional por almacén
 * @returns {Promise<Array<Object>>} Lista de productos en alerta
 */
async function obtenerProductosCriticos({ almacenId = null } = {}) {
  const targetAlmacenId = almacenId ? parseInt(almacenId, 10) : null;

  // 1. Obtener pares (productoId, almacenId) que tienen historial en Kardex
  const kardexRows = await Kardex.findAll({
    attributes: [
      [sequelize.fn('DISTINCT', sequelize.col('productoId')), 'productoId'],
      'almacenId'
    ],
    where: {
      almacenId: { [Op.ne]: null }
    },
    raw: true
  });

  const kardexHistorySet = new Set(
    kardexRows.map(k => `${k.productoId}-${k.almacenId}`)
  );

  // 2. Obtener todos los productos activos que no sean servicios
  const productos = await Producto.findAll({
    where: {
      activo: true,
      tipo: { [Op.ne]: 'servicio' }
    },
    include: [
      {
        model: Almacen,
        as: 'almacenes',
        through: { attributes: ['stock', 'id'] },
        attributes: ['id', 'nombre', 'codigo', 'activo']
      }
    ]
  });

  const alertas = [];

  for (const prod of productos) {
    const p = prod.get ? prod.get({ plain: true }) : prod;

    // Verificar si es servicio por categoría
    if (p.categoria && p.categoria.toLowerCase().includes('servicio')) {
      continue;
    }

    const almacenesList = p.almacenes || [];

    // Calcular stock total sumando todas las sedes (producto_almacen.stock)
    const stockTotal = almacenesList.reduce((sum, alm) => {
      const paStock = alm.ProductoAlmacen ? Number(alm.ProductoAlmacen.stock || 0) : 0;
      return sum + paStock;
    }, 0);

    const minStock = (p.stock_minimo !== undefined && p.stock_minimo !== null && p.stock_minimo !== '')
      ? Number(p.stock_minimo)
      : 0;

    // Determinar si el producto está en estado crítico globalmente
    let estado = null;
    if (stockTotal <= 0) {
      estado = 'AGOTADO';
    } else if (minStock > 0 && stockTotal <= minStock) {
      estado = 'BAJO MÍNIMO';
    } else {
      // Si minStock <= 0 y stockTotal > 0, NO genera alerta de bajo mínimo
      // Si stockTotal > minStock, NO genera alerta
      continue;
    }

    // Evaluar por sede: sólo cuenta si esa sede tuvo existencias alguna vez
    for (const alm of almacenesList) {
      if (targetAlmacenId && alm.id !== targetAlmacenId) {
        continue;
      }

      const stockSede = alm.ProductoAlmacen ? Number(alm.ProductoAlmacen.stock || 0) : 0;
      const key = `${p.id}-${alm.id}`;
      const tuvoExistencias = stockSede > 0 || kardexHistorySet.has(key);

      // Si nunca tuvo existencias en esta sede, omitir (fila automática en 0)
      if (!tuvoExistencias) {
        continue;
      }

      alertas.push({
        productoId: p.id,
        nombre: p.nombre,
        codigo: p.codigo_oem || '',
        codigo_oem: p.codigo_oem || '',
        categoria: p.categoria || 'General',
        marca: p.marca || '',
        modelo: p.modelo || '',
        foto: p.foto || null,
        almacenId: alm.id,
        almacenNombre: alm.nombre || `Sede #${alm.id}`,
        stock: stockSede,
        stockSede,
        stockTotal,
        stock_minimo: minStock,
        estado
      });
    }
  }

  // Ordenar primero agotados, luego bajo mínimo, luego por nombre
  alertas.sort((a, b) => {
    if (a.estado === 'AGOTADO' && b.estado !== 'AGOTADO') return -1;
    if (a.estado !== 'AGOTADO' && b.estado === 'AGOTADO') return 1;
    return a.nombre.localeCompare(b.nombre);
  });

  return alertas;
}

module.exports = {
  obtenerProductosCriticos
};
