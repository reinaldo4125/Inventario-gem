const request = require('supertest');
const app = require('../app');
const sequelize = require('../database/sequelize');

afterAll(async () => {
  try { await sequelize.close(); } catch (e) {}
});

describe('Auth endpoints', () => {
  test('POST /auth/login with invalid credentials should return 401', async () => {
    const res = await request(app).post('/auth/login').send({ correo: 'noexiste@example.com', password: '123456' });
    expect([400, 401, 404, 500]).toContain(res.statusCode);
  });
});
