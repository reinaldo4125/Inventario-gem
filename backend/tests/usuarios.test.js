const request = require('supertest');
const app = require('../app');
const sequelize = require('../database/sequelize');

afterAll(async () => {
  try { await sequelize.close(); } catch (e) {}
});

describe('Usuarios API - auth', () => {
  test('GET /usuarios responde 401 sin token', async () => {
    const res = await request(app).get('/usuarios');
    expect([401, 403]).toContain(res.statusCode);
  });
});
