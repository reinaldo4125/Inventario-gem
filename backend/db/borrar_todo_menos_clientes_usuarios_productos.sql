-- Eliminar toda la información de las tablas excepto clientes, usuarios y productos
DELETE FROM detalle_ventas;
DELETE FROM detalle_facturas;
DELETE FROM facturas;
DELETE FROM ventas;

-- Reiniciar los contadores AUTO_INCREMENT
ALTER TABLE detalle_ventas AUTO_INCREMENT = 1;
ALTER TABLE detalle_facturas AUTO_INCREMENT = 1;
ALTER TABLE facturas AUTO_INCREMENT = 1;
ALTER TABLE ventas AUTO_INCREMENT = 1;
