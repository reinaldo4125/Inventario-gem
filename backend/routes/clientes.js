const express = require('express');
const { body, validationResult } = require('express-validator');
const { authRole, authToken } = require('./auth');
const { Op } = require('sequelize');
const router = express.Router();
const Cliente = require('../models/Cliente');
const Almacen = require('../models/Almacen');

// Obtener todos los clientes
router.get('/', authToken, async (req, res) => {
  try {
    let where = {};
    if (req.user.rol === 'admin') {
      if (req.query.almacenId) {
        where.almacenId = req.query.almacenId;
      }
    } else if (req.user.almacenId) {
      // Vendedores o personal de almacén ven los de su almacén y los generales (sin almacén)
      where = {
        [Op.or]: [
          { almacenId: req.user.almacenId },
          { almacenId: null }
        ]
      };
    }

    const clientes = await Cliente.findAll({
      where,
      include: [{ model: Almacen, as: 'almacen', attributes: ['id', 'nombre'] }],
      order: [['id', 'DESC']]
    });

    // Marcar clientes sin almacén
    const clientesMarcados = clientes.map(c => ({
      ...c.toJSON(),
      sinAlmacen: !c.almacenId || c.almacenId === null
    }));

    res.json(clientesMarcados);
  } catch (error) {
    console.error('Error al obtener clientes:', error);
    res.status(500).json({ error: 'Error al obtener clientes: ' + error.message });
  }
});

// Obtener solo clientes sin almacén asignado
router.get('/sin-almacen', authToken, async (req, res) => {
  try {
    const clientes = await Cliente.findAll({
      where: { almacenId: null },
      include: [{ model: Almacen, as: 'almacen', attributes: ['id', 'nombre'] }]
    });
    res.json(clientes);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener clientes sin almacén: ' + error.message });
  }
});

// Obtener un cliente por ID
router.get('/:id', authToken, async (req, res) => {
  try {
    const cliente = await Cliente.findByPk(req.params.id);
    if (!cliente) return res.status(404).json({ error: 'Cliente no encontrado' });
    res.json(cliente);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener cliente' });
  }
});

// Crear un nuevo cliente
router.post('/', authRole(['admin', 'vendedor']), [
  body('nombre').notEmpty().withMessage('El nombre es obligatorio'),
  body('documento').notEmpty().withMessage('El documento es obligatorio'),
  body('tipo_cliente').notEmpty().withMessage('El tipo de cliente es obligatorio'),
  body('correo').optional({ checkFalsy: true }).isEmail().withMessage('Correo electrónico inválido'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  try {
    const { documento } = req.body;
    if (documento) {
      const existeDoc = await Cliente.findOne({ where: { documento } });
      if (existeDoc) {
        return res.status(400).json({ error: 'Ya existe un cliente registrado con este número de documento/NIT.' });
      }
    }

    let data = { ...req.body };
    if (!data.almacenId) {
      data.almacenId = req.user.almacenId || null;
    }
    if (data.descuentoEspecial) data.descuentoEspecial = parseFloat(data.descuentoEspecial) || 0;
    if (data.cupoCredito) data.cupoCredito = parseFloat(data.cupoCredito) || 0;

    const nuevo = await Cliente.create(data);
    res.status(201).json(nuevo);
  } catch (error) {
    res.status(400).json({ error: 'Error al crear cliente: ' + error.message });
  }
});

// Actualizar un cliente
router.put('/:id', authRole(['admin', 'vendedor']), [
  body('nombre').notEmpty().withMessage('El nombre es obligatorio'),
  body('documento').notEmpty().withMessage('El documento es obligatorio'),
  body('tipo_cliente').notEmpty().withMessage('El tipo de cliente es obligatorio'),
  body('correo').optional({ checkFalsy: true }).isEmail().withMessage('Correo electrónico inválido'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  try {
    const { id } = req.params;
    const cliente = await Cliente.findByPk(id);
    if (!cliente) return res.status(404).json({ error: 'Cliente no encontrado' });

    const { documento } = req.body;
    if (documento && documento !== cliente.documento) {
      const existeDoc = await Cliente.findOne({ where: { documento } });
      if (existeDoc) {
        return res.status(400).json({ error: 'Ya existe otro cliente con este número de documento/NIT.' });
      }
    }

    let updateData = { ...req.body };
    if (updateData.descuentoEspecial !== undefined) updateData.descuentoEspecial = parseFloat(updateData.descuentoEspecial) || 0;
    if (updateData.cupoCredito !== undefined) updateData.cupoCredito = parseFloat(updateData.cupoCredito) || 0;

    await cliente.update(updateData);
    res.json(cliente);
  } catch (error) {
    res.status(400).json({ error: 'Error al actualizar cliente: ' + error.message });
  }
});

// Cambiar estado Activo / Inactivo de un cliente
router.patch('/:id/toggle-estado', authRole(['admin', 'vendedor']), async (req, res) => {
  try {
    const cliente = await Cliente.findByPk(req.params.id);
    if (!cliente) return res.status(404).json({ error: 'Cliente no encontrado' });

    cliente.activo = !cliente.activo;
    await cliente.save();
    res.json({ mensaje: `Cliente ${cliente.activo ? 'activado' : 'desactivado'} correctamente`, activo: cliente.activo });
  } catch (error) {
    res.status(500).json({ error: 'Error al cambiar estado del cliente' });
  }
});

// Eliminar un cliente
router.delete('/:id', authRole(['admin']), async (req, res) => {
  try {
    const cliente = await Cliente.findByPk(req.params.id);
    if (!cliente) return res.status(404).json({ error: 'Cliente no encontrado' });
    await cliente.destroy();
    res.json({ mensaje: 'Cliente eliminado' });
  } catch (error) {
    res.status(500).json({ error: 'Error al eliminar cliente' });
  }
});

module.exports = router;
