const express = require('express');
const router = express.Router();
const sequelize = require('../database/sequelize');
const { authRole, authToken } = require('./auth');

// List all producto_costos (with optional productoId filter)
router.get('/', authRole(['admin']), async (req, res) => {
  try {
    const { productoId } = req.query;
    let sql = 'SELECT * FROM producto_costos';
    const replacements = {};
    if (productoId) {
      sql += ' WHERE productoId = :productoId';
      replacements.productoId = productoId;
    }
    sql += ' ORDER BY productoId, almacenId, fecha_inicio DESC';
    const rows = await sequelize.query(sql, { replacements, type: sequelize.QueryTypes.SELECT });
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error fetching producto_costos' });
  }
});

// Create
router.post('/', authRole(['admin']), async (req, res) => {
  try {
    const { productoId, almacenId, costo, fecha_inicio, fecha_fin } = req.body;
    if (!productoId || !costo || !fecha_inicio) return res.status(400).json({ error: 'productoId, costo y fecha_inicio son requeridos' });
    const sql = 'INSERT INTO producto_costos (productoId, almacenId, costo, fecha_inicio, fecha_fin) VALUES (:productoId, :almacenId, :costo, :fecha_inicio, :fecha_fin)';
    const [result] = await sequelize.query(sql, { replacements: { productoId, almacenId: almacenId || null, costo, fecha_inicio, fecha_fin: fecha_fin || null } });
    res.json({ id: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error creating producto_costos' });
  }
});

// Update
router.put('/:id', authRole(['admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const { productoId, almacenId, costo, fecha_inicio, fecha_fin } = req.body;
    const sql = 'UPDATE producto_costos SET productoId = :productoId, almacenId = :almacenId, costo = :costo, fecha_inicio = :fecha_inicio, fecha_fin = :fecha_fin WHERE id = :id';
    const [result] = await sequelize.query(sql, { replacements: { productoId, almacenId: almacenId || null, costo, fecha_inicio, fecha_fin: fecha_fin || null, id } });
    res.json({ affectedRows: result.affectedRows || result.affectedRows === 0 ? result.affectedRows : result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error updating producto_costos' });
  }
});

// Delete
router.delete('/:id', authRole(['admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const sql = 'DELETE FROM producto_costos WHERE id = :id';
    const [result] = await sequelize.query(sql, { replacements: { id } });
    res.json({ affectedRows: result.affectedRows || result.affectedRows === 0 ? result.affectedRows : result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error deleting producto_costos' });
  }
});

module.exports = router;
