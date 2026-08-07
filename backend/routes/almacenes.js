const express = require('express');
const router = express.Router();
const { Almacen, Producto, ProductoAlmacen, Usuario } = require('../models');
const { authRole } = require('./auth');

// Obtener todos los almacenes con estadísticas agregadas de inventario y personal
router.get('/', authRole(['admin', 'vendedor']), async (req, res) => {
  try {
    const almacenes = await Almacen.findAll({ order: [['id', 'ASC']] });

    // Obtener información suplementaria de stock y usuarios para enriquecer cada almacén
    const productoAlmacenes = await ProductoAlmacen.findAll();
    const productos = await Producto.findAll({ where: { activo: true } });
    const usuarios = await Usuario.findAll({ attributes: ['id', 'nombre', 'almacenId', 'activo'] });

    const prodMap = {};
    productos.forEach(p => { prodMap[p.id] = p; });

    const almacenesEnriquecidos = almacenes.map(a => {
      const plain = a.toJSON();
      
      // Filtrar asignaciones de stock para este almacén
      const asignaciones = productoAlmacenes.filter(pa => String(pa.almacenId) === String(a.id));
      
      let totalStock = 0;
      let totalValoracion = 0;
      let totalReferencias = 0;

      asignaciones.forEach(pa => {
        const prod = prodMap[pa.productoId];
        if (prod) {
          const isServ = prod.tipo === 'servicio' || (prod.categoria && prod.categoria.toLowerCase().includes('servicio'));
          if (!isServ) {
            const st = Number(pa.stock || 0);
            totalStock += st;
            if (st > 0) totalReferencias += 1;
            const precioUnidad = Number(prod.costo || prod.precio_detal || prod.precio || 0);
            totalValoracion += (st * precioUnidad);
          } else {
            // Contar el servicio como referencia disponible si está activo
            totalReferencias += 1;
          }
        }
      });

      // Contar personal asignado a este almacén
      const usuariosAsignados = usuarios.filter(u => String(u.almacenId) === String(a.id) && u.activo !== false).length;

      return {
        ...plain,
        totalStock,
        totalReferencias,
        totalValoracion,
        usuariosAsignados
      };
    });

    res.json(almacenesEnriquecidos);
  } catch (err) {
    console.error('[almacenes] GET / error:', err);
    res.status(500).json({ error: 'Error al obtener almacenes' });
  }
});

// Obtener el inventario detallado de un almacén específico
router.get('/:id/inventario', authRole(['admin', 'vendedor']), async (req, res) => {
  try {
    const { id } = req.params;
    const almacen = await Almacen.findByPk(id);
    if (!almacen) return res.status(404).json({ error: 'Almacén no encontrado' });

    const asignaciones = await ProductoAlmacen.findAll({ where: { almacenId: id } });
    const productoIds = asignaciones.map(a => a.productoId);

    const productos = await Producto.findAll({ where: { id: productoIds, activo: true } });
    const stockMap = {};
    asignaciones.forEach(a => { stockMap[a.productoId] = a.stock; });

    const inventarioDetalle = productos.map(p => {
      const isServ = p.tipo === 'servicio' || (p.categoria && p.categoria.toLowerCase().includes('servicio'));
      const st = isServ ? 0 : (stockMap[p.id] || 0);
      return {
        id: p.id,
        nombre: p.nombre,
        tipo: p.tipo || (isServ ? 'servicio' : 'producto'),
        categoria: p.categoria,
        codigo_oem: p.codigo_oem,
        marca: p.marca,
        modelo: p.modelo,
        costo: p.costo,
        precio_detal: p.precio_detal,
        precio_mayor: p.precio_mayor,
        precio_almacen: p.precio_almacen,
        stock: st,
        stock_minimo: p.stock_minimo || 0,
        ubicacion_bodega: p.ubicacion_bodega,
        unidad_medida: p.unidad_medida || (isServ ? 'Servicio' : 'Unidad')
      };
    });

    res.json({
      almacen: almacen.toJSON(),
      inventario: inventarioDetalle
    });
  } catch (err) {
    console.error('[almacenes] GET /:id/inventario error:', err);
    res.status(500).json({ error: 'Error al obtener inventario del almacén' });
  }
});

// Crear un nuevo almacén (solo admin)
router.post('/', authRole(['admin']), async (req, res) => {
  try {
    const { codigo, nombre, ubicacion, telefono, email, responsable, direccion, ciudad } = req.body;
    if (!nombre || !String(nombre).trim()) {
      return res.status(400).json({ error: 'El nombre del almacén es obligatorio' });
    }

    const nuevo = await Almacen.create({
      codigo: codigo ? codigo.trim() : null,
      nombre: nombre.trim(),
      ubicacion: ubicacion ? ubicacion.trim() : null,
      telefono: telefono ? telefono.trim() : null,
      email: email ? email.trim() : null,
      responsable: responsable ? responsable.trim() : null,
      direccion: direccion ? direccion.trim() : null,
      ciudad: ciudad ? ciudad.trim() : null,
      activo: true
    });

    res.status(201).json(nuevo);
  } catch (err) {
    console.error('[almacenes] POST / error:', err);
    res.status(500).json({ error: 'Error al crear almacén' });
  }
});

// Editar almacén (solo admin)
router.put('/:id', authRole(['admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const { codigo, nombre, ubicacion, telefono, email, responsable, direccion, ciudad, activo } = req.body;
    
    const almacen = await Almacen.findByPk(id);
    if (!almacen) return res.status(404).json({ error: 'Almacén no encontrado' });

    if (nombre !== undefined && !String(nombre).trim()) {
      return res.status(400).json({ error: 'El nombre del almacén no puede estar vacío' });
    }

    almacen.codigo = codigo !== undefined ? codigo : almacen.codigo;
    almacen.nombre = nombre !== undefined ? nombre.trim() : almacen.nombre;
    almacen.ubicacion = ubicacion !== undefined ? ubicacion : almacen.ubicacion;
    almacen.telefono = telefono !== undefined ? telefono : almacen.telefono;
    almacen.email = email !== undefined ? email : almacen.email;
    almacen.responsable = responsable !== undefined ? responsable : almacen.responsable;
    almacen.direccion = direccion !== undefined ? direccion : almacen.direccion;
    almacen.ciudad = ciudad !== undefined ? ciudad : almacen.ciudad;
    if (activo !== undefined) almacen.activo = Boolean(activo);

    await almacen.save();
    res.json(almacen);
  } catch (err) {
    console.error('[almacenes] PUT /:id error:', err);
    res.status(500).json({ error: 'Error al editar almacén' });
  }
});

// Eliminar o desactivar almacén (solo admin)
router.delete('/:id', authRole(['admin']), async (req, res) => {
  try {
    const { id } = req.params;
    if (Number(id) === 1) {
      return res.status(400).json({ error: 'No es posible eliminar el Almacén Principal del sistema.' });
    }

    const almacen = await Almacen.findByPk(id);
    if (!almacen) return res.status(404).json({ error: 'Almacén no encontrado' });

    // Verificar si hay usuarios o stock asignado antes de eliminar físicamente
    const usuariosAsignados = await Usuario.count({ where: { almacenId: id } });
    if (usuariosAsignados > 0) {
      return res.status(400).json({ 
        error: `No se puede eliminar el almacén porque tiene ${usuariosAsignados} usuario(s) asignado(s). Reasigne el personal primero.` 
      });
    }

    await almacen.destroy();
    res.json({ success: true, mensaje: 'Almacén eliminado correctamente' });
  } catch (err) {
    console.error('[almacenes] DELETE /:id error:', err);
    res.status(500).json({ error: 'Error al eliminar almacén' });
  }
});

module.exports = router;
