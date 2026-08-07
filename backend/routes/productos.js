const express = require('express');
const { body, validationResult } = require('express-validator');
const auth = require('../middleware/auth');
const requireRole = require('../middleware/roles');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const Producto = require('../models/Producto');
const ProductoAlmacen = require('../models/ProductoAlmacen');
const DetalleVenta = require('../models/DetalleVenta');
let DetalleFactura;
try {
  DetalleFactura = require('../models/DetalleFactura');
} catch (err) {
  // Ignore if model doesn't exist in this schema
  DetalleFactura = null;
}
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});

// Simple file filter and sanitization
function fileFilter (req, file, cb) {
  const allowed = ['.png', '.jpg', '.jpeg', '.gif'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (!allowed.includes(ext)) return cb(new Error('Tipo de archivo no permitido'));
  cb(null, true);
}

const upload = multer({ storage, fileFilter });


// Obtener productos en stock crítico por almacén
router.get('/stock-minimo', auth, async (req, res) => {
  try {
    const { almacenId } = req.query;
    const { Op } = require('sequelize');
    const ProductoAlmacen = require('../models/ProductoAlmacen');

    // Si se pasó almacenId, filtrar por ese almacén; si no, buscar en todas las asignaciones
    const whereClause = almacenId ? { almacenId } : {};
    const productosCriticos = await ProductoAlmacen.findAll({
      where: whereClause,
      include: [{
        model: Producto,
        where: {},
        required: true
      }]
    });
    // Filtrar por stock crítico usando el stock_minimo del producto (excluyendo servicios)
    const resultado = productosCriticos
      .filter(pa => {
        const p = pa.Producto;
        if (!p) return false;
        const isServicio = p.tipo === 'servicio' || (p.categoria && p.categoria.toLowerCase().includes('servicio'));
        if (isServicio) return false;
        const min = (p.stock_minimo !== undefined && p.stock_minimo !== null && p.stock_minimo !== '') ? Number(p.stock_minimo) : 5;
        const st = Number(pa.stock || 0);
        return st <= min || st <= 0;
      })
      .map(pa => ({
        nombre: pa.Producto ? pa.Producto.nombre : '',
        stock: Number(pa.stock || 0),
        stock_minimo: (pa.Producto && pa.Producto.stock_minimo !== undefined && pa.Producto.stock_minimo !== null && pa.Producto.stock_minimo !== '') ? Number(pa.Producto.stock_minimo) : 5,
        productoId: pa.productoId,
        almacenId: pa.almacenId
      }));
    res.json(resultado);
  } catch (error) {
    console.error('[productos] stock-minimo error:', error && error.stack ? error.stack : error);
    res.status(500).json({ error: 'Error al obtener productos en stock crítico por almacén' });
  }
});

// Obtener conteo de productos en stock crítico por cada almacén (solo admin)
router.get('/stock-minimo/por-almacen', auth, requireRole('admin'), async (req, res) => {
  try {
    const sequelize = require('../database/sequelize');
    const sql = `SELECT a.id as almacenId, a.nombre as almacenNombre, COUNT(*) as cantidad_critica
      FROM producto_almacen pa
      JOIN productos p ON pa.productoId = p.id
      JOIN almacenes a ON pa.almacenId = a.id
      WHERE (p.tipo IS NULL OR p.tipo != 'servicio')
        AND (pa.stock <= COALESCE(NULLIF(p.stock_minimo, 0), 5) OR pa.stock <= 0)
      GROUP BY a.id, a.nombre
      ORDER BY a.nombre`;
    const rows = await sequelize.query(sql, { type: require('sequelize').QueryTypes.SELECT });
    // Normalize numbers
    const result = rows.map(r => ({ almacenId: r.almacenId, almacenNombre: r.almacenNombre, cantidad: Number(r.cantidad_critica || 0) }));
    res.json(result);
  } catch (error) {
    console.error('[productos] stock-minimo/por-almacen error:', error);
    res.status(500).json({ error: 'Error al obtener stock crítico por almacén' });
  }
});

// Ruta para subir imagen
router.post('/upload', auth, requireRole('admin'), upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No se subió archivo' });
  const url = `http://localhost:4000/uploads/${req.file.filename}`;
  res.json({ url });
});

// Editar un producto por ID y actualizar stock solo en el almacén del usuario
router.put('/:id', auth, requireRole('admin'), [
  body('nombre').notEmpty().withMessage('El nombre es obligatorio'),
  body('precio').optional().custom((value) => {
    if (value === undefined || value === null || value === '') return true;
    if (typeof value === 'string') {
      value = value.replace(/\./g, '').replace(',', '.');
    }
    const num = parseFloat(value);
    if (isNaN(num) || num < 0) {
      throw new Error('El precio debe ser un número mayor o igual a cero');
    }
    return true;
  }),
  body('precio_detal').optional().custom((value) => {
    if (value === undefined || value === null || value === '') return true;
    if (typeof value === 'string') {
      value = value.replace(/\./g, '').replace(',', '.');
    }
    const num = parseFloat(value);
    if (isNaN(num) || num <= 0) {
      throw new Error('El precio detal debe ser un número mayor a cero');
    }
    return true;
  }),
  body('precio_mayor').optional().custom((value) => {
    if (value === undefined || value === null || value === '') return true;
    if (typeof value === 'string') {
      value = value.replace(/\./g, '').replace(',', '.');
    }
    const num = parseFloat(value);
    if (isNaN(num) || num <= 0) {
      throw new Error('El precio mayor debe ser un número mayor a cero');
    }
    return true;
  }),
  body('precio_almacen').optional().custom((value) => {
    if (value === undefined || value === null || value === '') return true;
    if (typeof value === 'string') {
      value = value.replace(/\./g, '').replace(',', '.');
    }
    const num = parseFloat(value);
    if (isNaN(num) || num <= 0) {
      throw new Error('El precio almacén debe ser un número mayor a cero');
    }
    return true;
  }),
  body('stock').optional().custom((value) => {
    if (value === undefined || value === null || value === '') return true;
    if (!Number.isInteger(Number(value))) {
      throw new Error('El stock debe ser un número entero');
    }
    return true;
  }),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  try {
  console.log('[productos] PUT /:id called');
    const id = req.params.id;
    let {
      nombre, descripcion, categoria, marca, modelo, compatibilidad, codigo_oem, stock, stock_minimo, costo, ubicacion_bodega, unidad_medida, proveedor, precio, precio_detal, precio_mayor, precio_almacen, foto, tipo, lote, fecha_vencimiento
    } = req.body;
    const almacenId = req.user.almacenId;
    // Función para convertir precios tipo '150.000,50' o '150,000.50' a float correctamente
    function parsePrecio(val) {
      if (typeof val === 'undefined' || val === null || val === '') return 0;
      if (typeof val === 'string') {
        let s = val.trim();
        if (s.includes(',') && s.includes('.')) {
          s = s.replace(/\./g, '').replace(',', '.');
        } else if (s.includes(',')) {
          s = s.replace(/,/g, '.');
        } else if (s.includes('.')) {
          const parts = s.split('.');
          const last = parts[parts.length - 1];
          if (last && last.length === 3) {
            s = s.replace(/\./g, '');
          }
        }
        val = s;
      }
      let num = parseFloat(val);
      if (isNaN(num) || num < 0) return 0;
      num = Math.round(num * 100) / 100;
      return num;
    }
    precio = parsePrecio(precio);
    precio_detal = parsePrecio(precio_detal);
    precio_mayor = parsePrecio(precio_mayor);
    precio_almacen = parsePrecio(precio_almacen);
    costo = parsePrecio(costo);
    let stockMinNum = stock_minimo !== undefined && stock_minimo !== null && stock_minimo !== '' ? parseInt(stock_minimo, 10) : 0;
    if (isNaN(stockMinNum)) stockMinNum = 0;

    // Actualizar datos generales del producto (sin el stock)
    const [actualizado] = await Producto.update({
      nombre, descripcion, categoria, marca, modelo, compatibilidad, codigo_oem, stock_minimo: stockMinNum, costo, ubicacion_bodega, unidad_medida, proveedor, precio, precio_detal, precio_mayor, precio_almacen, foto, tipo: tipo || 'producto', lote: lote || null, fecha_vencimiento: fecha_vencimiento || null
    }, { where: { id } });
    if (actualizado) {
      // Si se envía el campo stock y hay almacenId, actualizarlo solo en producto_almacen para el almacén del usuario
      if (typeof stock !== 'undefined' && almacenId) {
        let stockNum = stock;
        if (typeof stock === 'string' && stock !== '') {
          stockNum = parseInt(stock, 10);
          if (isNaN(stockNum)) stockNum = 0;
        }
        await ProductoAlmacen.update(
          { stock: stockNum },
          { where: { productoId: id, almacenId } }
        );
      }
      // Devolver el producto actualizado con el stock de ese almacén (o null si no hay almacenId)
      const productoActualizado = await Producto.findByPk(id);
      let stockAlmacen = null;
      if (almacenId) {
        const pa = await ProductoAlmacen.findOne({ where: { productoId: id, almacenId } });
        stockAlmacen = pa ? pa.stock : null;
      }
      res.json({ ...productoActualizado.toJSON(), stock: stockAlmacen });
    } else {
      res.status(404).json({ error: 'Producto no encontrado' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al actualizar producto' });
  }
});

// Eliminar un producto por ID
router.delete('/:id', auth, requireRole('admin'), async (req, res) => {
  try {
    const id = req.params.id;
    console.log('[productos] DELETE /:id called by user=', req.user ? `${req.user.id}(${req.user.rol})` : 'anonymous', 'productoId=', id);
    // Comprobar referencias antes de eliminar
    const refs = {};
    try {
      refs.detalleVenta = await DetalleVenta.count({ where: { productoId: id } });
    } catch (e) { refs.detalleVenta = -1; }
    try {
      refs.detalleFactura = DetalleFactura ? await DetalleFactura.count({ where: { productoId: id } }) : 0;
    } catch (e) { refs.detalleFactura = -1; }
    try {
      refs.productoAlmacen = await ProductoAlmacen.count({ where: { productoId: id } });
    } catch (e) { refs.productoAlmacen = -1; }

    // Bloquear si hay referencias en ventas, facturas o asignaciones en almacenes
    if ((refs.detalleVenta && refs.detalleVenta > 0) || (refs.detalleFactura && refs.detalleFactura > 0) || (refs.productoAlmacen && refs.productoAlmacen > 0)) {
      console.log('[productos] DELETE blocked by references:', refs);
      return res.status(409).json({ error: 'El producto tiene referencias (ventas, facturas o asignaciones en almacenes) y no puede eliminarse.', referencias: refs });
    }

    const eliminado = await Producto.destroy({ where: { id } });
    console.log('[productos] DELETE result for id=', id, 'deletedRows=', eliminado);
    if (eliminado) {
      res.json({ mensaje: 'Producto eliminado' });
    } else {
      res.status(404).json({ error: 'Producto no encontrado' });
    }
  } catch (error) {
    console.error('[productos] DELETE error:', error && error.stack ? error.stack : error);
    // Si la eliminación falla por una constraint (FK), devolver un error claro
    if (error && (error.name === 'SequelizeForeignKeyConstraintError' || (error.parent && (error.parent.code === 'ER_ROW_IS_REFERENCED_2' || error.parent.errno === 1451)))) {
      return res.status(409).json({ error: 'No se puede eliminar el producto porque está referenciado por ventas u otros registros.' });
    }
    // En desarrollo devolver el mensaje del error para diagnóstico; en producción podría ocultarse
    const msg = (error && error.message) ? error.message : 'Error al eliminar producto';
    res.status(500).json({ error: msg });
  }
});

// Archivar (soft-delete) un producto: marca activo = false
router.put('/:id/archivar', auth, requireRole('admin'), async (req, res) => {
  try {
    const id = req.params.id;
    console.log('[productos] ARCHIVAR /:id called by user=', req.user ? `${req.user.id}(${req.user.rol})` : 'anonymous', 'productoId=', id);
    // Intentar actualizar campo activo; si la columna no existe, capturamos el error y devolvemos instrucción SQL
    const [updated] = await Producto.update({ activo: false }, { where: { id } });
    // updated may be number or array depending on sequelize version
    const affected = typeof updated === 'number' ? updated : (Array.isArray(updated) ? updated[0] : updated);
    if (affected && Number(affected) > 0) {
      return res.json({ mensaje: 'Producto archivado' });
    }

    // Si no se afectaron filas, puede que el producto no exista o ya esté archivado.
    // Comprobar existencia y valor actual de 'activo'
    const prod = await Producto.findByPk(id, { attributes: ['id', 'activo'] });
    if (!prod) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }
    // Si ya está archivado, devolver 200 con mensaje informativo
    if (prod.activo === false || prod.activo === 0) {
      return res.json({ mensaje: 'Producto ya archivado' });
    }

    // Fallback: intentar actualizar directamente con SQL (por si el modelo no mapea la columna)
    try {
      const sequelize = require('../database/sequelize');
      const [result] = await sequelize.query('UPDATE productos SET activo = 0 WHERE id = ?', { replacements: [id] });
      let rows = 0;
      if (typeof result === 'number') rows = result;
      else if (result && typeof result.affectedRows === 'number') rows = result.affectedRows;
      else if (Array.isArray(result) && typeof result[0] === 'number') rows = result[0];
      if (rows > 0) return res.json({ mensaje: 'Producto archivado' });
    } catch (e) {
      console.error('[productos] ARCHIVAR raw update error:', e && e.stack ? e.stack : e);
    }

    return res.status(500).json({ error: 'No se pudo archivar el producto' });
  } catch (error) {
    console.error('[productos] ARCHIVAR error:', error && error.stack ? error.stack : error);
    // Detectar error por falta de columna (MySQL ER_BAD_FIELD_ERROR)
    if (error && error.parent && (error.parent.code === 'ER_BAD_FIELD_ERROR' || error.parent.errno === 1054)) {
      return res.status(500).json({ error: 'Falta columna `activo` en la tabla `productos`. Ejecute: ALTER TABLE productos ADD COLUMN activo TINYINT(1) NOT NULL DEFAULT 1;' });
    }
    return res.status(500).json({ error: (error && error.message) ? error.message : 'Error al archivar producto' });
  }
});

// Obtener productos solo del almacén asignado al usuario

// Obtener productos, filtrando por almacén si se pasa almacenId en la query
router.get('/', auth, async (req, res) => {
  try {
    console.log('[productos] GET / called by user=', req.user ? `${req.user.id}(${req.user.rol}) almacén=${req.user.almacenId}` : 'anonymous');
    const almacenIdQuery = req.query.almacenId ? parseInt(req.query.almacenId, 10) : null;
    // Si es admin y hay almacenId en la query, filtrar productos por ese almacén
    if (req.user.rol === 'admin') {
      if (almacenIdQuery) {
        // Solo productos con stock en ese almacén
        const productosAlmacen = await ProductoAlmacen.findAll({
          where: { almacenId: almacenIdQuery },
          include: [{ model: Producto }]
        });
        const productos = productosAlmacen.map(pa => ({
          ...pa.Producto?.toJSON(),
          stock: pa.stock,
          almacenId: almacenIdQuery
        }));
        res.json(productos);
        return;
      } else {
        // Todos los productos y sus asignaciones de almacén
        const productos = await Producto.findAll({
          include: [{
            model: require('../models/Almacen'),
            as: 'almacenes',
            through: { attributes: ['stock'] },
            attributes: ['id', 'nombre']
          }]
        });
        // Formatear para incluir stock por almacén
        const productosConAlmacenes = productos.map(p => {
          const almacenes = (p.almacenes || []).map(a => ({
            id: a.id,
            nombre: a.nombre,
            stock: a.ProductoAlmacen ? a.ProductoAlmacen.stock : 0
          }));
          // Calcular stock total sumando todos los almacenes
          const stockTotal = almacenes.reduce((acc, a) => acc + (a.stock || 0), 0);
          return { ...p.toJSON(), almacenes, stockTotal };
        });
        res.json(productosConAlmacenes);
        return;
      }
    }
    // Traer todos los productos con la lista de almacenes y sus stocks respectivos
    const productos = await Producto.findAll({
      include: [{
        model: require('../models/Almacen'),
        as: 'almacenes',
        through: { attributes: ['stock'] },
        attributes: ['id', 'nombre'],
        required: false
      }]
    });

    const almacenId = req.user.almacenId;

    const productosFormatted = productos.map(p => {
      const pJson = p.toJSON();
      const isServ = p.tipo === 'servicio' || (p.categoria && p.categoria.toLowerCase().includes('servicio'));
      const almacenesList = (pJson.almacenes || []).map(a => ({
        id: a.id,
        nombre: a.nombre,
        stock: a.ProductoAlmacen ? Number(a.ProductoAlmacen.stock || 0) : 0
      }));

      // Calcular stock total sumando la cantidad en todos los almacenes
      const stockTotal = almacenesList.reduce((sum, a) => sum + a.stock, 0);

      // Determinar stock específico del almacén del usuario si tiene un almacenId asignado
      let stockAlmacen = stockTotal;
      if (almacenId) {
        const userAlm = almacenesList.find(a => Number(a.id) === Number(almacenId));
        stockAlmacen = userAlm ? userAlm.stock : 0;
      }

      return {
        ...pJson,
        almacenes: almacenesList,
        almacenId: almacenId || null,
        stock: isServ ? 0 : (almacenId ? stockAlmacen : stockTotal),
        stockTotal
      };
    });

    res.json(productosFormatted);
  } catch (error) {
    console.error('[productos] GET / error:', error);
    res.status(500).json({ error: 'Error al obtener productos' });
  }
});

// Obtener un producto por ID (diagnóstico)
router.get('/:id', auth, async (req, res) => {
  try {
    const id = req.params.id;
    const producto = await Producto.findByPk(id, {
      include: [{
        model: require('../models/Almacen'),
        as: 'almacenes',
        through: { attributes: ['stock'] },
        attributes: ['id', 'nombre']
      }]
    });
    if (!producto) return res.status(404).json({ error: 'Producto no encontrado' });
    // Añadir campo activo si existe en la instancia
    const p = producto.toJSON();
    res.json(p);
  } catch (error) {
    console.error('[productos] GET /:id error:', error && error.stack ? error.stack : error);
    res.status(500).json({ error: 'Error al obtener producto' });
  }
});

// Crear un nuevo producto y su stock en el almacén del usuario
router.post('/', auth, requireRole('admin'), [
  body('nombre').notEmpty().withMessage('El nombre es obligatorio'),
  body('precio').optional().custom((value) => {
    if (value === undefined || value === null || value === '') return true;
    if (typeof value === 'string') {
      value = value.replace(/\./g, '').replace(',', '.');
    }
    const num = parseFloat(value);
    if (isNaN(num) || num < 0) {
      throw new Error('El precio debe ser un número mayor o igual a cero');
    }
    return true;
  }),
  body('precio_detal').optional().custom((value) => {
    if (value === undefined || value === null || value === '') return true;
    if (typeof value === 'string') {
      value = value.replace(/\./g, '').replace(',', '.');
    }
    const num = parseFloat(value);
    if (isNaN(num) || num <= 0) {
      throw new Error('El precio detal debe ser un número mayor a cero');
    }
    return true;
  }),
  body('precio_mayor').optional().custom((value) => {
    if (value === undefined || value === null || value === '') return true;
    if (typeof value === 'string') {
      value = value.replace(/\./g, '').replace(',', '.');
    }
    const num = parseFloat(value);
    if (isNaN(num) || num <= 0) {
      throw new Error('El precio mayor debe ser un número mayor a cero');
    }
    return true;
  }),
  body('precio_almacen').optional().custom((value) => {
    if (value === undefined || value === null || value === '') return true;
    if (typeof value === 'string') {
      value = value.replace(/\./g, '').replace(',', '.');
    }
    const num = parseFloat(value);
    if (isNaN(num) || num <= 0) {
      throw new Error('El precio almacén debe ser un número mayor a cero');
    }
    return true;
  }),
  body('stock').optional().isInt().withMessage('El stock debe ser un número entero'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  try {
  console.log('[productos] POST / called');
    let {
      nombre, descripcion, categoria, marca, modelo, compatibilidad, codigo_oem, stock, stock_minimo, costo, ubicacion_bodega, unidad_medida, proveedor, precio, precio_detal, precio_mayor, precio_almacen, foto, tipo, lote, fecha_vencimiento
    } = req.body;
    const almacenId = req.user.almacenId;
    function parsePrecio(val) {
      if (typeof val === 'undefined' || val === null || val === '') return 0;
      if (typeof val === 'string') {
        if (val.includes(',') && val.includes('.')) {
          val = val.replace(/\./g, '').replace(',', '.');
        } else if (val.includes(',')) {
          val = val.replace(',', '.');
        } else {
          const parts = val.split('.');
          if (parts.length > 2) {
            val = val.replace(/\./g, '');
          }
        }
      }
      let num = parseFloat(val);
      if (isNaN(num) || num < 0) return 0;
      num = Math.round(num * 100) / 100;
      return num;
    }
    precio = parsePrecio(precio);
    precio_detal = parsePrecio(precio_detal);
    precio_mayor = parsePrecio(precio_mayor);
    precio_almacen = parsePrecio(precio_almacen);
    costo = parsePrecio(costo);
    let stockMinNum = stock_minimo !== undefined && stock_minimo !== null && stock_minimo !== '' ? parseInt(stock_minimo, 10) : 0;
    if (isNaN(stockMinNum)) stockMinNum = 0;

    if (typeof stock === 'undefined' || stock === '' || isNaN(Number(stock))) {
      stock = 0;
    } else {
      stock = parseInt(stock, 10);
    }
    // Crear el producto con todos los atributos
    const nuevoProducto = await Producto.create({
      nombre, descripcion, categoria, marca, modelo, compatibilidad, codigo_oem, stock_minimo: stockMinNum, costo, ubicacion_bodega, unidad_medida: unidad_medida || (tipo === 'servicio' ? 'Servicio' : 'Unidad'), proveedor, precio, precio_detal, precio_mayor, precio_almacen, foto, tipo: tipo || 'producto', lote: lote || null, fecha_vencimiento: fecha_vencimiento || null, activo: true
    });
    
    // Si el item es un servicio, registrar en todos los almacenes con stock 0
    if (tipo === 'servicio') {
      try {
        const Almacen = require('../models/Almacen');
        const todosAlmacenes = await Almacen.findAll();
        for (const alm of todosAlmacenes) {
          await ProductoAlmacen.findOrCreate({
            where: { productoId: nuevoProducto.id, almacenId: alm.id },
            defaults: { stock: 0 }
          });
        }
      } catch (e) {
        console.error('Error al inicializar registro de servicio en almacenes:', e);
      }
    } else if (almacenId) {
      // Si el usuario tiene almacenId, crear el registro de stock para ese almacén
      await ProductoAlmacen.create({
        productoId: nuevoProducto.id,
        almacenId,
        stock
      });
    } else {
      // Si es admin sin almacenId específico, inicializar stock 0 en almacenPrincipal (ID 1) si existe
      try {
        await ProductoAlmacen.findOrCreate({
          where: { productoId: nuevoProducto.id, almacenId: 1 },
          defaults: { stock }
        });
      } catch (e) {
        // ignore if almacen 1 doesn't exist
      }
    }
    const productoConStock = {
      ...nuevoProducto.toJSON(),
      stock: stock
    };
    res.status(201).json(productoConStock);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al crear producto' });
  }
});

// Duplicar un producto por ID
router.post('/:id/duplicar', auth, requireRole('admin'), async (req, res) => {
  try {
    const id = req.params.id;
    const productoBase = await Producto.findByPk(id);
    if (!productoBase) return res.status(404).json({ error: 'Producto original no encontrado' });

    const p = productoBase.toJSON();
    delete p.id;
    p.nombre = `${p.nombre} (Copia)`;
    if (p.codigo_oem) p.codigo_oem = `${p.codigo_oem}-CLON`;

    const nuevoProducto = await Producto.create(p);

    // Copiar asignaciones de almacén
    const asignaciones = await ProductoAlmacen.findAll({ where: { productoId: id } });
    for (const a of asignaciones) {
      await ProductoAlmacen.create({
        productoId: nuevoProducto.id,
        almacenId: a.almacenId,
        stock: a.stock
      });
    }

    res.status(201).json({ mensaje: 'Producto duplicado con éxito', producto: nuevoProducto });
  } catch (error) {
    console.error('[productos] duplicar error:', error);
    res.status(500).json({ error: 'Error al duplicar el producto' });
  }
});

// Ajustar stock rápido para un almacén determinado
router.post('/:id/ajuste-stock', auth, requireRole('admin'), async (req, res) => {
  try {
    const productoId = req.params.id;
    const { almacenId, nuevoStock, motivo } = req.body;
    if (!almacenId || nuevoStock === undefined || nuevoStock === null) {
      return res.status(400).json({ error: 'Faltan parámetros requeridos (almacenId, nuevoStock)' });
    }
    const stockVal = Math.max(0, parseInt(nuevoStock, 10) || 0);

    const [pa, created] = await ProductoAlmacen.findOrCreate({
      where: { productoId, almacenId },
      defaults: { stock: stockVal }
    });

    if (!created) {
      pa.stock = stockVal;
      await pa.save();
    }

    console.log(`[Ajuste Stock] Producto ${productoId} en Almacén ${almacenId} ajustado a ${stockVal}. Motivo: ${motivo || 'Ajuste manual'}`);
    res.json({ ok: true, stock: stockVal, motivo: motivo || 'Ajuste manual' });
  } catch (error) {
    console.error('[productos] ajuste-stock error:', error);
    res.status(500).json({ error: 'Error al realizar el ajuste de stock' });
  }
});

// Asignar stock de un producto a varios almacenes
router.post('/:id/asignar-almacenes', auth, requireRole('admin'), async (req, res) => {
  try {
    const productoId = req.params.id;
    const { asignaciones } = req.body; // [{ almacenId, stock }]
  console.log('[productos] asignar-almacenes called for productoId=', productoId);
    if (!Array.isArray(asignaciones)) {
      return res.status(400).json({ error: 'Datos inválidos' });
    }
    // Actualizar o crear stock para cada almacén
    for (const item of asignaciones) {
      const almacenId = item.almacenId;
      // sanitize stock to integer
      let stock = item.stock;
      if (typeof stock === 'string') {
        const cleaned = String(stock).replace(/[^0-9\-]/g, '');
        stock = cleaned === '' ? 0 : parseInt(cleaned, 10);
      }
      if (isNaN(stock) || stock === null) stock = 0;
      const [pa, created] = await ProductoAlmacen.findOrCreate({
        where: { productoId, almacenId },
        defaults: { stock }
      });
      if (!created) {
        pa.stock = stock;
        await pa.save();
      }
    }
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: 'Error al asignar almacenes' });
  }
});

// Aquí puedes agregar más rutas: PUT, DELETE, etc.

// Obtener productos sin stock en ningún almacén
router.get('/sin-almacen', auth, async (req, res) => {
  try {
    // Buscar productos que no tienen ninguna asignación en ProductoAlmacen
    const productosConAlmacen = await ProductoAlmacen.findAll({ attributes: ['productoId'] });
    const productosIdsConAlmacen = productosConAlmacen.map(pa => pa.productoId);
    const productosSinAlmacen = await Producto.findAll({
      where: {
        id: { [require('sequelize').Op.notIn]: productosIdsConAlmacen }
      }
    });
    res.json(productosSinAlmacen);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener productos sin almacén' });
  }
});

// Endpoint de diagnóstico: contar referencias que podrían impedir eliminar el producto
router.get('/:id/referencias', auth, requireRole('admin'), async (req, res) => {
  try {
    const productoId = req.params.id;
    const resultados = {};
    // Contar en DetalleVenta
    try {
      const cntDV = await DetalleVenta.count({ where: { productoId } });
      resultados.detalleVenta = cntDV;
    } catch (e) {
      resultados.detalleVenta = -1;
    }
    // Contar en DetalleFactura si existe
    if (DetalleFactura) {
      try {
        const cntDF = await DetalleFactura.count({ where: { productoId } });
        resultados.detalleFactura = cntDF;
      } catch (e) {
        resultados.detalleFactura = -1;
      }
    } else {
      resultados.detalleFactura = 0;
    }
    // Contar en ProductoAlmacen
    try {
      const cntPA = await ProductoAlmacen.count({ where: { productoId } });
      resultados.productoAlmacen = cntPA;
    } catch (e) {
      resultados.productoAlmacen = -1;
    }

    res.json({ productoId, referencias: resultados });
  } catch (error) {
    console.error('[productos] referencias error:', error && error.stack ? error.stack : error);
    res.status(500).json({ error: 'Error al contar referencias' });
  }
});

module.exports = router;

