const express = require('express');
const { body, validationResult } = require('express-validator');
const auth = require('../middleware/auth');
const requirePermiso = require('../middleware/roles');
const { almacenDelUsuario } = require('../utils/almacenScope');
const { Op } = require('sequelize');
const router = express.Router();
const Cliente = require('../models/Cliente');
const Almacen = require('../models/Almacen');

// Obtener todos los clientes
router.get('/', auth, async (req, res) => {
  try {
    let where = {};
    const scopedAlmacenId = almacenDelUsuario(req, res);
    if (scopedAlmacenId === undefined && req.user.rol !== 'admin') return;

    if (req.user.rol === 'admin') {
      if (scopedAlmacenId) {
        where.almacenId = scopedAlmacenId;
      }
    } else if (scopedAlmacenId) {
      // Vendedores o administradores de punto ven los de su almacén y los generales (sin almacén)
      where = {
        [Op.or]: [
          { almacenId: scopedAlmacenId },
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

// Obtener clientes sin almacén asignado
router.get('/sin-almacen', auth, async (req, res) => {
  try {
    const clientes = await Cliente.findAll({
      where: { almacenId: null },
      order: [['nombre', 'ASC']]
    });
    res.json(clientes);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener clientes sin almacén' });
  }
});

// Obtener cliente por ID
router.get('/:id', auth, async (req, res) => {
  try {
    const cliente = await Cliente.findByPk(req.params.id, {
      include: [{ model: Almacen, as: 'almacen' }]
    });
    if (!cliente) return res.status(404).json({ error: 'Cliente no encontrado' });
    res.json(cliente);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener cliente' });
  }
});

// Crear un nuevo cliente
router.post('/', auth, requirePermiso('clientes.crear'), [
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
router.put('/:id', auth, requirePermiso('clientes.editar'), [
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

// Carga masiva de clientes desde CSV
router.post('/import-masivo', auth, requirePermiso('clientes.crear'), async (req, res) => {
  try {
    const { items, actualizarExistentes } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'No se enviaron clientes para importar' });
    }

    let creados = 0;
    let actualizados = 0;
    let errores = [];

    for (const item of items) {
      try {
        if (!item.documento || !item.nombre) {
          errores.push(`Fila sin nombre o documento: ${JSON.stringify(item)}`);
          continue;
        }

        const existe = await Cliente.findOne({ where: { documento: String(item.documento).trim() } });
        if (existe) {
          if (actualizarExistentes) {
            await existe.update({
              nombre: item.nombre || existe.nombre,
              telefono: item.telefono || existe.telefono,
              direccion: item.direccion || existe.direccion,
              correo: item.correo || existe.correo,
              tipo_cliente: item.tipo_cliente || existe.tipo_cliente,
              ciudad: item.ciudad || existe.ciudad
            });
            actualizados++;
          }
        } else {
          await Cliente.create({
            documento: String(item.documento).trim(),
            nombre: item.nombre,
            tipo_documento: item.tipo_documento || 'CC',
            telefono: item.telefono || '',
            direccion: item.direccion || '',
            correo: item.correo || '',
            tipo_cliente: item.tipo_cliente || 'Final',
            ciudad: item.ciudad || '',
            almacenId: req.user.almacenId || item.almacenId || null,
            activo: true
          });
          creados++;
        }
      } catch (errFila) {
        errores.push(`Error en documento ${item.documento}: ${errFila.message}`);
      }
    }

    res.json({
      mensaje: `Importación completada: ${creados} creados, ${actualizados} actualizados`,
      creados,
      actualizados,
      errores,
      total: items.length
    });
  } catch (error) {
    console.error('Error en /import-masivo clientes:', error);
    res.status(500).json({ error: 'Error en la importación masiva de clientes' });
  }
});

// Cambiar estado Activo / Inactivo de un cliente
router.patch('/:id/toggle-estado', auth, requirePermiso('clientes.editar'), async (req, res) => {
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

// Eliminar un cliente (solo admin con clientes.borrar)
router.delete('/:id', auth, requirePermiso('clientes.borrar'), async (req, res) => {
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
