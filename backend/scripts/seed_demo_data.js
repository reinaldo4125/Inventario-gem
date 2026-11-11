/**
 * Script de datos de prueba para Multinyectores Colombia
 * Crea sedes, usuarios de cada rol, clientes, catálogo de repuestos de inyección diésel y gasolina,
 * servicios de laboratorio, stock por almacén, cajas de turno, ventas, facturas y cartera con abonos.
 * 
 * Ejecución: node backend/scripts/seed_demo_data.js
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const sequelize = require('../database/sequelize');
const {
  Empresa,
  Almacen,
  Usuario,
  Cliente,
  Producto,
  ProductoAlmacen,
  Caja,
  Factura,
  DetalleFactura,
  Venta,
  DetalleVenta,
  Abono,
  Kardex
} = require('../models');

async function seed() {
  console.log('--- INICIANDO CARGA DE DATOS DE PRUEBA ---');
  await sequelize.authenticate();
  console.log('✓ Conectado a la base de datos.');

  // 1. EMPRESA
  console.log('1. Configurando Empresa...');
  let empresa = await Empresa.findOne();
  if (!empresa) {
    empresa = await Empresa.create({
      nombre: 'Multinyectores Colombia SAS',
      nit: '900123456-1',
      telefono: '+57 300 123 4567',
      direccion: 'Calle 13 #45-67, Zona Industrial',
      correo: 'contacto@multinyectorescolombia.com',
      sitio_web: 'https://multinyectorescolombia.com',
      moneda: '$',
      impuesto_porcentaje: 19,
      pie_pagina_factura: 'Garantía legal de 90 días en repuestos originales de inyección diésel y gasolina. Laboratorio certificado Bosch y Denso.'
    });
  } else {
    empresa.nombre = 'Multinyectores Colombia SAS';
    empresa.nit = '900123456-1';
    empresa.telefono = '+57 300 123 4567';
    empresa.direccion = 'Calle 13 #45-67, Zona Industrial';
    empresa.correo = 'contacto@multinyectorescolombia.com';
    empresa.sitio_web = 'https://multinyectorescolombia.com';
    empresa.moneda = '$';
    empresa.impuesto_porcentaje = 19;
    empresa.pie_pagina_factura = 'Garantía legal de 90 días en repuestos originales de inyección diésel y gasolina. Laboratorio certificado Bosch y Denso.';
    await empresa.save();
  }
  console.log('✓ Empresa configurada.');

  // 2. ALMACENES / SEDES
  console.log('2. Creando Sedes / Almacenes...');
  const sedesData = [
    { id: 1, nombre: 'Sede Principal - Taller & Bodega Central', ubicacion: 'Calle 13 #45-67, Bogotá', telefono: '6013456789', ciudad: 'Bogotá', activo: 1 },
    { id: 2, nombre: 'Sede Norte - Punto de Venta', ubicacion: 'Autopista Norte #128-40, Bogotá', telefono: '6017654321', ciudad: 'Bogotá', activo: 1 },
    { id: 3, nombre: 'Sede Sur - Laboratorio Diésel', ubicacion: 'Av. Primero de Mayo #68-20, Bogotá', telefono: '6019876543', ciudad: 'Bogotá', activo: 1 }
  ];

  for (const s of sedesData) {
    const existing = await Almacen.findByPk(s.id);
    if (!existing) {
      await Almacen.create(s);
    } else {
      await existing.update(s);
    }
  }
  console.log('✓ 3 Almacenes/Sedes listos.');

  // 3. USUARIOS Y PERFILES
  console.log('3. Creando Usuarios con diferentes roles...');
  const commonHash = await bcrypt.hash('admin123', 10);
  const usuariosData = [
    {
      correo: 'admin@admin.com',
      nombre: 'Administrador General',
      rol: 'admin',
      password: commonHash,
      almacenId: 1,
      cargo: 'Director de Operaciones',
      telefono: '3001234567',
      activo: 1
    },
    {
      correo: 'carlos.pos@multinyectores.com',
      nombre: 'Carlos Ramírez',
      rol: 'admin_pos',
      password: commonHash,
      almacenId: 2,
      cargo: 'Administrador Sede Norte',
      telefono: '3112223344',
      activo: 1
    },
    {
      correo: 'laura.ventas@multinyectores.com',
      nombre: 'Laura Gómez',
      rol: 'vendedor',
      password: commonHash,
      almacenId: 1,
      cargo: 'Asesora Comercial',
      telefono: '3155556677',
      activo: 1
    },
    {
      correo: 'pedro.stock@multinyectores.com',
      nombre: 'Pedro Morales',
      rol: 'almacen',
      password: commonHash,
      almacenId: 1,
      cargo: 'Encargado de Inventario',
      telefono: '3188889900',
      activo: 1
    }
  ];

  for (const u of usuariosData) {
    const existing = await Usuario.findOne({ where: { correo: u.correo } });
    if (!existing) {
      await Usuario.create(u);
    } else {
      await existing.update(u);
    }
  }
  console.log('✓ Usuarios creados (Contraseña para todos: admin123).');

  // 4. CLIENTES
  console.log('4. Creando Clientes...');
  const clientesData = [
    {
      nombre: 'CONSUMIDOR FINAL',
      documento: '222222222222',
      tipo_documento: 'CC',
      telefono: '3000000000',
      correo: 'cliente@multinyectores.com',
      direccion: 'Venta de Mostrador',
      ciudad: 'Bogotá',
      activo: 1
    },
    {
      nombre: 'AutoRepuestos Los Andes SAS',
      documento: '901234567-8',
      tipo_documento: 'NIT',
      telefono: '3104567890',
      correo: 'compras@losandesdiesel.com',
      direccion: 'Carrera 27 #18-45, Paloquemao',
      ciudad: 'Bogotá',
      activo: 1
    },
    {
      nombre: 'Taller Mecánico Diesel Tech',
      documento: '900876543-2',
      tipo_documento: 'NIT',
      telefono: '3157891234',
      correo: 'gerencia@dieseltech.co',
      direccion: 'Calle 68 #54-12, Barrio San Fernando',
      ciudad: 'Bogotá',
      activo: 1
    },
    {
      nombre: 'Transportes Especiales Cundinamarca',
      documento: '860555444-1',
      tipo_documento: 'NIT',
      telefono: '3206549870',
      correo: 'mantenimiento@flotacundinamarca.com',
      direccion: 'Terminal Satélite del Sur, Módulo 4',
      ciudad: 'Bogotá',
      activo: 1
    },
    {
      nombre: 'Camilo Rodríguez Vargas',
      documento: '1018456789',
      tipo_documento: 'CC',
      telefono: '3123456789',
      correo: 'camilo.rodriguez@gmail.com',
      direccion: 'Calle 140 #15-30, Cedritos',
      ciudad: 'Bogotá',
      activo: 1
    },
    {
      nombre: 'Inyección Electrónica San Jorge',
      documento: '900333222-5',
      tipo_documento: 'NIT',
      telefono: '3119876543',
      correo: 'taller@sanjorgeauto.com',
      direccion: 'Av. Caracas #33-20 Sur',
      ciudad: 'Bogotá',
      activo: 1
    }
  ];

  const clientesCreados = [];
  for (const c of clientesData) {
    let cl = await Cliente.findOne({ where: { documento: c.documento } });
    if (!cl) {
      cl = await Cliente.create(c);
    } else {
      await cl.update(c);
    }
    clientesCreados.push(cl);
  }
  console.log(`✓ ${clientesCreados.length} Clientes listos.`);

  // 5. PRODUCTOS Y SERVICIOS
  console.log('5. Creando Catálogo de Productos y Servicios...');
  const productosData = [
    {
      nombre: 'Inyector Bosch Common Rail 0445110001',
      descripcion: 'Inyector electrónico de alta presión para motor diésel Common Rail',
      categoria: 'Inyectores Diésel',
      marca: 'Bosch',
      modelo: 'CRIN2-16',
      compatibilidad: 'Toyota Hilux 2.5/3.0 D4D, Fortuner 1KD/2KD',
      codigo_oem: '23670-0L050',
      stock: 24,
      stock_minimo: 5,
      precio: 420000,
      precio_detal: 420000,
      precio_mayor: 380000,
      precio_almacen: 350000,
      costo: 280000,
      ubicacion_bodega: 'Estante A-01 / Nivel 2',
      unidad_medida: 'Unidad',
      proveedor: 'Bosch Colombia Repuestos',
      tipo: 'producto',
      activo: true
    },
    {
      nombre: 'Inyector Delphi Euro 5 28231014',
      descripcion: 'Inyector diésel para sistemas Common Rail Euro 5 de última generación',
      categoria: 'Inyectores Diésel',
      marca: 'Delphi',
      modelo: 'EMBR00002D',
      compatibilidad: 'Ford Ranger 2.2 / 3.2 TDCi, Mazda BT-50 Pro',
      codigo_oem: 'BK2Q-9K546-AG',
      stock: 18,
      stock_minimo: 4,
      precio: 480000,
      precio_detal: 480000,
      precio_mayor: 440000,
      precio_almacen: 410000,
      costo: 320000,
      ubicacion_bodega: 'Estante A-02 / Nivel 1',
      unidad_medida: 'Unidad',
      proveedor: 'Delphi Technologies',
      tipo: 'producto',
      activo: true
    },
    {
      nombre: 'Inyector Denso Common Rail 095000-5471',
      descripcion: 'Inyector electrohidráulico Denso original para motores diésel de carga pesada',
      categoria: 'Inyectores Diésel',
      marca: 'Denso',
      modelo: 'G2 Series',
      compatibilidad: 'Isuzu D-Max 3.0 4JJ1, Chevrolet D-Max CRDi',
      codigo_oem: '8-97329703-2',
      stock: 15,
      stock_minimo: 3,
      precio: 520000,
      precio_detal: 520000,
      precio_mayor: 470000,
      precio_almacen: 440000,
      costo: 350000,
      ubicacion_bodega: 'Estante A-03 / Nivel 3',
      unidad_medida: 'Unidad',
      proveedor: 'Denso Aftermarket Colombia',
      tipo: 'producto',
      activo: true
    },
    {
      nombre: 'Tobera Bosch DLLA150P1011',
      descripcion: 'Punta tobera para inyector Common Rail Bosch de alta atomización',
      categoria: 'Toberas',
      marca: 'Bosch',
      modelo: 'DLLA 150 P 1011',
      compatibilidad: 'Toyota Hilux 1KD-FTV / 2KD-FTV',
      codigo_oem: '0433171654',
      stock: 45,
      stock_minimo: 10,
      precio: 140000,
      precio_detal: 140000,
      precio_mayor: 120000,
      precio_almacen: 105000,
      costo: 75000,
      ubicacion_bodega: 'Cajón B-05 / Gaveta 1',
      unidad_medida: 'Unidad',
      proveedor: 'Bosch Colombia Repuestos',
      tipo: 'producto',
      activo: true
    },
    {
      nombre: 'Válvula de Control Bosch F00VC01359',
      descripcion: 'Válvula de retorno y control de presión para inyectores Common Rail',
      categoria: 'Válvulas',
      marca: 'Bosch',
      modelo: 'F00VC01359',
      compatibilidad: 'Inyectores Serie 0445110',
      codigo_oem: 'F00VC01359',
      stock: 30,
      stock_minimo: 8,
      precio: 165000,
      precio_detal: 165000,
      precio_mayor: 145000,
      precio_almacen: 130000,
      costo: 90000,
      ubicacion_bodega: 'Cajón B-08 / Gaveta 2',
      unidad_medida: 'Unidad',
      proveedor: 'Bosch Colombia Repuestos',
      tipo: 'producto',
      activo: true
    },
    {
      nombre: 'Válvula SCV Denso Bomba HP3 (294200-0360)',
      descripcion: 'Válvula solenoide de control de succión de combustible SCV',
      categoria: 'Válvulas',
      marca: 'Denso',
      modelo: 'Short SCV Valve',
      compatibilidad: 'Toyota Hilux / D-Max / Mitsubishi L200',
      codigo_oem: '294200-0360',
      stock: 12,
      stock_minimo: 3,
      precio: 280000,
      precio_detal: 280000,
      precio_mayor: 250000,
      precio_almacen: 230000,
      costo: 160000,
      ubicacion_bodega: 'Estante C-01 / Nivel 1',
      unidad_medida: 'Unidad',
      proveedor: 'Denso Aftermarket Colombia',
      tipo: 'producto',
      activo: true
    },
    {
      nombre: 'Sensor Presión Riel Bosch 0281002937',
      descripcion: 'Sensor de alta presión montado en la flauta de inyección diésel',
      categoria: 'Sensores',
      marca: 'Bosch',
      modelo: 'RDS4.2',
      compatibilidad: 'Motores diésel 1.6 - 2.8 HDI / TDI / CRDi',
      codigo_oem: '0281002937',
      stock: 16,
      stock_minimo: 4,
      precio: 210000,
      precio_detal: 210000,
      precio_mayor: 185000,
      precio_almacen: 170000,
      costo: 115000,
      ubicacion_bodega: 'Estante C-04 / Nivel 2',
      unidad_medida: 'Unidad',
      proveedor: 'Sensores y Flotas SAS',
      tipo: 'producto',
      activo: true
    },
    {
      nombre: 'Inyector Gasolina GDI 03C906036M',
      descripcion: 'Inyector de inyección directa de gasolina de alta presión',
      categoria: 'Inyectores Gasolina',
      marca: 'Continental / VDO',
      modelo: 'GDI High Pressure',
      compatibilidad: 'Volkswagen Golf, Jetta, Audi A3 1.4 TSI',
      codigo_oem: '03C906036M',
      stock: 20,
      stock_minimo: 6,
      precio: 290000,
      precio_detal: 290000,
      precio_mayor: 260000,
      precio_almacen: 240000,
      costo: 175000,
      ubicacion_bodega: 'Estante D-02 / Nivel 2',
      unidad_medida: 'Unidad',
      proveedor: 'EuroPartes Colombia',
      tipo: 'producto',
      activo: true
    },
    {
      nombre: 'Kit Microfiltros y Sellos Viton (Pack x 50)',
      descripcion: 'Kit completo de canastillas microfiltro y sellos de viton resistentes al etanol',
      categoria: 'Accesorios y Kits',
      marca: 'Universal Parts',
      modelo: 'MF-VITON-50',
      compatibilidad: 'Inyectores gasolina multipunto estándar Bosch / Denso',
      codigo_oem: 'K-MF-01',
      stock: 60,
      stock_minimo: 15,
      precio: 85000,
      precio_detal: 85000,
      precio_mayor: 70000,
      precio_almacen: 60000,
      costo: 35000,
      ubicacion_bodega: 'Gaveta E-01 / Vitrina',
      unidad_medida: 'Paquete',
      proveedor: 'Kits y Empaques Automotrices',
      tipo: 'producto',
      activo: true
    },
    {
      nombre: 'Arandelas de Fuego Cobre 1.5mm (Pack x 100)',
      descripcion: 'Arandelas de asiento de cobre termotratadas para inyectores diésel',
      categoria: 'Accesorios y Kits',
      marca: 'Diesel Seal',
      modelo: 'CU-150-100',
      compatibilidad: 'Diésel Universal 15x7.5x1.5mm',
      codigo_oem: 'AR-CU-150',
      stock: 80,
      stock_minimo: 20,
      precio: 65000,
      precio_detal: 65000,
      precio_mayor: 50000,
      precio_almacen: 42000,
      costo: 22000,
      ubicacion_bodega: 'Gaveta E-02 / Vitrina',
      unidad_medida: 'Paquete',
      proveedor: 'Kits y Empaques Automotrices',
      tipo: 'producto',
      activo: true
    },
    {
      nombre: 'Limpiador Diésel Purge Liqui Moly 500ml',
      descripcion: 'Limpia inyectores y cámara de combustión diésel de acción directa',
      categoria: 'Químicos y Aditivos',
      marca: 'Liqui Moly',
      modelo: 'Diesel Purge 2509',
      compatibilidad: 'Todos los motores diésel con y sin DPF',
      codigo_oem: 'LM-2509',
      stock: 35,
      stock_minimo: 8,
      precio: 55000,
      precio_detal: 55000,
      precio_mayor: 45000,
      precio_almacen: 38000,
      costo: 28000,
      ubicacion_bodega: 'Estante F-01 / Nivel 1',
      unidad_medida: 'Frasco',
      proveedor: 'Importadora Liqui Moly',
      tipo: 'producto',
      activo: true
    },
    // SERVICIOS (stock = 0 siempre)
    {
      nombre: 'Servicio: Diagnóstico y Calibración en Banco de Pruebas Diésel',
      descripcion: 'Prueba computarizada en banco de inyección: entrega de combustible, preinyección, fuga y retorno',
      categoria: 'Servicios de Laboratorio',
      marca: 'Laboratorio Multinyectores',
      modelo: 'Banco EPS-205',
      compatibilidad: 'Inyectores Common Rail Bosch, Denso, Delphi, Continental',
      codigo_oem: 'SRV-DIAG-01',
      stock: 0,
      stock_minimo: 0,
      precio: 90000,
      precio_detal: 90000,
      precio_mayor: 75000,
      precio_almacen: 65000,
      costo: 25000,
      ubicacion_bodega: 'Área de Laboratorio',
      unidad_medida: 'Servicio',
      proveedor: 'Multinyectores Técnico',
      tipo: 'servicio',
      activo: true
    },
    {
      nombre: 'Servicio: Limpieza por Ultrasonido y Cambio de Microfiltros',
      descripcion: 'Lavado por cavitación ultrasónica con líquido dieléctrico y reemplazo de microfiltros y o-rings',
      categoria: 'Servicios de Taller',
      marca: 'Laboratorio Multinyectores',
      modelo: 'Ultrasonic Pro 6L',
      compatibilidad: 'Inyectores Gasolina Multipunto y GDI (Juego x 4)',
      codigo_oem: 'SRV-ULTRA-04',
      stock: 0,
      stock_minimo: 0,
      precio: 120000,
      precio_detal: 120000,
      precio_mayor: 100000,
      precio_almacen: 85000,
      costo: 30000,
      ubicacion_bodega: 'Área de Taller Gasolina',
      unidad_medida: 'Servicio',
      proveedor: 'Multinyectores Técnico',
      tipo: 'servicio',
      activo: true
    },
    {
      nombre: 'Servicio: Montaje y Desmontaje de Inyectores en Vehículo',
      descripcion: 'Mano de obra especializada para extracción y reinstalación con torquímetro y arandelas nuevas',
      categoria: 'Servicios de Taller',
      marca: 'Taller Multinyectores',
      modelo: 'Mano de Obra Taller',
      compatibilidad: 'Camionetas y utilitarios diésel (4 cilindros)',
      codigo_oem: 'SRV-MNT-01',
      stock: 0,
      stock_minimo: 0,
      precio: 180000,
      precio_detal: 180000,
      precio_mayor: 150000,
      precio_almacen: 140000,
      costo: 50000,
      ubicacion_bodega: 'Fosa / Bahía 1',
      unidad_medida: 'Servicio',
      proveedor: 'Multinyectores Técnico',
      tipo: 'servicio',
      activo: true
    }
  ];

  const productosCreados = [];
  for (const p of productosData) {
    let prod = await Producto.findOne({ where: { nombre: p.nombre } });
    if (!prod) {
      prod = await Producto.create(p);
    } else {
      await prod.update(p);
    }
    productosCreados.push(prod);

    // Si es producto físico, distribuir stock entre los 3 almacenes
    if (prod.tipo !== 'servicio') {
      const stockTotal = prod.stock;
      const s1 = Math.floor(stockTotal * 0.5); // Sede Principal 50%
      const s2 = Math.floor(stockTotal * 0.3); // Sede Norte 30%
      const s3 = stockTotal - s1 - s2;         // Sede Sur 20%

      const stocksPorSede = [
        { almacenId: 1, stock: s1 },
        { almacenId: 2, stock: s2 },
        { almacenId: 3, stock: s3 }
      ];

      for (const st of stocksPorSede) {
        let pa = await ProductoAlmacen.findOne({ where: { productoId: prod.id, almacenId: st.almacenId } });
        if (!pa) {
          await ProductoAlmacen.create({ productoId: prod.id, almacenId: st.almacenId, stock: st.stock });
        } else {
          await pa.update({ stock: st.stock });
        }
      }
    }
  }
  console.log(`✓ ${productosCreados.length} Productos y Servicios creados y distribuidos por sedes.`);

  // 6. CAJAS / TURNOS
  console.log('6. Creando Cajas y Turnos...');
  // Sede Principal: Caja Abierta hoy con $300.000
  let cajaSede1 = await Caja.findOne({ where: { almacenId: 1, estado: 'Abierta' } });
  if (!cajaSede1) {
    cajaSede1 = await Caja.create({
      almacenId: 1,
      usuarioNombre: 'Laura Gómez',
      monto_apertura: 300000,
      fecha_apertura: new Date(),
      estado: 'Abierta',
      observaciones: 'Turno de mañana Sede Principal'
    });
  }

  // Sede Norte: Caja Abierta hoy con $200.000
  let cajaSede2 = await Caja.findOne({ where: { almacenId: 2, estado: 'Abierta' } });
  if (!cajaSede2) {
    cajaSede2 = await Caja.create({
      almacenId: 2,
      usuarioNombre: 'Carlos Ramírez',
      monto_apertura: 200000,
      fecha_apertura: new Date(),
      estado: 'Abierta',
      observaciones: 'Turno Sede Norte'
    });
  }

  // Turno cerrado anterior para historial
  const fechaAyer = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const fechaAyerCierre = new Date(Date.now() - 16 * 60 * 60 * 1000);
  const cajaCerradaExistente = await Caja.findOne({ where: { almacenId: 1, estado: 'Cerrada' } });
  if (!cajaCerradaExistente) {
    await Caja.create({
      almacenId: 1,
      usuarioNombre: 'Laura Gómez',
      monto_apertura: 250000,
      monto_cierre: 1850000,
      monto_esperado: 1850000,
      diferencia: 0,
      fecha_apertura: fechaAyer,
      fecha_cierre: fechaAyerCierre,
      estado: 'Cerrada',
      observaciones: 'Cierre de turno jornada anterior sin novedades, arqueo perfecto.',
      resumen_metodos: JSON.stringify({
        apertura: 250000,
        efectivo: 1600000,
        transferencia: 840000,
        tarjeta: 420000,
        totalRecaudado: 2860000
      })
    });
  }
  console.log('✓ Cajas configuradas (2 turnos abiertos para ventas y 1 cerrado para historial).');

  // 7. VENTAS Y FACTURAS
  console.log('7. Creando Ventas, Facturas y Cartera...');

  const prodBosch = productosCreados.find(p => p.nombre.includes('Bosch Common Rail'));
  const prodDelphi = productosCreados.find(p => p.nombre.includes('Delphi'));
  const prodDenso = productosCreados.find(p => p.nombre.includes('Denso'));
  const prodTobera = productosCreados.find(p => p.nombre.includes('Tobera'));
  const prodServicioDiag = productosCreados.find(p => p.nombre.includes('Diagnóstico'));
  const prodServicioUltra = productosCreados.find(p => p.nombre.includes('Ultrasonido'));

  const cliConsumidor = clientesCreados.find(c => c.documento === '222222222222');
  const cliLosAndes = clientesCreados.find(c => c.nombre.includes('Los Andes'));
  const cliDieselTech = clientesCreados.find(c => c.nombre.includes('Diesel Tech'));
  const cliCamilo = clientesCreados.find(c => c.nombre.includes('Camilo'));
  const cliSanJorge = clientesCreados.find(c => c.nombre.includes('San Jorge'));

  // Venta 1: Venta de Mostrador Pagada en Efectivo
  const v1 = await Venta.create({
    almacenId: 1,
    fecha: new Date(),
    total: 510000,
    clienteId: cliConsumidor.id,
    descuento: 0,
    metodoPago: 'Efectivo',
    notas: 'Venta rápida de mostrador en efectivo',
    vendedor: 'Laura Gómez',
    estado: 'Pagada',
    direccion: cliConsumidor.direccion,
    telefono: cliConsumidor.telefono
  });

  await DetalleVenta.create({
    ventaId: v1.id,
    productoId: prodBosch.id,
    cantidad: 1,
    precio_unitario: 420000
  });
  await DetalleVenta.create({
    ventaId: v1.id,
    productoId: prodServicioDiag.id,
    cantidad: 1,
    precio_unitario: 90000
  });

  // Factura 1 asociada a Venta 1 (Comprobante Pagado)
  const f1 = await Factura.create({
    cliente: cliConsumidor.nombre,
    documento: cliConsumidor.documento,
    tipo_documento: cliConsumidor.tipo_documento,
    direccion: cliConsumidor.direccion,
    telefono: cliConsumidor.telefono,
    correo: cliConsumidor.correo,
    notas: '[PAGO CERTIFICADO] Validado por Laura Gómez. Método: Efectivo',
    total: 510000,
    almacenId: 1,
    fecha: new Date(),
    estado: 'Pagada'
  });
  v1.facturaId = f1.id;
  await v1.save();

  await DetalleFactura.create({
    facturaId: f1.id,
    productoId: prodBosch.id,
    cantidad: 1,
    precio_unitario: 420000
  });
  await DetalleFactura.create({
    facturaId: f1.id,
    productoId: prodServicioDiag.id,
    cantidad: 1,
    precio_unitario: 90000
  });

  // Venta 2: Venta a Taller Diésel Tech Pagada por Transferencia Bancaria
  const v2 = await Venta.create({
    almacenId: 1,
    fecha: new Date(Date.now() - 3 * 3600 * 1000),
    total: 1040000,
    clienteId: cliDieselTech.id,
    descuento: 0,
    metodoPago: 'Transferencia Bancaria',
    notas: 'Pago confirmado por Bancolombia Ref #987213',
    vendedor: 'Laura Gómez',
    estado: 'Pagada',
    direccion: cliDieselTech.direccion,
    telefono: cliDieselTech.telefono
  });

  await DetalleVenta.create({
    ventaId: v2.id,
    productoId: prodDenso.id,
    cantidad: 2,
    precio_unitario: 520000
  });

  const f2 = await Factura.create({
    cliente: cliDieselTech.nombre,
    documento: cliDieselTech.documento,
    tipo_documento: cliDieselTech.tipo_documento,
    direccion: cliDieselTech.direccion,
    telefono: cliDieselTech.telefono,
    correo: cliDieselTech.correo,
    notas: '[PAGO CERTIFICADO] Transferencia Bancolombia Ref #987213',
    total: 1040000,
    almacenId: 1,
    fecha: new Date(Date.now() - 3 * 3600 * 1000),
    estado: 'Pagada'
  });
  v2.facturaId = f2.id;
  await v2.save();

  await DetalleFactura.create({
    facturaId: f2.id,
    productoId: prodDenso.id,
    cantidad: 2,
    precio_unitario: 520000
  });

  // Venta 3: Venta a Crédito en Cartera (AutoRepuestos Los Andes SAS)
  // Total: $1.440.000 (3 inyectores Delphi). Abono realizado: $500.000. Saldo restante: $940.000
  const v3 = await Venta.create({
    almacenId: 2,
    fecha: new Date(Date.now() - 2 * 24 * 3600 * 1000),
    total: 1440000,
    clienteId: cliLosAndes.id,
    descuento: 0,
    metodoPago: 'Crédito',
    notas: 'Crédito a 30 días autorizado por gerencia. Abono inicial de $500.000 recibido.',
    vendedor: 'Carlos Ramírez',
    estado: 'Pagada', // En ventas se marca pagada/procesada
    direccion: cliLosAndes.direccion,
    telefono: cliLosAndes.telefono
  });

  await DetalleVenta.create({
    ventaId: v3.id,
    productoId: prodDelphi.id,
    cantidad: 3,
    precio_unitario: 480000
  });

  // Factura 3: En Cartera
  const f3 = await Factura.create({
    cliente: cliLosAndes.nombre,
    documento: cliLosAndes.documento,
    tipo_documento: cliLosAndes.tipo_documento,
    direccion: cliLosAndes.direccion,
    telefono: cliLosAndes.telefono,
    correo: cliLosAndes.correo,
    notas: '[EN CARTERA] Venta a crédito autorizada a 30 días. Saldo pendiente en cartera.',
    total: 1440000,
    almacenId: 2,
    fecha: new Date(Date.now() - 2 * 24 * 3600 * 1000),
    estado: 'Pendiente' // En Cartera / Pendiente de saldo
  });
  v3.facturaId = f3.id;
  await v3.save();

  await DetalleFactura.create({
    facturaId: f3.id,
    productoId: prodDelphi.id,
    cantidad: 3,
    precio_unitario: 480000
  });

  // Registro del abono en Cartera para Factura 3
  await Abono.create({
    facturaId: f3.id,
    ventaId: v3.id,
    clienteId: cliLosAndes.id,
    clienteNombre: cliLosAndes.nombre,
    documento: cliLosAndes.documento,
    telefono: cliLosAndes.telefono,
    monto: 500000,
    saldo_anterior: 1440000,
    saldo_nuevo: 940000,
    metodoPago: 'Transferencia',
    referencia: 'PSE-Bancolombia-88231',
    recibo_caja_no: 'RC-001',
    observaciones: 'Abono inicial 35% por compra de lote inyectores',
    usuarioNombre: 'Carlos Ramírez',
    fecha: new Date(Date.now() - 2 * 24 * 3600 * 1000 + 3600 * 1000)
  });

  // Venta 4: Venta a Camilo Rodríguez (Servicio Ultrasonido + Toberas) pagada con Tarjeta
  const v4 = await Venta.create({
    almacenId: 1,
    fecha: new Date(Date.now() - 5 * 3600 * 1000),
    total: 400000,
    clienteId: cliCamilo.id,
    descuento: 0,
    metodoPago: 'Tarjeta Débito',
    notas: 'Mantenimiento inyectores gasolina y 2 toberas',
    vendedor: 'Laura Gómez',
    estado: 'Pagada',
    direccion: cliCamilo.direccion,
    telefono: cliCamilo.telefono
  });

  await DetalleVenta.create({
    ventaId: v4.id,
    productoId: prodTobera.id,
    cantidad: 2,
    precio_unitario: 140000
  });
  await DetalleVenta.create({
    ventaId: v4.id,
    productoId: prodServicioUltra.id,
    cantidad: 1,
    precio_unitario: 120000
  });

  const f4 = await Factura.create({
    cliente: cliCamilo.nombre,
    documento: cliCamilo.documento,
    tipo_documento: cliCamilo.tipo_documento,
    direccion: cliCamilo.direccion,
    telefono: cliCamilo.telefono,
    correo: cliCamilo.correo,
    notas: '[PAGO CERTIFICADO] Tarjeta Débito Redeban Lote 045',
    total: 400000,
    almacenId: 1,
    fecha: new Date(Date.now() - 5 * 3600 * 1000),
    estado: 'Pagada'
  });
  v4.facturaId = f4.id;
  await v4.save();

  await DetalleFactura.create({
    facturaId: f4.id,
    productoId: prodTobera.id,
    cantidad: 2,
    precio_unitario: 140000
  });
  await DetalleFactura.create({
    facturaId: f4.id,
    productoId: prodServicioUltra.id,
    cantidad: 1,
    precio_unitario: 120000
  });

  // 8. KARDEX INICIAL
  console.log('8. Registrando movimientos de inventario en Kardex...');
  for (const prod of productosCreados) {
    if (prod.tipo !== 'servicio') {
      await Kardex.create({
        productoId: prod.id,
        almacenId: 1,
        tipo: 'Entrada',
        origen_destino: 'Inventario Inicial / Compra Lote',
        cantidad: prod.stock,
        stock_anterior: 0,
        stock_nuevo: prod.stock,
        referencia_id: null,
        usuario: 'Administrador General',
        fecha: new Date(Date.now() - 7 * 24 * 3600 * 1000)
      });
    }
  }
  console.log('✓ Kardex inicial registrado.');

  console.log('\n=====================================================');
  console.log('  ¡DATOS DE PRUEBA CARGADOS CON ÉXITO TOTAL!        ');
  console.log('=====================================================');
}

seed()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error cargando seed:', err);
    process.exit(1);
  });
