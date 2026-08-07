const express = require('express');
const router = express.Router();
const { authRole } = require('../middleware/auth');
const models = require('../models');
const path = require('path');
const fs = require('fs');

// Exportar Backup Completo en JSON
router.get('/export-json', authRole(['admin']), async (req, res) => {
  try {
    const backupData = {
      fecha_exportacion: new Date().toISOString(),
      version: '1.0',
      empresas: await models.Empresa.findAll(),
      almacenes: await models.Almacen.findAll(),
      usuarios: await models.Usuario.findAll({ attributes: { exclude: ['password'] } }),
      clientes: await models.Cliente.findAll(),
      productos: await models.Producto.findAll(),
      producto_almacen: await models.ProductoAlmacen.findAll(),
      ventas: await models.Venta.findAll({ include: [{ model: models.DetalleVenta }] }),
      facturas: await models.Factura.findAll({ include: [{ model: models.DetalleFactura }] }),
      traslados: await models.Traslado.findAll({ include: [{ model: models.DetalleTraslado, as: 'detalles' }] }),
      cajas: await models.Caja.findAll(),
      kardex: await models.Kardex.findAll()
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="backup_multinyectores_${new Date().toISOString().slice(0, 10)}.json"`);
    res.send(JSON.stringify(backupData, null, 2));
  } catch (error) {
    console.error('Error al generar backup JSON:', error);
    res.status(500).json({ error: 'Error al generar la copia de seguridad' });
  }
});

// Descargar archivo sqlite si existe
router.get('/download-db', authRole(['admin']), async (req, res) => {
  try {
    const dbPath = path.join(__dirname, '../database.sqlite');
    if (fs.existsSync(dbPath)) {
      return res.download(dbPath, `database_multinyectores_${new Date().toISOString().slice(0, 10)}.sqlite`);
    } else {
      res.status(404).json({ error: 'El archivo de base de datos SQLite no fue encontrado' });
    }
  } catch (error) {
    console.error('Error al descargar BD SQLite:', error);
    res.status(500).json({ error: 'Error al procesar la descarga de la base de datos' });
  }
});

module.exports = router;
