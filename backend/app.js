require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const winston = require('winston');

const app = express();
app.use(helmet());

// CORS whitelist (comma-separated) or allow all if not set
const allowedOrigins = (process.env.CORS_WHITELIST || '').split(',').map(s => s.trim()).filter(Boolean);
if (allowedOrigins.length) {
  app.use(cors({ origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error('Origin not allowed'));
  }}));
} else {
  app.use(cors());
}

// Limit body size to avoid large uploads in JSON
app.use(express.json({ limit: process.env.BODY_LIMIT || '10mb' }));
app.use(express.urlencoded({ extended: true, limit: process.env.BODY_LIMIT || '10mb' }));

// Rate limiter
const rateLimiter = require('./middleware/rateLimiter');
// Configure trust proxy if running behind a proxy (e.g., in production or when explicitly set)
if (process.env.TRUST_PROXY === '1' || process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
} else {
  // if developer explicitly sets TRUST_PROXY=0, don't set it
}
try {
  app.use(rateLimiter);
} catch (err) {
  // Fallback: if rate limiter throws due to unexpected X-Forwarded-For header, log a warning and continue
  console.warn('Rate limiter initialization warning:', err && err.message ? err.message : err);
}

// Logger setup (winston) and HTTP request logging (morgan)
const fs = require('fs');
const path = require('path');
// Asegurar carpeta de logs
const logsDir = path.join(__dirname, 'logs');
try { if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true }); } catch (e) { console.warn('No se pudo crear carpeta de logs:', e && e.message ? e.message : e); }

const loggerTransports = [new winston.transports.Console()];
// Añadir transporte a fichero para facilitar debug en desarrollo
try {
  loggerTransports.push(new winston.transports.File({ filename: path.join(logsDir, 'latest.log'), level: process.env.LOG_LEVEL || 'info', maxsize: 5 * 1024 * 1024 }));
} catch (e) {
  console.warn('No se pudo inicializar transporte de fichero para logs:', e && e.message ? e.message : e);
}

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message }) => `${timestamp} ${level}: ${message}`)
  ),
  transports: loggerTransports
});

app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev', {
  stream: { write: (message) => logger.info(message.trim()) }
}));
const empresaRouter = require('./routes/empresa');
const PORT = process.env.PORT || 4000;
// Servir archivos estáticos de imágenes
app.use('/uploads', express.static('uploads'));
app.use('/empresa', empresaRouter);
const reportesAlertasRouter = require('./routes/reportes_alertas');
const trasladosRouter = require('./routes/traslados');
const kardexRouter = require('./routes/kardex');
const cajaRouter = require('./routes/caja');
const backupRouter = require('./routes/backup');


// Importar rutas de usuarios, productos, ventas, facturas, clientes y dashboard
const usuariosRouter = require('./routes/usuarios');
const productosRouter = require('./routes/productos');
const ventasRouter = require('./routes/ventas');
const facturasRouter = require('./routes/facturas');
const clientesRouter = require('./routes/clientes');
const authRouter = require('./routes/auth');
const almacenesRouter = require('./routes/almacenes');
app.use('/almacenes', almacenesRouter);
const productoCostosRouter = require('./routes/productoCostos');
app.use('/producto-costos', productoCostosRouter);
const dashboardRouter = require('./routes/dashboard');
const reportesRouter = require('./routes/reportes');
const reportesCategoriaRouter = require('./routes/reportes_categoria');

const reportesRankingRouter = require('./routes/reportes_ranking');

// Debug routes (diagnóstico)
try {
  const debugRouter = require('./routes/debug');
  app.use('/debug', debugRouter);
} catch (e) {
  console.warn('Debug router not mounted:', e && e.message ? e.message : e);
}

// Health check endpoint
app.get('/healthz', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

// Content Security Policy (basic)
app.use((req, res, next) => {
  res.setHeader('Content-Security-Policy', "default-src 'self'; img-src 'self' data: http: https:; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline';");
  next();
});



// Usar rutas de usuarios, productos, ventas, facturas, clientes y dashboard
app.use('/usuarios', usuariosRouter);
app.use('/productos', productosRouter);
app.use('/ventas', ventasRouter);
app.use('/facturas', facturasRouter);
app.use('/clientes', clientesRouter);

app.use('/auth', authRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/reportes', reportesRouter);
app.use('/api/reportes-categoria', reportesCategoriaRouter);
app.use('/api/reportes-ranking', reportesRankingRouter);
app.use('/api/reportes-alertas', reportesAlertasRouter);
app.use('/api/producto-costos', productoCostosRouter);
app.use('/api/traslados', trasladosRouter);
app.use('/api/kardex', kardexRouter);
app.use('/api/caja', cajaRouter);
app.use('/api/backup', backupRouter);

// Swagger docs
const swaggerRouter = require('./routes/swagger');
app.use('/api/docs', swaggerRouter);


// Middleware de manejo global de errores
app.use((err, req, res, next) => {
  logger.error(`Error global: ${err.stack || err}`);
  if (res.headersSent) return next(err);
  const response = { error: err.message || 'Error interno del servidor' };
  if (process.env.NODE_ENV === 'development') response.detalles = err.stack;
  res.status(err.status || 500).json(response);
});

// Inicialización asíncrona de base de datos y datos por defecto
const sequelize = require('./database/sequelize');
const { Op } = require('sequelize');
const models = require('./models');
const bcrypt = require('bcryptjs');

let dbInitialized = false;
async function initDb() {
  if (dbInitialized) return;
  dbInitialized = true;
  try {
    await sequelize.authenticate();
    console.log('[AI Studio] Conexión a BD lista (' + sequelize.getDialect() + ').');
  } catch (err) {
    console.warn('[AI Studio] Conexión BD advertencia:', err && err.message ? err.message : err);
  }

  try {
    // Migraciones/columnas adicionales seguras para usuarios
    try { await sequelize.query("ALTER TABLE usuarios ADD COLUMN activo TINYINT(1) DEFAULT 1;"); } catch (e) {}
    try { await sequelize.query("ALTER TABLE usuarios ADD COLUMN telefono VARCHAR(255);"); } catch (e) {}
    try { await sequelize.query("ALTER TABLE usuarios ADD COLUMN documento VARCHAR(255);"); } catch (e) {}
    try { await sequelize.query("ALTER TABLE usuarios ADD COLUMN cargo VARCHAR(255);"); } catch (e) {}
    try { await sequelize.query("ALTER TABLE usuarios ADD COLUMN direccion VARCHAR(255);"); } catch (e) {}
    try { await sequelize.query("ALTER TABLE usuarios ADD COLUMN comision FLOAT DEFAULT 0;"); } catch (e) {}
    try { await sequelize.query("ALTER TABLE usuarios ADD COLUMN notas TEXT;"); } catch (e) {}
    try { await sequelize.query("ALTER TABLE usuarios ADD COLUMN ultimoAcceso DATETIME;"); } catch (e) {}

    // Migraciones/columnas adicionales seguras para clientes
    try { await sequelize.query("ALTER TABLE clientes ADD COLUMN empresa VARCHAR(255);"); } catch (e) {}
    try { await sequelize.query("ALTER TABLE clientes ADD COLUMN departamento VARCHAR(255);"); } catch (e) {}
    try { await sequelize.query("ALTER TABLE clientes ADD COLUMN descuentoEspecial FLOAT DEFAULT 0;"); } catch (e) {}
    try { await sequelize.query("ALTER TABLE clientes ADD COLUMN cupoCredito FLOAT DEFAULT 0;"); } catch (e) {}
    try { await sequelize.query("ALTER TABLE clientes ADD COLUMN activo TINYINT(1) DEFAULT 1;"); } catch (e) {}

    // Migraciones/columnas adicionales seguras para productos
    try { await sequelize.query("ALTER TABLE productos ADD COLUMN costo DECIMAL(10,2) DEFAULT NULL;"); } catch (e) {}
    try { await sequelize.query("ALTER TABLE productos ADD COLUMN ubicacion_bodega VARCHAR(255);"); } catch (e) {}
    try { await sequelize.query("ALTER TABLE productos ADD COLUMN unidad_medida VARCHAR(255) DEFAULT 'Unidad';"); } catch (e) {}
    try { await sequelize.query("ALTER TABLE productos ADD COLUMN proveedor VARCHAR(255);"); } catch (e) {}
    try { await sequelize.query("ALTER TABLE productos ADD COLUMN stock_minimo INT DEFAULT 0;"); } catch (e) {}
    try { await sequelize.query("ALTER TABLE productos ADD COLUMN activo TINYINT(1) DEFAULT 1;"); } catch (e) {}
    try { await sequelize.query("ALTER TABLE productos ADD COLUMN tipo VARCHAR(50) DEFAULT 'producto';"); } catch (e) {}
    try { await sequelize.query("ALTER TABLE productos ADD COLUMN lote VARCHAR(255);"); } catch (e) {}
    try { await sequelize.query("ALTER TABLE productos ADD COLUMN fecha_vencimiento DATE;"); } catch (e) {}

    // Migraciones/columnas adicionales seguras para ventas y facturas
    try { await sequelize.query("ALTER TABLE ventas ADD COLUMN es_cotizacion TINYINT(1) DEFAULT 0;"); } catch (e) {}
    try { await sequelize.query("ALTER TABLE ventas ADD COLUMN metodos_pago TEXT;"); } catch (e) {}
    try { await sequelize.query("ALTER TABLE facturas ADD COLUMN es_cotizacion TINYINT(1) DEFAULT 0;"); } catch (e) {}
    try { await sequelize.query("ALTER TABLE facturas ADD COLUMN metodos_pago TEXT;"); } catch (e) {}

    // Migraciones/columnas adicionales seguras para almacenes
    try { await sequelize.query("ALTER TABLE almacenes ADD COLUMN codigo VARCHAR(50);"); } catch (e) {}
    try { await sequelize.query("ALTER TABLE almacenes ADD COLUMN telefono VARCHAR(50);"); } catch (e) {}
    try { await sequelize.query("ALTER TABLE almacenes ADD COLUMN email VARCHAR(100);"); } catch (e) {}
    try { await sequelize.query("ALTER TABLE almacenes ADD COLUMN responsable VARCHAR(100);"); } catch (e) {}
    try { await sequelize.query("ALTER TABLE almacenes ADD COLUMN direccion VARCHAR(255);"); } catch (e) {}
    try { await sequelize.query("ALTER TABLE almacenes ADD COLUMN ciudad VARCHAR(100);"); } catch (e) {}
    try { await sequelize.query("ALTER TABLE almacenes ADD COLUMN activo TINYINT(1) DEFAULT 1;"); } catch (e) {}

    // Migraciones/columnas adicionales seguras para empresas
    try { await sequelize.query("ALTER TABLE empresas ADD COLUMN actividad_economica VARCHAR(255);"); } catch (e) {}
    try { await sequelize.query("ALTER TABLE empresas ADD COLUMN representante_legal VARCHAR(255);"); } catch (e) {}
    try { await sequelize.query("ALTER TABLE empresas ADD COLUMN ciudad VARCHAR(255);"); } catch (e) {}
    try { await sequelize.query("ALTER TABLE empresas ADD COLUMN telefono_secundario VARCHAR(255);"); } catch (e) {}

    // Asegurar que los servicios tengan stock 0 para no distorsionar métricas de bodegas e inventario físico
    try {
      await sequelize.query(`
        UPDATE producto_almacen 
        SET stock = 0 
        WHERE productoId IN (
          SELECT id FROM productos WHERE tipo = 'servicio' OR LOWER(categoria) LIKE '%servicio%'
        );
      `);
      await sequelize.query(`
        UPDATE productos 
        SET stock = 0 
        WHERE tipo = 'servicio' OR LOWER(categoria) LIKE '%servicio%';
      `);
    } catch (e) {}
    try { await sequelize.query("ALTER TABLE empresas ADD COLUMN sitio_web VARCHAR(255);"); } catch (e) {}
    try { await sequelize.query("ALTER TABLE empresas ADD COLUMN logo_url LONGTEXT;"); } catch (e) {}
    try { await sequelize.query("ALTER TABLE empresas MODIFY COLUMN logo_url LONGTEXT;"); } catch (e) {}
    try { await sequelize.query("ALTER TABLE empresas MODIFY logo_url LONGTEXT;"); } catch (e) {}
    try { await sequelize.query("ALTER TABLE empresas CHANGE logo_url logo_url LONGTEXT;"); } catch (e) {}
    try { await sequelize.query("ALTER TABLE empresas ADD COLUMN moneda VARCHAR(10) DEFAULT '$';"); } catch (e) {}
    try { await sequelize.query("ALTER TABLE empresas ADD COLUMN impuesto_porcentaje FLOAT DEFAULT 0;"); } catch (e) {}
    try { await sequelize.query("ALTER TABLE empresas ADD COLUMN pie_pagina_factura LONGTEXT;"); } catch (e) {}
    try { await sequelize.query("ALTER TABLE empresas MODIFY COLUMN pie_pagina_factura LONGTEXT;"); } catch (e) {}
    try { await sequelize.query("ALTER TABLE empresas MODIFY pie_pagina_factura LONGTEXT;"); } catch (e) {}
    try { await sequelize.query("ALTER TABLE empresas CHANGE pie_pagina_factura pie_pagina_factura LONGTEXT;"); } catch (e) {}
    try { await sequelize.query("ALTER TABLE productos MODIFY COLUMN foto LONGTEXT;"); } catch (e) {}
    try { await sequelize.query("ALTER TABLE productos MODIFY foto LONGTEXT;"); } catch (e) {}
    try { await sequelize.query("ALTER TABLE productos CHANGE foto foto LONGTEXT;"); } catch (e) {}

    await sequelize.sync({ alter: false });
    if (models.ProductoCosto) {
      await models.ProductoCosto.sync();
    }
    console.log('[AI Studio] Esquema de base de datos sincronizado.');

    let almacenPrincipal = await models.Almacen.findByPk(1);
    if (!almacenPrincipal) {
      almacenPrincipal = await models.Almacen.create({ id: 1, nombre: 'Almacén Principal', ubicacion: 'Sede Principal' });
    }

    const empresaCount = await models.Empresa.count();
    if (empresaCount === 0) {
      await models.Empresa.create({
        nombre: 'Multinyectores Colombia',
        nit: '900123456-1',
        telefono: '+57 300 123 4567',
        direccion: 'Calle Principal #12-34',
        correo: 'contacto@multinyectorescolombia.com'
      });
    }

    // Crear o actualizar usuario admin con credenciales: admin / Salome2016.
    const adminHash = await bcrypt.hash('Salome2016.', 10);
    let adminUsers = await models.Usuario.findAll({ 
      where: { 
        [Op.or]: [
          { correo: 'admin@example.com' },
          { nombre: 'admin' },
          { nombre: 'Administrador' },
          { correo: 'admin' },
          { rol: 'admin' }
        ] 
      } 
    });

    if (!adminUsers || adminUsers.length === 0) {
      await models.Usuario.create({
        nombre: 'admin',
        correo: 'admin@example.com',
        rol: 'admin',
        password: adminHash,
        activo: 1,
        almacenId: almacenPrincipal.id
      });
      console.log('[AI Studio] Usuario admin inicial creado: admin (admin@example.com) / Salome2016.');
    } else {
      for (const user of adminUsers) {
        user.password = adminHash;
        user.activo = 1;
        await user.save();
      }
      console.log('[AI Studio] Usuarios admin actualizados con contraseña Salome2016.');
    }

    const productoCount = await models.Producto.count();
    if (productoCount === 0) {
      const prod = await models.Producto.create({
        nombre: 'Inyector Bosch High Performance',
        descripcion: 'Inyector de alta presión para motor diésel/gasolina',
        categoria: 'Inyectores',
        marca: 'Bosch',
        modelo: '0445110001',
        compatibilidad: 'Universal / Renault / Chevrolet',
        codigo_oem: 'BOSCH-0445',
        stock: 25,
        stock_minimo: 5,
        precio: 350000,
        precio_detal: 380000,
        precio_mayor: 320000,
        precio_almacen: 300000,
        costo: 220000,
        activo: true
      });
      await models.ProductoAlmacen.create({
        productoId: prod.id,
        almacenId: almacenPrincipal.id,
        stock: 25,
        stock_minimo: 5
      });
    }

    const clienteCount = await models.Cliente.count();
    if (clienteCount === 0) {
      await models.Cliente.create({
        nombre: 'Cliente General',
        tipo_cliente: 'Detal',
        documento: '222222222',
        tipo_documento: 'CC',
        telefono: '3000000000',
        correo: 'cliente@ejemplo.com',
        direccion: 'Carrera 10 #20-30',
        ciudad: 'Bogotá',
        pais: 'Colombia'
      });
    }
  } catch (err) {
    console.error('[AI Studio] Error inicializando datos base:', err && err.message ? err.message : err);
  }
}
initDb();

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Servidor backend escuchando en http://localhost:${PORT}`);
  });
}

module.exports = app;
