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
    // Ejecutar modificación de columna de forma previa si el logo es extenso
    if (req.body.logo_url && req.body.logo_url.length > 50000) {
      const sequelize = Empresa.sequelize;
      const alterQueries = [
        "ALTER TABLE empresas MODIFY COLUMN logo_url LONGTEXT;",
        "ALTER TABLE empresas MODIFY logo_url LONGTEXT;",
        "ALTER TABLE empresas CHANGE logo_url logo_url LONGTEXT;",
        "ALTER TABLE Empresas MODIFY COLUMN logo_url LONGTEXT;",
        "ALTER TABLE Empresas MODIFY logo_url LONGTEXT;",
        "ALTER TABLE Empresas CHANGE logo_url logo_url LONGTEXT;"
      ];
      for (const queryStr of alterQueries) {
        try { await sequelize.query(queryStr); } catch (e) {}
      }
    }

    let empresa = await Empresa.findOne();
    if (empresa) {
      await empresa.update(req.body);
    } else {
      empresa = await Empresa.create(req.body);
    }
    res.json(empresa);
  } catch (err) {
    // Si la columna en MySQL aún es corta, intentar expandirla a LONGTEXT y reintentar
    const msg = (err.message || '').toLowerCase();
    if (msg.includes('data too long') || msg.includes('logo_url') || msg.includes('pie_pagina')) {
      try {
        const sequelize = Empresa.sequelize;
        const alterQueries = [
          "ALTER TABLE empresas MODIFY COLUMN logo_url LONGTEXT;",
          "ALTER TABLE empresas MODIFY logo_url LONGTEXT;",
          "ALTER TABLE empresas CHANGE logo_url logo_url LONGTEXT;",
          "ALTER TABLE Empresas MODIFY COLUMN logo_url LONGTEXT;",
          "ALTER TABLE Empresas MODIFY logo_url LONGTEXT;",
          "ALTER TABLE Empresas CHANGE logo_url logo_url LONGTEXT;",
          "ALTER TABLE empresas MODIFY COLUMN pie_pagina_factura LONGTEXT;",
          "ALTER TABLE empresas MODIFY pie_pagina_factura LONGTEXT;",
          "ALTER TABLE empresas CHANGE pie_pagina_factura pie_pagina_factura LONGTEXT;"
        ];
        for (const queryStr of alterQueries) {
          try { await sequelize.query(queryStr); } catch (e) {}
        }

        let empresa = await Empresa.findOne();
        if (empresa) {
          await empresa.update(req.body);
        } else {
          empresa = await Empresa.create(req.body);
        }
        return res.json(empresa);
      } catch (retryErr) {
        return res.status(500).json({ error: 'Error al guardar datos de empresa: ' + retryErr.message });
      }
    }
    res.status(500).json({ error: 'Error al guardar datos de empresa: ' + (err.message || '') });
  }
});

module.exports = router;
