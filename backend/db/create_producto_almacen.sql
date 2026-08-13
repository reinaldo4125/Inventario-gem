CREATE TABLE IF NOT EXISTS producto_almacen (
  id INT AUTO_INCREMENT PRIMARY KEY,
  productoId INT NOT NULL,
  almacenId INT NOT NULL,
  stock INT NOT NULL DEFAULT 0,
  CONSTRAINT fk_producto_almacen_producto FOREIGN KEY (productoId) REFERENCES productos(id),
  CONSTRAINT fk_producto_almacen_almacen FOREIGN KEY (almacenId) REFERENCES almacenes(id),
  UNIQUE KEY unique_producto_almacen (productoId, almacenId)
) ENGINE=InnoDB;