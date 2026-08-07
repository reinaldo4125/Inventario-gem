const express = require('express');
const { body, validationResult } = require('express-validator');
const { authRole, authToken } = require('./auth');
const router = express.Router();
const { Empresa } = require('../models');

// Obtener datos públicos de la empresa (logo, nombre, nit) para Login y cabeceras
router.get('/public', async (req, res) => {
  try {
    const empresa = await Empresa.findOne();
    if (!empresa) return res.status(404).json({ error: 'No hay datos de empresa' });
    res.json({
      nombre: empresa.nombre,
      nit: empresa.nit,
      logo_url: empresa.logo_url
    });
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener datos públicos de empresa' });
  }
});

// Obtener datos completos de la empresa (requiere token)
router.get('/', authToken, async (req, res) => {
  try {
    const empresa = await Empresa.findOne();
    if (!empresa) return res.status(404).json({ error: 'No hay datos de empresa' });
    res.json(empresa);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener datos de empresa' });
  }
});

// Crear o actualizar datos de la empresa
router.post('/', authRole(['admin']), [
  body('nombre').notEmpty().withMessage('El nombre de la empresa es obligatorio'),
  body('nit').notEmpty().withMessage('El NIT es obligatorio'),
  body('direccion').notEmpty().withMessage('La dirección es obligatoria'),
  body('telefono').notEmpty().withMessage('El teléfono es obligatorio'),
  body('correo').optional({ checkFalsy: true }).isEmail().withMessage('Correo inválido'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  try {
    let empresa = await Empresa.findOne();
    if (empresa) {
      await empresa.update(req.body);
    } else {
      empresa = await Empresa.create(req.body);
    }
    res.json(empresa);
  } catch (err) {
    res.status(500).json({ error: 'Error al guardar datos de empresa: ' + (err.message || '') });
  }
});

module.exports = router;
