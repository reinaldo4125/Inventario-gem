# Historial de Versiones (CHANGELOG) - Multinyectores

Todas las versiones notables de este proyecto se documentarán en este archivo siguiendo el estándar **Semantic Versioning (SemVer)**: `MAYOR.MENOR.PARCHE` (`X.Y.Z`).

---

## [1.0.0] - 2026-08-19
### 🚀 Lanzamiento Inicial y Funcionalidades Principales
- **Módulo de Inventario**: Gestión de productos, repuestos de inyección electrónica, categorías, precios detal/mayor/almacén y control de almacenes.
- **Módulo de Ventas y Arqueo de Caja**: Cotizaciones, facturación, métodos de pago múltiples y arqueo de caja diario.
- **Control de Acceso**: Roles de Administrador y Vendedor con permisos diferenciados.
- **Reportes & Dashboard**: Indicadores KPI en tiempo real, alertas de stock mínimo, gráficos de ventas y ranking de productos.
- **Gestión Empresarial**: Configuración de NIT, dirección, logo y parámetros de facturación.
- **Endpoint de Versión API**: `/api/version` e indicador visible de versión en la interfaz (`v1.0.0`).

---

## 📌 Guía para Incrementar Versiones en el Futuro

1. **PARCHE (1.0.X)**: Corrección de errores menores, parches de seguridad o pequeñas mejoras visuales.
   ```bash
   npm version patch
   ```
2. **MENOR (1.X.0)**: Nuevas funcionalidades compatibles con la versión actual (ej. nuevos reportes, integraciones nuevas).
   ```bash
   npm version minor
   ```
3. **MAYOR (X.0.0)**: Cambios estructurales grandes o incompatibles (ej. migración completa de base de datos o API).
   ```bash
   npm version major
   ```

4. **Etiquetar en Git y enviar a GitHub**:
   ```bash
   git add .
   git commit -m "release: versión 1.0.1"
   git tag -a v1.0.1 -m "Versión 1.0.1"
   git push origin main --tags
   ```
