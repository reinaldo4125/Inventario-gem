const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const requirePermiso = require('../middleware/roles');
const { almacenDelUsuario } = require('../utils/almacenScope');
const { Op } = require('sequelize');
const sequelize = require('../database/sequelize');

const Factura = require('../models/Factura');
const Venta = require('../models/Venta');
const Cliente = require('../models/Cliente');
const Almacen = require('../models/Almacen');
const Empresa = require('../models/Empresa');
const Abono = require('../models/Abono');

// 1. OBTENER ESTADO GENERAL DE CARTERA Y CUENTAS POR COBRAR
router.get('/', auth, requirePermiso('cartera.ver'), async (req, res) => {
  try {
    const { filtroEstado = 'Pendientes', q = '' } = req.query;
    const usuario = req.user || {};
    const isAdmin = usuario.rol === 'admin';

    // Obtener todas las facturas
    const whereFactura = {};
    const scopedAlmacenId = almacenDelUsuario(req, res);
    if (scopedAlmacenId === undefined && !isAdmin) return;
    if (scopedAlmacenId) {
      whereFactura.almacenId = scopedAlmacenId;
    }

    // Traer todas las facturas con sus abonos, venta y almacén
    const facturas = await Factura.findAll({
      where: whereFactura,
      include: [
        { model: Almacen, as: 'almacen' },
        { model: Venta, as: 'venta' },
        { 
          model: Abono, 
          as: 'Abonos',
          order: [['fecha', 'DESC']]
        }
      ],
      order: [['fecha', 'DESC']]
    });

    // Mapear y calcular saldos de cartera
    const now = new Date();
    let carteraItems = [];

    let kpiTotalCartera = 0;
    let kpiTotalVencido = 0;
    let kpiTotalAlDia = 0;
    const clientesDeudoresSet = new Set();

    for (const f of facturas) {
      const venta = f.venta;
      const metodoPago = (venta && venta.metodoPago) || f.metodoPago || '';
      const estadoVenta = venta ? venta.estado : (f.notas && f.notas.includes('[ANULADA]') ? 'Anulada' : 'Pagada');

      const isAnulada = estadoVenta === 'Anulada' || (f.notas && f.notas.includes('[ANULADA]'));
      if (isAnulada) continue;

      const totalFactura = Number(f.total || 0);
      const abonos = f.Abonos || [];
      const totalAbonado = abonos.reduce((acc, ab) => acc + Number(ab.monto || 0), 0);
      const saldoPendiente = Math.max(0, totalFactura - totalAbonado);

      // Determinar si aplica a cartera:
      // - Si el método de pago contiene "credito" o "crédito"
      // - O si la venta fue registrada o marcada como 'En Cartera'
      // - O si ya tiene abonos registrados en cartera
      const esMetodoCredito = Boolean(
        metodoPago && (
          metodoPago.toLowerCase().includes('credito') || 
          metodoPago.toLowerCase().includes('crédito')
        )
      );
      const tieneAbonos = abonos.length > 0;
      const ventaEnCartera = estadoVenta === 'En Cartera';

      // REGLA: Ventas de contado / pago total (Efectivo, Tarjeta, Transferencia, Mixto, etc.)
      // que NO sean a crédito y NO tengan abonos registrados, NUNCA deben entrar a Cartera.
      if (!esMetodoCredito && !ventaEnCartera && !tieneAbonos) {
        continue;
      }

      // Si es de contado y su estado es Pagada, no debe estar en cartera
      if (!esMetodoCredito && estadoVenta === 'Pagada' && saldoPendiente <= 0.01) {
        continue;
      }

      // Calcular fechas de vencimiento (por defecto 30 días de crédito comercial)
      const plazoDias = 30;
      const fechaEmision = f.fecha ? new Date(f.fecha) : new Date();
      const fechaVencimiento = new Date(fechaEmision.getTime() + (plazoDias * 24 * 60 * 60 * 1000));
      
      const diffMs = now.getTime() - fechaVencimiento.getTime();
      const diasVencido = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      let estadoCartera = 'Al Día';
      if (saldoPendiente <= 0.01) {
        estadoCartera = 'Paz y Salvo';
        // Sincronizar estado de venta a Pagada si estaba pendiente o en cartera
        if (venta && venta.estado !== 'Pagada') {
          venta.estado = 'Pagada';
          await venta.save();
        }
      } else if (diasVencido > 0) {
        estadoCartera = 'Vencida';
      } else {
        estadoCartera = 'Al Día';
      }

      // Sumar KPIs solo de cuentas activas (con saldo pendiente > 0)
      if (saldoPendiente > 0.01) {
        kpiTotalCartera += saldoPendiente;
        if (estadoCartera === 'Vencida') {
          kpiTotalVencido += saldoPendiente;
        } else {
          kpiTotalAlDia += saldoPendiente;
        }
        if (f.cliente) {
          clientesDeudoresSet.add(f.cliente.trim().toLowerCase());
        }
      }

      const item = {
        id: f.id,
        facturaNo: `FAC-${f.id}`,
        cliente: f.cliente,
        documento: f.documento,
        telefono: f.telefono,
        direccion: f.direccion,
        correo: f.correo,
        almacenNombre: f.almacen?.nombre || (venta && venta.almacen?.nombre) || 'Sede Principal',
        total: totalFactura,
        totalAbonado,
        saldoPendiente,
        fechaEmision: f.fecha,
        plazoDias,
        fechaVencimiento: fechaVencimiento.toISOString(),
        diasVencido,
        estadoCartera,
        metodoPago: metodoPago || f.metodoPago || 'Crédito',
        notas: f.notas,
        abonos: abonos.map(ab => ({
          id: ab.id,
          recibo_caja_no: ab.recibo_caja_no || `RC-${ab.id}`,
          monto: Number(ab.monto),
          saldo_anterior: Number(ab.saldo_anterior),
          saldo_nuevo: Number(ab.saldo_nuevo),
          metodoPago: ab.metodoPago,
          referencia: ab.referencia,
          observaciones: ab.observaciones,
          usuarioNombre: ab.usuarioNombre,
          fecha: ab.fecha
        }))
      };

      // Filtro de búsqueda
      if (q && q.trim()) {
        const term = q.trim().toLowerCase();
        const coincide = (
          (item.cliente && item.cliente.toLowerCase().includes(term)) ||
          (item.documento && item.documento.toLowerCase().includes(term)) ||
          item.facturaNo.toLowerCase().includes(term) ||
          String(item.id) === term
        );
        if (!coincide) continue;
      }

      // Filtro de Estado:
      // Cuando la cartera esté en 0 (Paz y Salvo), NO debe reflejarse en la lista activa de Cartera (Pendientes por cobrar)
      if ((filtroEstado === 'Pendientes' || !filtroEstado) && estadoCartera === 'Paz y Salvo') continue;
      if (filtroEstado === 'Vencidas' && estadoCartera !== 'Vencida') continue;
      if (filtroEstado === 'AlDia' && estadoCartera !== 'Al Día') continue;
      if (filtroEstado === 'PazYSalvo' && estadoCartera !== 'Paz y Salvo') continue;

      carteraItems.push(item);
    }

    // Calcular recaudos del mes
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const abonosMes = await Abono.sum('monto', {
      where: {
        fecha: { [Op.gte]: startOfMonth }
      }
    });

    res.json({
      items: carteraItems,
      kpis: {
        totalCartera: kpiTotalCartera,
        totalVencido: kpiTotalVencido,
        totalAlDia: kpiTotalAlDia,
        clientesDeudores: clientesDeudoresSet.size,
        totalRecaudadoMes: abonosMes || 0
      }
    });
  } catch (error) {
    console.error('[cartera] GET / error:', error);
    res.status(500).json({ error: 'Error al consultar cartera: ' + error.message });
  }
});

// 2. REGISTRAR ABONO PARCIAL O TOTAL CON RECIBO DE CAJA
router.post('/:facturaId/abono', auth, requirePermiso('cartera.abonar'), async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { facturaId } = req.params;
    const { monto, metodoPago = 'Efectivo', referencia = '', observaciones = '' } = req.body || {};
    const usuario = req.user || {};

    const montoNum = parseFloat(monto);
    if (isNaN(montoNum) || montoNum <= 0) {
      await t.rollback();
      return res.status(400).json({ error: 'El monto del abono debe ser mayor a cero ($0).' });
    }

    const factura = await Factura.findByPk(facturaId, {
      include: [{ model: Abono, as: 'Abonos' }],
      transaction: t
    });

    if (!factura) {
      await t.rollback();
      return res.status(404).json({ error: 'Factura no encontrada' });
    }

    if (usuario.rol !== 'admin' && factura.almacenId !== usuario.almacenId) {
      await t.rollback();
      return res.status(403).json({ error: 'No puede registrar abonos para otra sede' });
    }

    if (factura.notas && factura.notas.includes('[ANULADA]')) {
      await t.rollback();
      return res.status(400).json({ error: 'No se pueden registrar abonos a una factura anulada.' });
    }

    // Calcular saldo actual
    const totalFactura = Number(factura.total || 0);
    const abonosPrevios = factura.Abonos || [];
    const totalAbonadoPrevio = abonosPrevios.reduce((acc, ab) => acc + Number(ab.monto || 0), 0);
    const saldoAnterior = Math.max(0, totalFactura - totalAbonadoPrevio);

    if (montoNum > (saldoAnterior + 0.01)) {
      await t.rollback();
      return res.status(400).json({ 
        error: `El abono ($${montoNum.toLocaleString('es-CO')}) excede el saldo pendiente ($${saldoAnterior.toLocaleString('es-CO')}).` 
      });
    }

    const saldoNuevo = Math.max(0, saldoAnterior - montoNum);

    // Crear el registro de Abono
    const nuevoAbono = await Abono.create({
      facturaId: factura.id,
      clienteNombre: factura.cliente,
      documento: factura.documento,
      telefono: factura.telefono,
      monto: montoNum,
      saldo_anterior: saldoAnterior,
      saldo_nuevo: saldoNuevo,
      metodoPago: metodoPago || 'Efectivo',
      referencia: referencia || null,
      observaciones: observaciones || null,
      usuarioNombre: usuario.nombre || 'Caja Multinyectores',
      fecha: new Date()
    }, { transaction: t });

    // Asignar número consecutivo de Recibo de Caja
    const reciboCajaNo = `RC-${nuevoAbono.id}`;
    nuevoAbono.recibo_caja_no = reciboCajaNo;
    await nuevoAbono.save({ transaction: t });

    // Actualizar notas de auditoría en la factura si queda en Paz y Salvo
    if (saldoNuevo <= 0.01) {
      const pazYSalvoNota = `[PAZ Y SALVO] Crédito cancelado en su totalidad mediante Recibo ${reciboCajaNo} (${new Date().toLocaleDateString('es-CO')})`;
      factura.notas = factura.notas ? `${factura.notas} | ${pazYSalvoNota}` : pazYSalvoNota;
      await factura.save({ transaction: t });

      // Actualizar venta asociada si existe
      const venta = await Venta.findOne({ where: { facturaId: factura.id }, transaction: t });
      if (venta) {
        venta.estado = 'Pagada';
        venta.notas = venta.notas ? `${venta.notas} | ${pazYSalvoNota}` : pazYSalvoNota;
        await venta.save({ transaction: t });
      }
    }

    await t.commit();

    // Obtener datos de empresa para comprobante
    let empresa = await Empresa.findOne();
    empresa = empresa ? empresa.get({ plain: true }) : {
      nombre: 'MULTINYECTORES COLOMBIA',
      nit: '900.123.456-7',
      direccion: 'Carrera 26 # 28-45, Tuluá - Valle del Cauca',
      telefono: '(602) 224-5000'
    };

    res.json({
      mensaje: `¡Abono de $${montoNum.toLocaleString('es-CO')} registrado exitosamente con Recibo ${reciboCajaNo}!`,
      abono: {
        ...nuevoAbono.get({ plain: true }),
        id: nuevoAbono.id,
        numeroRecibo: reciboCajaNo,
        saldoAnterior,
        saldoRestante: saldoNuevo
      },
      reciboCaja: {
        id: nuevoAbono.id,
        token_publico: nuevoAbono.token_publico,
        reciboNo: reciboCajaNo,
        facturaNo: `FAC-${factura.id}`,
        cliente: factura.cliente,
        documento: factura.documento,
        telefono: factura.telefono,
        monto: montoNum,
        saldoAnterior,
        saldoNuevo,
        metodoPago: nuevoAbono.metodoPago,
        referencia: nuevoAbono.referencia,
        usuarioNombre: nuevoAbono.usuarioNombre,
        fecha: nuevoAbono.fecha,
        empresa
      },
      saldoNuevo,
      esPazYSalvo: saldoNuevo <= 0.01
    });
  } catch (error) {
    await t.rollback();
    console.error('[cartera] POST /:facturaId/abono error:', error);
    res.status(500).json({ error: 'Error al registrar abono: ' + error.message });
  }
});

// 3. RECIBO DE CAJA PÚBLICO DIGITAL PARA WHATSAPP / IMPRESIÓN
router.get('/recibo-caja/:token/public', async (req, res) => {
  try {
    const { token } = req.params;
    const abono = await Abono.findOne({
      where: { token_publico: token }
    });

    if (!abono) {
      return res.status(404).send('<h2 style="font-family:sans-serif;text-align:center;padding:50px;">Recibo de caja no encontrado o código inválido.</h2>');
    }

    const factura = await Factura.findByPk(abono.facturaId, {
      include: [{ model: Almacen, as: 'almacen' }]
    });

    let empresa = await Empresa.findOne();
    empresa = empresa ? empresa.get({ plain: true }) : {
      nombre: 'MULTINYECTORES COLOMBIA',
      nit: '900.123.456-7',
      direccion: 'Carrera 26 # 28-45, Tuluá - Valle del Cauca',
      telefono: '(602) 224-5000',
      correo: 'contacto@multinyectores.com'
    };

    const montoFormateado = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(abono.monto || 0);
    const saldoAnteriorFormateado = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(abono.saldo_anterior || 0);
    const saldoNuevoFormateado = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(abono.saldo_nuevo || 0);
    const fechaFormateada = abono.fecha ? new Date(abono.fecha).toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';

    res.send(`<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Recibo de Caja ${abono.recibo_caja_no} - ${empresa.nombre}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f8fafc; color: #1e293b; margin: 0; padding: 16px; }
    .card { max-width: 650px; margin: 0 auto; background: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); padding: 28px; }
    .header { display: flex; justify-content: space-between; border-bottom: 2px solid #16a34a; padding-bottom: 18px; margin-bottom: 20px; flex-wrap: wrap; gap: 16px; }
    .btn { background: #16a34a; color: #fff; border: none; padding: 10px 18px; border-radius: 6px; font-weight: 600; cursor: pointer; text-decoration: none; display: inline-flex; align-items: center; gap: 6px; font-size: 14px; }
    .badge { background: #dcfce7; color: #15803d; padding: 4px 10px; border-radius: 12px; font-weight: 700; font-size: 12px; display: inline-block; }
    @media print {
      body { background: white; padding: 0; }
      .card { box-shadow: none; padding: 0; max-width: 100%; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="no-print" style="display: flex; justify-content: space-between; margin-bottom: 20px; align-items: center; flex-wrap: wrap; gap: 10px;">
      <span style="color: #64748b; font-size: 14px; font-weight: 500;">Comprobante de Abono Oficial</span>
      <button onclick="window.print()" class="btn">🖨️ Descargar en PDF / Imprimir</button>
    </div>

    <div class="header">
      <div>
        <h1 style="margin: 0 0 6px 0; font-size: 20px; color: #1e3a8a;">${empresa.nombre}</h1>
        <div style="font-size: 13px; color: #475569;">NIT: ${empresa.nit || '900.123.456-7'}</div>
        <div style="font-size: 13px; color: #475569;">${empresa.direccion || 'Tuluá - Valle del Cauca'}</div>
        <div style="font-size: 13px; color: #475569;">Tel: ${empresa.telefono || '(602) 224-5000'}</div>
      </div>
      <div style="text-align: right;">
        <h2 style="margin: 0 0 6px 0; font-size: 18px; color: #16a34a;">RECIBO DE CAJA ${abono.recibo_caja_no}</h2>
        <div style="font-size: 13px; color: #475569;">Fecha: ${fechaFormateada}</div>
        <div style="font-size: 13px; color: #475569;">Factura: <b>FAC-${abono.facturaId}</b></div>
        <div style="margin-top: 6px;"><span class="badge">✓ Abono Registrado en Caja</span></div>
      </div>
    </div>

    <div style="background: #f1f5f9; padding: 14px 18px; border-radius: 8px; margin-bottom: 20px; display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 10px; font-size: 13px;">
      <div><b>Cliente / Deudor:</b> ${abono.clienteNombre}</div>
      <div><b>Doc / NIT:</b> ${abono.documento || 'N/A'}</div>
      <div><b>Teléfono:</b> ${abono.telefono || 'N/A'}</div>
      <div><b>Recibido Por:</b> ${abono.usuarioNombre || 'Caja'}</div>
    </div>

    <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 18px; margin-bottom: 20px; text-align: center;">
      <div style="font-size: 13px; color: #166534; font-weight: 600; margin-bottom: 4px;">MONTO DEL ABONO RECIBIDO</div>
      <div style="font-size: 32px; font-weight: 800; color: #15803d;">${montoFormateado}</div>
      <div style="font-size: 12px; color: #166534; margin-top: 6px;">
        Método: <b>${abono.metodoPago}</b> ${abono.referencia ? `• Ref: <b>${abono.referencia}</b>` : ''}
      </div>
    </div>

    <div style="border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px 18px; margin-bottom: 20px; font-size: 13px;">
      <div style="display: flex; justify-content: space-between; margin-bottom: 8px; color: #64748b;">
        <span>Saldo Anterior de la Factura:</span>
        <b>${saldoAnteriorFormateado}</b>
      </div>
      <div style="display: flex; justify-content: space-between; margin-bottom: 8px; color: #16a34a;">
        <span>Abono Aplicado:</span>
        <b>-${montoFormateado}</b>
      </div>
      <div style="border-top: 1px dashed #cbd5e1; padding-top: 8px; display: flex; justify-content: space-between; font-size: 15px;">
        <span style="font-weight: 700; color: #1e293b;">Nuevo Saldo Pendiente:</span>
        <span style="font-weight: 800; color: ${abono.saldo_nuevo <= 0.01 ? '#15803d' : '#b91c1c'};">
          ${abono.saldo_nuevo <= 0.01 ? 'PAZ Y SALVO ($0)' : saldoNuevoFormateado}
        </span>
      </div>
    </div>

    ${abono.observaciones ? `<div style="font-size: 12px; color: #64748b; margin-bottom: 16px; background: #f8fafc; padding: 10px; border-radius: 6px;"><b>Observaciones:</b> ${abono.observaciones}</div>` : ''}

    <div style="text-align: center; border-top: 1px dashed #cbd5e1; padding-top: 14px; font-size: 12px; color: #64748b;">
      Comprobante oficial expedido por Multinyectores Colombia. Conserve este recibo como constancia de su pago.
    </div>
  </div>
</body>
</html>`);
  } catch (err) {
    console.error('[cartera] GET /recibo-caja/:abonoId/public error:', err);
    res.status(500).send('Error al consultar recibo de caja');
  }
});

module.exports = router;
