// Optional CORS whitelist helper (not used directly yet)
module.exports = function isAllowedOrigin(origin) {
  const list = (process.env.CORS_WHITELIST || '').split(',').map(s => s.trim()).filter(Boolean);
  if (!list.length) return true;
  return list.includes(origin);
};
