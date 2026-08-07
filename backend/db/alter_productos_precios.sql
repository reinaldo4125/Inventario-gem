ALTER TABLE productos 
ADD COLUMN precio_detal DECIMAL(10,2) NULL AFTER precio,
ADD COLUMN precio_mayor DECIMAL(10,2) NULL AFTER precio_detal,
ADD COLUMN precio_almacen DECIMAL(10,2) NULL AFTER precio_mayor;