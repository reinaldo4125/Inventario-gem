const rateLimit = require('express-rate-limit');

module.exports = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000'), // 1 minute
  max: parseInt(process.env.RATE_LIMIT_MAX || '2000'), // limit to 2000 requests per minute in dev/production
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // No limitar peticiones estáticas, assets, health checks ni solicitudes internas
    const path = req.path || '';
    return req.method === 'GET' || 
           path.startsWith('/static') || 
           path.startsWith('/IMG') || 
           path.startsWith('/uploads') || 
           path === '/' || 
           path === '/healthz';
  },
  message: { error: 'Demasiadas solicitudes, inténtalo más tarde.' },
  // Use req.ip to avoid issues when X-Forwarded-For is present but trust proxy isn't set
  keyGenerator: (req) => {
    try {
      return req.ip || (req.connection && req.connection.remoteAddress) || req.headers['x-real-ip'] || req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'localhost';
    } catch (e) {
      return 'unknown';
    }
  }
});
