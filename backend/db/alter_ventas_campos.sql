-- Migración: agregar campos a la tabla ventas
ALTER TABLE ventas
ADD COLUMN descuento DECIMAL(5,2) NULL,
ADD COLUMN metodoPago VARCHAR(100) NULL,
ADD COLUMN notas TEXT NULL,
ADD COLUMN vendedor VARCHAR(100) NULL,
ADD COLUMN estado ENUM('Pendiente','Pagada','Anulada') NOT NULL DEFAULT 'Pendiente',
ADD COLUMN direccion VARCHAR(255) NULL,
ADD COLUMN telefono VARCHAR(50) NULL,
ADD COLUMN impuestos DECIMAL(5,2) NULL;
