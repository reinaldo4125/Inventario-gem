const express = require('express');
const router = express.Router();
const { Caja, Venta, Factura } = require('../models');
const { authRole } = require('../middleware/auth');
const { Op } = require('sequelize');

// Obtener estado de caja actual
router.get('/estado', authRole(['admin', 'vendedor']), async (req, res) => {
  try {
    const usuarioNombre = req.user ? (req.user.nombre || req.user.correo) : 'Usuario';
    const almacenId = req.user?.almacenId || 1;

    // Buscar turno de caja abierto
    const cajaAbierta = await Caja.findOne({
      where: {
        almacenId,
        estado: 'Abierta'
      },
      order: [['fecha_apertura', 'DESC']]
    });

    if (!cajaAbierta) {
      return res.json({ abierta: false, caja: null });
    }

    // Calcular ventas realizadas desde fecha_apertura
    const fechaInicio = cajaAbierta.fecha_apertura;

    const ventas = await Venta.findAll({
      where: {
        almacenId,
        fecha: { [Op.gte]: fechaInicio },
        estado: { [Op.ne]: 'Anulada' }
      }
    });

    const facturas = await Factura.findAll({
      where: {
        almacenId,
        fecha: { [Op.gte]: fechaInicio }
      }
    });

    let totalEfectivo = 0;
    let totalTransferencia = 0;
    let totalTarjeta = 0;
    let totalCredito = 0;
    let totalOtros = 0;
    let totalVentas = 0;

    const procesarPago = (metodo, monto) => {
      const m = Number(monto || 0);
      totalVentas += m;
      const mLower = String(metodo || '').toLowerCase();
      if (mLower.includes('efectivo')) totalEfectivo += m;
      else if (mLower.includes('transferencia') || mLower.includes('nequi') || mLower.includes('daviplata')) totalTransferencia += m;
      else if (mLower.includes('tarjeta') || mLower.includes('débito') || mLower.includes('crédito')) totalTarjeta += m;
      else if (mLower.includes('crédito') || mLower.includes('credito')) totalCredito += m;
      else totalOtros += m;
    };

    ventas.forEach(v => procesarPago(v.metodoPago, v.total));
    facturas.forEach(f => procesarPago(f.metodoPago, f.total));

    const montoApertura = Number(cajaAbierta.monto_apertura || 0);
    const efectivoEsperadoEnCaja = montoApertura + totalEfectivo;

    res.json({
      abierta: true,
      caja: cajaAbierta,
      resumen: {
        montoApertura,
        totalVentas,
        totalEfectivo,
        totalTransferencia,
        totalTarjeta,
        totalCredito,
        totalOtros,
        efectivoEsperadoEnCaja,
        cantidadTransacciones: ventas.length + facturas.length
      }
    });
  } catch (error) {
    console.error('Error al obtener estado de caja:', error);
    res.status(500).json({ error: 'Error al consultar estado de caja' });
  }
});

// Abrir turno de caja
router.post('/apertura', authRole(['admin', 'vendedor']), async (req, res) => {
  try {
    const { monto_apertura, observaciones } = req.body;
    const usuarioNombre = req.user ? (req.user.nombre || req.user.correo) : 'Usuario';
    const almacenId = req.user?.almacenId || 1;

    // Verificar si ya hay una caja abierta
    const cajaAbierta = await Caja.findOne({
      where: { almacenId, estado: 'Abierta' }
    });

    if (cajaAbierta) {
      return res.status(400).json({ error: 'Ya existe una caja abierta para esta sede. Debe realizar el cierre primero.' });
    }

    const nuevaCaja = await Caja.create({
      almacenId,
      usuarioNombre,
      monto_apertura: Number(monto_apertura || 0),
      fecha_apertura: new Date(),
      estado: 'Abierta',
      observaciones
    });

    res.status(201).json({ mensaje: 'Caja abierta con éxito', caja: nuevaCaja });
  } catch (error) {
    console.error('Error al abrir caja:', error);
    res.status(500).json({ error: 'Error al realizar apertura de caja' });
  }
});

// Cerrar turno de caja (Arqueo)
router.post('/cierre', authRole(['admin', 'vendedor']), async (req, res) => {
  try {
    const { monto_cierre, observaciones } = req.body;
    const usuarioNombre = req.user ? (req.user.nombre || req.user.correo) : 'Usuario';
    const almacenId = req.user?.almacenId || 1;

    const cajaAbierta = await Caja.findOne({
      where: { almacenId, estado: 'Abierta' }
    });

    if (!cajaAbierta) {
      return res.status(400).json({ error: 'No hay ninguna caja abierta para cerrar.' });
    }

    const fechaInicio = cajaAbierta.fecha_apertura;
    const ventas = await Venta.findAll({
      where: { almacenId, fecha: { [Op.gte]: fechaInicio }, estado: { [Op.ne]: 'Anulada' } }
    });
    const facturas = await Factura.findAll({
      where: { almacenId, fecha: { [Op.gte]: fechaInicio } }
    });

    let totalEfectivo = 0;
    let totalTransferencia = 0;
    let totalTarjeta = 0;
    let totalOtros = 0;

    const acumular = (metodo, monto) => {
      const m = Number(monto || 0);
      const mLower = String(metodo || '').toLowerCase();
      if (mLower.includes('efectivo')) totalEfectivo += m;
      else if (mLower.includes('transferencia') || mLower.includes('nequi') || mLower.includes('daviplata')) totalTransferencia += m;
      else if (mLower.includes('tarjeta')) totalTarjeta += m;
      else totalOtros += m;
    };

    ventas.forEach(v => acumular(v.metodoPago, v.total));
    facturas.forEach(f => acumular(f.metodoPago, f.total));

    const montoApertura = Number(cajaAbierta.monto_apertura || 0);
    const montoEsperado = montoApertura + totalEfectivo;
    const cierreFisico = Number(monto_cierre || 0);
    const diferencia = cierreFisico - montoEsperado;

    const resumenMetodos = JSON.stringify({
      apertura: montoApertura,
      efectivo: totalEfectivo,
      transferencia: totalTransferencia,
      tarjeta: totalTarjeta,
      otros: totalOtros,
      totalRecaudado: totalEfectivo + totalTransferencia + totalTarjeta + totalOtros
    });

    cajaAbierta.monto_cierre = cierreFisico;
    cajaAbierta.monto_esperado = montoEsperado;
    cajaAbierta.diferencia = diferencia;
    cajaAbierta.fecha_cierre = new Date();
    cajaAbierta.estado = 'Cerrada';
    cajaAbierta.observaciones = observaciones || cajaAbierta.observaciones;
    cajaAbierta.resumen_metodos = resumenMetodos;

    await cajaAbierta.save();

    res.json({
      mensaje: 'Cierre de caja (Arqueo) completado exitosamente',
      caja: cajaAbierta,
      resumen: {
        montoApertura,
        totalEfectivo,
        montoEsperado,
        cierreFisico,
        diferencia
      }
    });
  } catch (error) {
    console.error('Error al cerrar caja:', error);
    res.status(500).json({ error: 'Error al procesar el cierre de caja' });
  }
});

// Historial de cierres de caja
router.get('/historial', authRole(['admin', 'vendedor']), async (req, res) => {
  try {
    const historial = await Caja.findAll({
      order: [['fecha_apertura', 'DESC']],
      limit: 50
    });
    res.json(historial);
  } catch (error) {
    console.error('Error al obtener historial de cajas:', error);
    res.status(500).json({ error: 'Error al consultar historial de cajas' });
  }
});

module.exports = router;
