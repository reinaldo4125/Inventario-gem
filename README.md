Proyecto muntinyectores - repositorio inicial.

Contenido:
- backend/
- frontend/

Instrucciones rápidas:
1. `git init` (ya inicializado)
2. `git remote add origin <url>` (añadir remoto)
3. `git push -u origin main`
# Multinyectores - Desarrollo

Este repositorio contiene backend (Express + Sequelize) y frontend (React).

Recomendaciones rápidas:

- Antes de cambios en BD, hacer backup (mysqldump o tu herramienta preferida).

Setup local (Windows PowerShell):

# Backend
cd backend
npm install
cp .env.example .env # crea tu .env y añade JWT_SECRET y REFRESH_SECRET
npm run dev

# Frontend
cd frontend
npm install
npm start

Pruebas:

# En backend
cd backend
npm test

Despliegue con Docker Compose:

docker-compose up --build

Rollback:

- Revertir commits con git revert
- Restaurar base de datos desde backup SQL

Notas:
- Añadí rate-limiting, límites de tamaño de body y soporte básico para refresh tokens.
- Coloca secretos reales en `.env` antes de producción.

Checklist rápido (PowerShell)

1) Crear rama de trabajo

```powershell
git checkout -b feature/full-hardening
```

2) Instalar dependencias y ejecutar backend

```powershell
cd backend
npm install
npm run dev
```

3) Ejecutar tests backend

```powershell
cd backend
npm test
```

4) Ejecutar frontend

```powershell
cd frontend
npm install
npm start
```

5) Pruebas rápidas

```powershell
# Health
Invoke-RestMethod http://localhost:4000/healthz

# Intentar GET /usuarios sin token (debe 401)
Invoke-RestMethod http://localhost:4000/usuarios
```

Rollback

- Revertir commits con `git revert` o `git checkout main && git reset --hard <commit>` si es apropiado.
- Restaurar BD desde backup SQL si se aplicó alguna migración.
