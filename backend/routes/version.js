const express = require('express');
const router = express.Router();

let pkg = { version: '1.0.0', description: 'Sistema de gestión de inventarios, ventas y facturación' };
try {
  pkg = require('../package.json');
} catch (e) {
  try {
    pkg = require('../../package.json');
  } catch (err) {}
}

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

