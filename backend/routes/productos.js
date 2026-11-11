const express = require('express');
const { body, validationResult } = require('express-validator');
const auth = require('../middleware/auth');
const requirePermiso = require('../middleware/roles');
const { almacenDelUsuario, sanitizarCostos } = require('../utils/almacenScope');
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


// Obtener productos en stock crítico por almacén según regla unificada
router.get('/stock-minimo', auth, requirePermiso('productos.ver'), async (req, res) => {
  try {
    const scopedAlmacenId = almacenDelUsuario(req, res);
    if (scopedAlmacenId === undefined && req.user.rol !== 'admin') return;
    const almacenId = scopedAlmacenId || req.query.almacenId;
    const { obtenerProductosCriticos } = require('../utils/stockCritico');
    const resultado = await obtenerProductosCriticos({ almacenId });
    res.json(sanitizarCostos(resultado, req.user));
  } catch (error) {
    console.error('[productos] stock-minimo error:', error && error.stack ? error.stack : error);
    res.status(500).json({ error: 'Error al obtener productos en stock crítico por almacén' });
  }
});

// Obtener conteo de productos en stock crítico por cada almacén
router.get('/stock-minimo/por-almacen', auth, requirePermiso('productos.ver'), async (req, res) => {
  try {
    const { obtenerProductosCriticos } = require('../utils/stockCritico');
    const Almacen = require('../models/Almacen');
    const todosAlmacenes = await Almacen.findAll({ where: { activo: true }, order: [['nombre', 'ASC']] });
    const todasAlertas = await obtenerProductosCriticos();

    const conteoPorAlmacen = {};
    for (const a of todasAlertas) {
      if (a.almacenId) {
        conteoPorAlmacen[a.almacenId] = (conteoPorAlmacen[a.almacenId] || 0) + 1;
      }
    }

    const result = todosAlmacenes.map(alm => ({
      almacenId: alm.id,
      almacenNombre: alm.nombre,
      cantidad: conteoPorAlmacen[alm.id] || 0
    }));

    res.json(result);
  } catch (error) {
    console.error('[productos] stock-minimo/por-almacen error:', error);
    res.status(500).json({ error: 'Error al obtener stock crítico por almacén' });
  }
});

// Ruta para subir imagen
router.post('/upload', auth, requirePermiso('productos.crear'), upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No se subió archivo' });
  const url = `http://localhost:4000/uploads/${req.file.filename}`;
  res.json({ url });
});

// Editar un producto por ID y actualizar stock solo en el almacén del usuario
router.put('/:id', auth, requirePermiso('productos.editar'), [
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

    // Actualizar datos generales del producto
    const isTipoServicio = tipo === 'servicio' || (categoria && categoria.toLowerCase().includes('servicio'));
    const [actualizado] = await Producto.update({
      nombre, descripcion, categoria, marca, modelo, compatibilidad, codigo_oem, stock_minimo: stockMinNum, costo, ubicacion_bodega, unidad_medida, proveedor, precio, precio_detal, precio_mayor, precio_almacen, foto, tipo: isTipoServicio ? 'servicio' : (tipo || 'producto'), lote: lote || null, fecha_vencimiento: fecha_vencimiento || null,
      stock: isTipoServicio ? 0 : undefined
    }, { where: { id } });

    if (actualizado) {
      if (isTipoServicio) {
        // Un servicio no debe tener existencias en producto_almacen
        await ProductoAlmacen.update({ stock: 0 }, { where: { productoId: id } });
        await Producto.update({ stock: 0 }, { where: { id } });
      } else if (typeof stock !== 'undefined' && almacenId) {
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
      let stockAlmacen = isTipoServicio ? 0 : null;
      if (almacenId && !isTipoServicio) {
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

// Eliminar un producto por ID (o archivar si tiene historial de ventas/facturas)
router.delete('/:id', auth, requirePermiso('productos.editar'), async (req, res) => {
  try {
    const id = req.params.id;
    console.log('[productos] DELETE /:id called by user=', req.user ? `${req.user.id}(${req.user.rol})` : 'anonymous', 'productoId=', id);
    
    // Comprobar si el producto está referenciado en ventas o facturas
    const refs = {};
    try {
      refs.detalleVenta = await DetalleVenta.count({ where: { productoId: id } });
    } catch (e) { refs.detalleVenta = 0; }
    try {
      refs.detalleFactura = DetalleFactura ? await DetalleFactura.count({ where: { productoId: id } }) : 0;
    } catch (e) { refs.detalleFactura = 0; }

    // Si tiene ventas o facturas asociadas, archivar (soft-delete) para mantener integridad de reportes y ventas
    if ((refs.detalleVenta && refs.detalleVenta > 0) || (refs.detalleFactura && refs.detalleFactura > 0)) {
      console.log('[productos] DELETE converted to soft-delete (archivar) due to sales history:', refs);
      await Producto.update({ activo: false }, { where: { id } });
      try {
        const sequelize = require('../database/sequelize');
        await sequelize.query('UPDATE productos SET activo = 0 WHERE id = ?', { replacements: [id] });
      } catch (e) {}
      return res.json({ mensaje: 'El producto posee historial de ventas/facturas por lo que fue archivado del catálogo.', archivado: true });
    }

    // Si NO tiene ventas/facturas, eliminar sus asignaciones de almacén y borrar el producto
    await ProductoAlmacen.destroy({ where: { productoId: id } });
    const eliminado = await Producto.destroy({ where: { id } });
    if (eliminado) {
      res.json({ mensaje: 'Producto eliminado del catálogo', eliminado: true });
    } else {
      res.status(404).json({ error: 'Producto no encontrado' });
    }
  } catch (error) {
    console.error('[productos] DELETE error:', error && error.stack ? error.stack : error);
    try {
      await Producto.update({ activo: false }, { where: { id: req.params.id } });
      return res.json({ mensaje: 'Producto archivado correctamente.', archivado: true });
    } catch (e) {
      res.status(500).json({ error: 'Error al eliminar o archivar el producto' });
    }
  }
});

// Archivar (soft-delete) un producto: marca activo = false
router.put('/:id/archivar', auth, requirePermiso('productos.editar'), async (req, res) => {
  try {
    const id = req.params.id;
    console.log('[productos] ARCHIVAR /:id called by user=', req.user ? `${req.user.id}(${req.user.rol})` : 'anonymous', 'productoId=', id);
    const [updated] = await Producto.update({ activo: false }, { where: { id } });
    try {
      const sequelize = require('../database/sequelize');
      await sequelize.query('UPDATE productos SET activo = 0 WHERE id = ?', { replacements: [id] });
    } catch (e) {}
    res.json({ mensaje: 'Producto archivado correctamente' });
  } catch (error) {
    console.error('[productos] ARCHIVAR error:', error && error.stack ? error.stack : error);
    res.status(500).json({ error: 'Error al archivar producto' });
  }
});

// Obtener productos, filtrando por almacén según rol (solo productos activos)
router.get('/', auth, requirePermiso('productos.ver'), async (req, res) => {
  try {
    const { Op } = require('sequelize');
    const { incluirArchivados } = req.query;
    const whereActivo = incluirArchivados === 'true' ? {} : {
      [Op.or]: [
        { activo: true },
        { activo: 1 },
        { activo: null }
      ]
    };

    const scopedAlmacenId = almacenDelUsuario(req, res);
    if (scopedAlmacenId === undefined && req.user.rol !== 'admin') return;
    
    if (req.user.rol === 'admin') {
      if (scopedAlmacenId) {
        const productosAlmacen = await ProductoAlmacen.findAll({
          where: { almacenId: scopedAlmacenId },
          include: [{ model: Producto, where: whereActivo }]
        });
        const productos = productosAlmacen.map(pa => ({
          ...pa.Producto?.toJSON(),
          stock: pa.stock,
          almacenId: scopedAlmacenId
        }));
        res.json(sanitizarCostos(productos, req.user));
        return;
      } else {
        const productos = await Producto.findAll({
          where: whereActivo,
          include: [{
            model: require('../models/Almacen'),
            as: 'almacenes',
            through: { attributes: ['stock'] },
            attributes: ['id', 'nombre']
          }]
        });
        const productosConAlmacenes = productos.map(p => {
          const almacenes = (p.almacenes || []).map(a => ({
            id: a.id,
            nombre: a.nombre,
            stock: a.ProductoAlmacen ? a.ProductoAlmacen.stock : 0
          }));
          const stockTotal = almacenes.reduce((acc, a) => acc + (a.stock || 0), 0);
          return { ...p.toJSON(), almacenes, stockTotal };
        });
        res.json(sanitizarCostos(productosConAlmacenes, req.user));
        return;
      }
    }

    const productos = await Producto.findAll({
      where: whereActivo,
      include: [{
        model: require('../models/Almacen'),
        as: 'almacenes',
        through: { attributes: ['stock'] },
        attributes: ['id', 'nombre'],
        required: false
      }]
    });

    const almacenId = scopedAlmacenId;

    const productosFormatted = productos.map(p => {
      const pJson = p.toJSON();
      const isServ = p.tipo === 'servicio' || (p.categoria && p.categoria.toLowerCase().includes('servicio'));
      const almacenesList = (pJson.almacenes || []).map(a => ({
        id: a.id,
        nombre: a.nombre,
        stock: a.ProductoAlmacen ? Number(a.ProductoAlmacen.stock || 0) : 0
      }));

      const stockTotal = almacenesList.reduce((sum, a) => sum + a.stock, 0);

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

    res.json(sanitizarCostos(productosFormatted, req.user));
  } catch (error) {
    console.error('[productos] GET / error:', error);
    res.status(500).json({ error: 'Error al obtener productos' });
  }
});

// Obtener un producto por ID
router.get('/:id', auth, requirePermiso('productos.ver'), async (req, res) => {
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
    const p = producto.toJSON();
    res.json(sanitizarCostos(p, req.user));
  } catch (error) {
    console.error('[productos] GET /:id error:', error && error.stack ? error.stack : error);
    res.status(500).json({ error: 'Error al obtener producto' });
  }
});

// Crear un nuevo producto y su stock en el almacén del usuario
router.post('/', auth, requirePermiso('productos.crear'), [
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
    
    // Si el item es un servicio, no crear existencias ni filas en almacenes
    const esServicio = (tipo === 'servicio') || (categoria && categoria.toLowerCase().includes('servicio'));
    if (esServicio) {
      // Los servicios no manejan existencias en producto_almacen
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
      stock: esServicio ? 0 : stock
    };
    res.status(201).json(productoConStock);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al crear producto' });
  }
});

// Duplicar un producto por ID
router.post('/:id/duplicar', auth, requirePermiso('productos.crear'), async (req, res) => {
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
router.post('/:id/ajuste-stock', auth, requirePermiso('stock.ajustar'), async (req, res) => {
  try {
    const productoId = req.params.id;
    const { almacenId, nuevoStock, motivo } = req.body;
    if (!almacenId || nuevoStock === undefined || nuevoStock === null) {
      return res.status(400).json({ error: 'Faltan parámetros requeridos (almacenId, nuevoStock)' });
    }

    if (req.user.rol !== 'admin' && Number(almacenId) !== Number(req.user.almacenId)) {
      return res.status(403).json({ error: 'Solo puede ajustar stock de su sede asignada' });
    }

    const producto = await Producto.findByPk(productoId);
    if (!producto) return res.status(404).json({ error: 'Producto no encontrado' });
    if (producto.tipo === 'servicio' || (producto.categoria && producto.categoria.toLowerCase().includes('servicio'))) {
      return res.status(400).json({ error: 'Los servicios no manejan inventario ni existencias.' });
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
router.post('/:id/asignar-almacenes', auth, requirePermiso('stock.ajustar'), async (req, res) => {
  try {
    const productoId = req.params.id;
    const { asignaciones } = req.body; // [{ almacenId, stock }]
    if (!Array.isArray(asignaciones)) {
      return res.status(400).json({ error: 'Datos inválidos' });
    }

    if (req.user.rol !== 'admin') {
      for (const item of asignaciones) {
        if (Number(item.almacenId) !== Number(req.user.almacenId)) {
          return res.status(403).json({ error: 'Solo puede asignar stock a su sede asignada' });
        }
      }
    }

    const producto = await Producto.findByPk(productoId);
    if (!producto) return res.status(404).json({ error: 'Producto no encontrado' });
    if (producto.tipo === 'servicio' || (producto.categoria && producto.categoria.toLowerCase().includes('servicio'))) {
      return res.status(400).json({ error: 'Los servicios no manejan inventario ni existencias.' });
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

// Obtener productos sin stock en ningún almacén
router.get('/sin-almacen', auth, requirePermiso('productos.ver'), async (req, res) => {
  try {
    // Buscar productos que no tienen ninguna asignación en ProductoAlmacen
    const productosConAlmacen = await ProductoAlmacen.findAll({ attributes: ['productoId'] });
    const productosIdsConAlmacen = productosConAlmacen.map(pa => pa.productoId);
    const productosSinAlmacen = await Producto.findAll({
      where: {
        id: { [require('sequelize').Op.notIn]: productosIdsConAlmacen }
      }
    });
    res.json(sanitizarCostos(productosSinAlmacen, req.user));
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener productos sin almacén' });
  }
});

// Endpoint de importación masiva de productos
router.post('/import-masivo', auth, requirePermiso('productos.crear'), async (req, res) => {
  try {
    const { items, almacenId, actualizarExistentes } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'No se enviaron datos para importar' });
    }

    const targetAlmacenId = almacenId ? parseInt(almacenId, 10) : (req.user?.almacenId || 1);
    let creados = 0;
    let actualizados = 0;
    let errores = [];

    const Almacen = require('../models/Almacen');
    const todosAlmacenes = await Almacen.findAll({ attributes: ['id'] });

    for (let index = 0; index < items.length; index++) {
      const item = items[index];
      const fila = index + 2; // Considerando encabezado en fila 1

      if (!item.nombre || !String(item.nombre).trim()) {
        errores.push(`Fila ${fila}: El campo 'nombre' es obligatorio.`);
        continue;
      }

      try {
        const nombre = String(item.nombre).trim();
        const codigo_oem = item.codigo_oem ? String(item.codigo_oem).trim() : null;
        const tipo = String(item.tipo || 'producto').toLowerCase().includes('serv') ? 'servicio' : 'producto';
        
        const parseNum = (val, defaultVal = 0) => {
          if (val === undefined || val === null || val === '') return defaultVal;
          if (typeof val === 'string') {
            const cleaned = val.replace(/\$/g, '').replace(/\s/g, '').replace(/\./g, '').replace(',', '.');
            const parsed = parseFloat(cleaned);
            return isNaN(parsed) ? defaultVal : parsed;
          }
          return typeof val === 'number' ? val : defaultVal;
        };

        const precio = parseNum(item.precio, 0);
        const precio_detal = parseNum(item.precio_detal, precio);
        const precio_mayor = parseNum(item.precio_mayor, precio);
        const precio_almacen = parseNum(item.precio_almacen, precio);
        const costo = parseNum(item.costo, 0);
        const stock_minimo = parseNum(item.stock_minimo, 5);
        const stock_inicial = parseNum(item.stock_inicial, 0);

        // Buscar si existe por codigo_oem o por nombre
        let productoExistente = null;
        if (codigo_oem) {
          productoExistente = await Producto.findOne({ where: { codigo_oem } });
        }
        if (!productoExistente) {
          productoExistente = await Producto.findOne({ where: { nombre } });
        }

        const dataProd = {
          nombre,
          codigo_oem,
          descripcion: item.descripcion || null,
          categoria: item.categoria || 'General',
          marca: item.marca || null,
          modelo: item.modelo || null,
          compatibilidad: item.compatibilidad || null,
          tipo,
          precio,
          precio_detal,
          precio_mayor,
          precio_almacen,
          costo,
          stock_minimo,
          unidad_medida: item.unidad_medida || (tipo === 'servicio' ? 'Servicio' : 'Unidad'),
          ubicacion_bodega: item.ubicacion_bodega || null,
          proveedor: item.proveedor || null,
          lote: item.lote || null,
          fecha_vencimiento: item.fecha_vencimiento || null,
          activo: true
        };

        if (productoExistente) {
          if (actualizarExistentes) {
            await productoExistente.update(dataProd);
            actualizados++;

            if (stock_inicial > 0 && tipo !== 'servicio') {
              const [pa] = await ProductoAlmacen.findOrCreate({
                where: { productoId: productoExistente.id, almacenId: targetAlmacenId },
                defaults: { stock: stock_inicial }
              });
              pa.stock = stock_inicial;
              await pa.save();
            }
          } else {
            errores.push(`Fila ${fila}: Ya existe '${nombre}' (Omitido)`);
          }
        } else {
          const nuevo = await Producto.create(dataProd);
          creados++;

          if (tipo === 'servicio') {
            for (const alm of todosAlmacenes) {
              await ProductoAlmacen.findOrCreate({
                where: { productoId: nuevo.id, almacenId: alm.id },
                defaults: { stock: 0 }
              });
            }
          } else {
            await ProductoAlmacen.create({
              productoId: nuevo.id,
              almacenId: targetAlmacenId,
              stock: stock_inicial
            });
          }
        }
      } catch (rowErr) {
        errores.push(`Fila ${fila}: ${rowErr.message || 'Error al procesar'}`);
      }
    }

    res.json({
      ok: true,
      creados,
      actualizados,
      errores,
      total: items.length
    });
  } catch (error) {
    console.error('Error en /import-masivo productos:', error);
    res.status(500).json({ error: 'Error en la importación masiva de productos' });
  }
});

router.get('/:id/referencias', auth, requirePermiso('productos.ver'), async (req, res) => {
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

