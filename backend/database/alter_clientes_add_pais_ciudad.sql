-- Agrega la columna 'ciudad' si no existe
SET @col_ciudad := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'clientes' AND COLUMN_NAME = 'ciudad');
SET @col_pais := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'clientes' AND COLUMN_NAME = 'pais');
-- Solo ejecuta el ALTER si la columna no existe
SET @sql_ciudad := IF(@col_ciudad = 0, 'ALTER TABLE clientes ADD COLUMN ciudad VARCHAR(100);', 'SELECT 1;');
PREPARE stmt FROM @sql_ciudad; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql_pais := IF(@col_pais = 0, 'ALTER TABLE clientes ADD COLUMN pais VARCHAR(100) DEFAULT \'Colombia\';', 'SELECT 1;');
PREPARE stmt2 FROM @sql_pais; EXECUTE stmt2; DEALLOCATE PREPARE stmt2;
