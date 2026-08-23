const express = require('express');
const router = express.Router();
const pkg = require('../../package.json');

// Endpoint público para consultar la versión del sistema
router.get('/', (req, res) => {
  res.json({
    nombre: 'Multinyectores',
    version: pkg.version || '1.0.0',
    descripcion: pkg.description || 'Sistema de gestión de inventarios, ventas y facturación',
    entorno: process.env.NODE_ENV || 'production',
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
