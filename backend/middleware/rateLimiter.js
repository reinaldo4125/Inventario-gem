const rateLimit = require('express-rate-limit');

module.exports = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000'), // 1 minute
  max: parseInt(process.env.RATE_LIMIT_MAX || '100'), // limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas solicitudes, inténtalo más tarde.' },
  // Use req.ip to avoid issues when X-Forwarded-For is present but trust proxy isn't set
  keyGenerator: (req) => {
    try {
      return req.ip || (req.connection && req.connection.remoteAddress) || req.headers['x-real-ip'] || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    } catch (e) {
      return req.ip || req.socket && req.socket.remoteAddress || 'unknown';
    }
  }
});
