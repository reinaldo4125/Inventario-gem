"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add column if not exists (some dialects don't support IF NOT EXISTS, so use try/catch)
    try {
      await queryInterface.addColumn('usuarios', 'refresh_token', {
        type: Sequelize.STRING(255),
        allowNull: true,
      });
      console.log('Migration: Added refresh_token to usuarios');
    } catch (e) {
      console.warn('Migration: Could not add refresh_token (may already exist):', e.message);
    }
  },

  down: async (queryInterface, Sequelize) => {
    try {
      await queryInterface.removeColumn('usuarios', 'refresh_token');
      console.log('Migration: Removed refresh_token from usuarios');
    } catch (e) {
      console.warn('Migration: Could not remove refresh_token:', e.message);
    }
  }
};
// Migration to add refresh_token column if you later use sequelize-cli
'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('usuarios', 'refresh_token', { type: Sequelize.STRING, allowNull: true });
  },
  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('usuarios', 'refresh_token');
  }
};
