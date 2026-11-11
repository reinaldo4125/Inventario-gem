require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

// AI Studio dev server runs on port 3000 (nginx listens on 8080 inside container)
const PORT = 3000;
process.env.PORT = '3000';
process.env.TRUST_PROXY = '1';

// Ensure uploads folder exists
const uploadsDir = path.join(__dirname, 'backend', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  try {
    fs.mkdirSync(uploadsDir, { recursive: true });
  } catch (e) {
    console.warn('Could not create uploads directory:', e);
  }
}

// Frontend build path
const frontendBuildPath = path.join(__dirname, 'frontend', 'build');

// Ensure frontend build directory exists and has index.html
if (!fs.existsSync(path.join(frontendBuildPath, 'index.html'))) {
  console.log('[AI Studio] Compilando interfaz de usuario (build de producción)...');
  try {
    const hasScripts = fs.existsSync(path.join(__dirname, 'frontend', 'node_modules', 'react-scripts'));
    const buildCmd = hasScripts 
      ? 'npm --prefix frontend run build' 
      : 'npm --prefix frontend install --legacy-peer-deps && npm --prefix frontend run build';
    execSync(buildCmd, { stdio: 'inherit' });
  } catch (err) {
    console.error('[AI Studio] Error compilando frontend:', err);
  }
}

// Load Express backend app
const app = require('./backend/app');

// Serve static image directories
const imgDir = path.join(__dirname, 'IMG');
if (fs.existsSync(imgDir)) {
  app.use('/IMG', express.static(imgDir));
}

// Serve frontend static build files
app.use(express.static(frontendBuildPath));

// Fallback to index.html for SPA client-side routes
app.use((req, res, next) => {
  if (
    req.path.startsWith('/api') ||
    req.path.startsWith('/auth') ||
    req.path.startsWith('/usuarios') ||
    req.path.startsWith('/productos') ||
    req.path.startsWith('/ventas') ||
    req.path.startsWith('/facturas') ||
    req.path.startsWith('/cartera') ||
    req.path.startsWith('/clientes') ||
    req.path.startsWith('/almacenes') ||
    req.path.startsWith('/caja') ||
    req.path.startsWith('/reportes') ||
    req.path.startsWith('/kardex') ||
    req.path.startsWith('/traslados') ||
    req.path.startsWith('/dashboard') ||
    req.path.startsWith('/empresa') ||
    req.path.startsWith('/producto-costos') ||
    req.path.startsWith('/uploads') ||
    req.path.startsWith('/IMG') ||
    req.path.startsWith('/healthz')
  ) {
    return next();
  }

  // Never return HTML fallback for static assets (js, css, images, map files)
  if (req.path.startsWith('/static/') || /\.(js|css|json|ico|png|jpg|jpeg|svg|map)$/.test(req.path)) {
    return res.status(404).send('Asset not found');
  }

  const indexPath = path.join(frontendBuildPath, 'index.html');
  if (fs.existsSync(indexPath)) {
    return res.sendFile(indexPath);
  }

  res.status(200).send(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Inventario Multinyectores</title>
        <meta http-equiv="refresh" content="5">
        <style>
          body { font-family: sans-serif; text-align: center; padding: 50px; background: #f4f6f9; color: #333; }
          .card { background: white; padding: 30px; border-radius: 8px; max-width: 450px; margin: 0 auto; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
          .spinner { border: 4px solid #f3f3f3; border-top: 4px solid #0056b3; border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite; margin: 20px auto; }
          @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        </style>
      </head>
      <body>
        <div class="card">
          <h2>Iniciando Aplicación...</h2>
          <div class="spinner"></div>
          <p>Compilando la interfaz del sistema de inventarios. La página se recargará automáticamente.</p>
        </div>
      </body>
    </html>
  `);
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[AI Studio] Servidor unificado escuchando en http://0.0.0.0:${PORT}`);
});
