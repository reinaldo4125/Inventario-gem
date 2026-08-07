Scripts - backend/scripts

Lista de scripts útiles para administrar el campo `costo` y la tabla `producto_costos`:

- addCostoToProductos.js
  - Agrega la columna `costo` a la tabla `productos` si no existe.
  - Uso: node backend/scripts/addCostoToProductos.js

- createProductoCostosTable.js
  - Crea la tabla `producto_costos` para historial de costos por producto y por almacén.
  - Uso: node backend/scripts/createProductoCostosTable.js

- alterCostoAllowNull.js
  - Modifica la columna `costo` en `productos` para permitir NULL.
  - Uso: node backend/scripts/alterCostoAllowNull.js

- migrateCostoZeroToNull.js
  - Actualiza filas con costo = 0 a NULL (después de permitir NULL en la columna).
  - Uso: node backend/scripts/migrateCostoZeroToNull.js

- debugGanancia.js
  - Ejecuta una consulta diagnóstica para revisar cómo se calculan ventas, costos y ganancia.
  - Uso: node backend/scripts/debugGanancia.js

Notas:
- La API nueva `/api/producto-costos` expone endpoints CRUD para administrar los costos históricos.
- El endpoint `/api/reportes/ganancia-producto` consulta `producto_costos` por fecha y almacén antes de usar `productos.costo` o `productos.precio`.
