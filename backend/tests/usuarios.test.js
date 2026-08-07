const request = require('supertest');
const app = require('../app');

describe('Usuarios API - auth', () => {
  test('GET /usuarios responde 401 sin token', async () => {
    const res = await request(app).get('/usuarios');
    expect(res.statusCode).toBe(401);
  });
});
