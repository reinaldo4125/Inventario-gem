const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const sequelize = require('../database/sequelize');
const { 
  Cliente, Producto, Venta, DetalleVenta, Factura, 
  DetalleFactura, Almacen, ProductoAlmacen, ProductoCosto, DetalleTraslado, Kardex, Caja, Usuario 
} = require('../models');
const { Op } = require('sequelize');
const fs = require('fs');
const path = require('path');

// Endpoint diagnóstico: devuelve req.user y el token recibido
router.get('/whoami', auth, (req, res) => {
  const authHeader = req.headers.authorization || req.headers.Authorization || '';
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;
  res.json({ user: req.user || null, token });
});

// Estadísticas actuales de la Base de Datos
router.get('/db-stats', auth, async (req, res) => {
  try {
    const counts = {
      clientes: await Cliente.count(),
      productos: await Producto.count(),
      ventas: await Venta.count(),
      detallesVenta: await DetalleVenta.count(),
      facturas: await Factura.count(),
      kardex: await Kardex.count(),
      caja: await Caja.count(),
      almacenes: await Almacen.count(),
      usuarios: await Usuario.count()
    };

    const dbPath = path.join(__dirname, '..', 'database.sqlite');
    let dbSizeBytes = 0;
    if (fs.existsSync(dbPath)) {
      const stats = fs.statSync(dbPath);
      dbSizeBytes = stats.size;
    }

    const memoryUsage = process.memoryUsage();

    res.json({
      counts,
      dbSizeBytes,
      dbSizeMB: (dbSizeBytes / (1024 * 1024)).toFixed(2),
      memoryUsage: {
        heapUsedMB: (memoryUsage.heapUsed / (1024 * 1024)).toFixed(2),
        heapTotalMB: (memoryUsage.heapTotal / (1024 * 1024)).toFixed(2),
        rssMB: (memoryUsage.rss / (1024 * 1024)).toFixed(2)
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Error al consultar métricas de BD: ' + err.message });
  }
});

// Generador de Carga / Prueba de Estrés (Seed en Lote)
router.post('/seed-stress', auth, async (req, res) => {
  const inicioTime = Date.now();
  try {
    const { 
      cantidadClientes = 50, 
      cantidadProductos = 100, 
      cantidadVentas = 200 
    } = req.body;

    const almacenDefecto = await Almacen.findOne() || { id: 1 };
    const almacenId = almacenDefecto.id || 1;

    // 1. Crear Clientes de Prueba
    const clientesData = [];
    const nowTs = Date.now();
    for (let i = 1; i <= Number(cantidadClientes); i++) {
      const docNum = `${nowTs.toString().slice(-6)}${i}${Math.floor(1000 + Math.random() * 9000)}`;
      clientesData.push({
        almacenId,
        nombre: `[PRUEBA] Cliente Test ${i}_${nowTs}_${Math.floor(Math.random() * 1000)}`,
        empresa: `Empresa Pruebas ${i}`,
        tipo_cliente: i % 3 === 0 ? 'Mayorista' : i % 2 === 0 ? 'Taller' : 'Detal',
        documento: docNum,
        tipo_documento: 'NIT',
        telefono: `300${Math.floor(1000000 + Math.random() * 9000000)}`,
        correo: `test_cliente_${nowTs}_${i}_${Math.floor(Math.random() * 1000)}@prueba.com`,
        direccion: `Calle Pruebas #${i}-10`,
        monto_credito: 1000000,
        estado: 'Activo'
      });
    }
    const clientesCreados = await Cliente.bulkCreate(clientesData, { ignoreDuplicates: true, returning: true });

    // 2. Crear Productos de Prueba
    const categorias = ['Inyectores', 'Bombas', 'Empaques', 'Sensores', 'Repuestos', 'Servicios'];
    const marcas = ['Bosch', 'Denso', 'Delphi', 'Siemens', 'Continental'];
    const productosData = [];

    for (let i = 1; i <= Number(cantidadProductos); i++) {
      const precioUnit = Math.floor(20000 + Math.random() * 500000);
      const costoUnit = Math.floor(precioUnit * 0.6);
      const esServicio = i % 5 === 0;

      productosData.push({
        nombre: `[PRUEBA] ${esServicio ? 'Servicio' : 'Producto'} Test ${i}_${nowTs}_${Math.floor(Math.random() * 1000)}`,
        descripcion: `Descripción de prueba estrés #${i}`,
        categoria: esServicio ? 'Servicios' : categorias[i % categorias.length],
        marca: marcas[i % marcas.length],
        modelo: `MOD-${100 + i}`,
        codigo_oem: `OEM-${nowTs.toString().slice(-6)}-${i}-${Math.floor(Math.random() * 1000)}`,
        stock: esServicio ? 9999 : Math.floor(10 + Math.random() * 200),
        stock_minimo: 5,
        precio: precioUnit,
        precio_detal: precioUnit,
        precio_mayor: Math.floor(precioUnit * 0.85),
        precio_mayorista: Math.floor(precioUnit * 0.85),
        precio_taller: Math.floor(precioUnit * 0.90),
        costo: costoUnit,
        tipo: esServicio ? 'servicio' : 'producto',
        ubicacion_bodega: `Pasillo A-${i % 10}`
      });
    }
    const productosCreados = await Producto.bulkCreate(productosData, { ignoreDuplicates: true, returning: true });

    // Asignar stock en ProductoAlmacen
    const prodAlmacenData = productosCreados.map(p => ({
      productoId: p.id,
      almacenId,
      stock: p.stock
    }));
    await ProductoAlmacen.bulkCreate(prodAlmacenData, { ignoreDuplicates: true });

    // 3. Crear Ventas y Detalles
    const metodosPago = ['Efectivo', 'Transferencia', 'Tarjeta', 'Credito'];
    let totalVentasMonto = 0;
    let totalDetallesCount = 0;

    for (let i = 1; i <= Number(cantidadVentas); i++) {
      const clienteRandom = clientesCreados[Math.floor(Math.random() * clientesCreados.length)] || clientesCreados[0];
      const metodo = metodosPago[Math.floor(Math.random() * metodosPago.length)];
      
      // Selección de 1 a 4 productos
      const numItems = Math.floor(1 + Math.random() * 4);
      let subtotalVenta = 0;
      const itemsVenta = [];

      for (let j = 0; j < numItems; j++) {
        const prod = productosCreados[Math.floor(Math.random() * productosCreados.length)] || productosCreados[0];
        const cant = Math.floor(1 + Math.random() * 5);
        const pUnit = prod.precio_detal;
        const totalLine = cant * pUnit;
        subtotalVenta += totalLine;

        itemsVenta.push({
          productoId: prod.id,
          cantidad: cant,
          precio_unitario: pUnit,
          subtotal: totalLine
        });
      }

      totalVentasMonto += subtotalVenta;

      // Fecha aleatoria dentro de los últimos 30 días
      const diasAtras = Math.floor(Math.random() * 30);
      const fechaVenta = new Date(Date.now() - diasAtras * 24 * 60 * 60 * 1000);

      const nuevaVenta = await Venta.create({
        clienteId: clienteRandom.id,
        metodoPago: metodo,
        subtotal: subtotalVenta,
        descuento: 0,
        total: subtotalVenta,
        almacenId,
        vendedor: 'Vendedor Test',
        estado: metodo === 'Credito' ? 'Pendiente' : 'Pagada',
        fecha: fechaVenta
      });

      const detallesConId = itemsVenta.map(item => ({
        ...item,
        ventaId: nuevaVenta.id
      }));

      await DetalleVenta.bulkCreate(detallesConId);
      totalDetallesCount += itemsVenta.length;

      // Movimientos de Kardex
      const kardexData = itemsVenta.map(item => ({
        productoId: item.productoId,
        almacenId,
        tipo: 'Salida',
        cantidad: item.cantidad,
        origen_destino: `Venta Pruebas Estrés #${nuevaVenta.id}`,
        usuario: req.user?.nombre || 'Tester',
        fecha: fechaVenta
      }));
      await Kardex.bulkCreate(kardexData);
    }

    const duracionMs = Date.now() - inicioTime;

    res.json({
      exito: true,
      mensaje: `¡Prueba de estrés/carga generada en ${duracionMs} ms!`,
      resumenGenerado: {
        clientes: clientesCreados.length,
        productos: productosCreados.length,
        ventas: Number(cantidadVentas),
        detallesVenta: totalDetallesCount,
        montoTotalFacturado: totalVentasMonto,
        tiempoEjecucionMs: duracionMs,
        registrosPorSegundo: Math.round(((clientesCreados.length + productosCreados.length + Number(cantidadVentas) + totalDetallesCount) / (duracionMs || 1)) * 1000)
      }
    });

  } catch (err) {
    console.error('Error en seed-stress:', err);
    res.status(500).json({ error: 'Error durante la prueba de estrés: ' + err.message });
  }
});

// Benchmark de Consultas de Alto Rendimiento
router.get('/benchmark', auth, async (req, res) => {
  const resultados = [];

  const medir = async (nombre, fn) => {
    const t0 = Date.now();
    const resFn = await fn();
    const ms = Date.now() - t0;
    resultados.push({ operacion: nombre, tiempoMs: ms, registros: Array.isArray(resFn) ? resFn.length : 1 });
  };

  try {
    // Test 1: Búsqueda y paginado de Productos
    await medir('Consulta Búsqueda Productos (ILIKE/Op.like)', async () => {
      return await Producto.findAll({
        where: {
          [Op.or]: [
            { nombre: { [Op.like]: '%Test%' } },
            { categoria: { [Op.like]: '%Inyectores%' } }
          ]
        },
        limit: 100
      });
    });

    // Test 2: Búsqueda y orden de Ventas con relaciones
    await medir('Consulta Ventas con Clientes y Detalles (JOIN)', async () => {
      return await Venta.findAll({
        limit: 100,
        order: [['id', 'DESC']],
        include: [{ model: DetalleVenta }]
      });
    });

    // Test 3: Conteo Kardex por Producto
    await medir('Agregación Movimientos Kardex', async () => {
      return await Kardex.findAll({
        limit: 200,
        order: [['id', 'DESC']]
      });
    });

    // Test 4: Conteo general de Clientes
    await medir('Conteo general de Clientes', async () => {
      return await Cliente.findAll({ limit: 500 });
    });

    const totalMs = resultados.reduce((a, b) => a + b.tiempoMs, 0);

    res.json({
      estado: 'Completado',
      tiempoTotalPruebasMs: totalMs,
      desglose: resultados,
      memoriaActualMB: (process.memoryUsage().heapUsed / (1024 * 1024)).toFixed(2)
    });
  } catch (err) {
    res.status(500).json({ error: 'Error al ejecutar benchmark: ' + err.message });
  }
});

// Limpiar todos los datos generados durante las Pruebas de Estrés
router.delete('/clean-stress', auth, async (req, res) => {
  try {
    // 1. Identificar Clientes de prueba
    const clientesTest = await Cliente.findAll({
      where: {
        [Op.or]: [
          { nombre: { [Op.like]: '%[PRUEBA]%' } },
          { empresa: { [Op.like]: '%Empresa Pruebas%' } },
          { correo: { [Op.like]: '%@prueba.com%' } }
        ]
      }
    });
    const clienteIds = clientesTest.map(c => c.id);

    // 2. Identificar Productos de prueba
    const productosTest = await Producto.findAll({
      where: {
        [Op.or]: [
          { nombre: { [Op.like]: '%[PRUEBA]%' } },
          { descripcion: { [Op.like]: '%prueba estrés%' } },
          { codigo_oem: { [Op.like]: '%OEM-%' } }
        ]
      }
    });
    const productoIds = productosTest.map(p => p.id);

    // 3. Identificar Ventas de prueba
    const condicionesVentas = [{ vendedor: 'Vendedor Test' }];
    if (clienteIds.length > 0) {
      condicionesVentas.push({ clienteId: { [Op.in]: clienteIds } });
    }

    const ventasTest = await Venta.findAll({
      where: {
        [Op.or]: condicionesVentas
      }
    });
    const ventaIds = ventasTest.map(v => v.id);

    const isSqlite = sequelize.options.dialect === 'sqlite';

    if (isSqlite) {
      await sequelize.query('PRAGMA foreign_keys = OFF;');
    }

    try {
      // Eliminar detalles de ventas
      const detVentaConditions = [];
      if (ventaIds.length > 0) detVentaConditions.push({ ventaId: { [Op.in]: ventaIds } });
      if (productoIds.length > 0) detVentaConditions.push({ productoId: { [Op.in]: productoIds } });

      if (detVentaConditions.length > 0) {
        await DetalleVenta.destroy({ where: { [Op.or]: detVentaConditions } });
      }

      // Eliminar ventas
      if (ventaIds.length > 0) {
        await Venta.destroy({ where: { id: { [Op.in]: ventaIds } } });
      }

      // Eliminar relaciones de producto
      if (productoIds.length > 0) {
        await ProductoAlmacen.destroy({ where: { productoId: { [Op.in]: productoIds } } });
        await Kardex.destroy({ where: { productoId: { [Op.in]: productoIds } } });
        if (ProductoCosto) await ProductoCosto.destroy({ where: { productoId: { [Op.in]: productoIds } } });
        if (DetalleTraslado) await DetalleTraslado.destroy({ where: { productoId: { [Op.in]: productoIds } } });
        await Producto.destroy({ where: { id: { [Op.in]: productoIds } } });
      }

      // Eliminar clientes
      if (clienteIds.length > 0) {
        await Cliente.destroy({ where: { id: { [Op.in]: clienteIds } } });
      }

      // Limpiar Kardex por origen_destino
      await Kardex.destroy({
        where: {
          [Op.or]: [
            { origen_destino: { [Op.like]: '%Pruebas Estrés%' } },
            { origen_destino: { [Op.like]: '%[PRUEBA]%' } }
          ]
        }
      });
    } finally {
      if (isSqlite) {
        await sequelize.query('PRAGMA foreign_keys = ON;');
      }
    }

    res.json({
      exito: true,
      mensaje: '🧹 Se han limpiado y purgado todos los registros de prueba de estrés correctamente.',
      eliminados: {
        clientes: clienteIds.length,
        productos: productoIds.length,
        ventas: ventaIds.length
      }
    });
  } catch (err) {
    console.error('Error al limpiar datos de prueba:', err);
    res.status(500).json({ error: 'Error al limpiar datos de prueba: ' + err.message });
  }
});

module.exports = router;

