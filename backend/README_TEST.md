**Entorno de pruebas (local)**

Pasos rápidos para levantar un entorno de pruebas aislado (no afecta producción):

1) Levantar MySQL de pruebas (usa `docker-compose.test.yml`):

```bash
docker compose -f ..\docker-compose.test.yml up -d
```

Esto expone MySQL de test en `localhost:3307` y crea la DB `inventario_test`.

2) Copiar el ejemplo de variables y editar si hace falta:

```powershell
cd backend
copy .env.test.example .env.test
# editar .env.test si quieres
```

3) Ejecutar migraciones (opcional) y levantar backend en modo test:

```powershell
cd backend
npm run migrate
.\run-test-backend.ps1
```

o en Linux/macOS:

```bash
cd backend
npm run migrate
./run-test-backend.sh
```

4) Probar endpoint de diagnóstico (ver `PORT` en `.env.test` o usar 4001 por defecto):

```bash
curl -H "Authorization: Bearer <TOKEN>" http://localhost:4001/debug/whoami
```

Notas:
- El `docker-compose.test.yml` crea un servicio MySQL separado en el puerto `3307`.
- El backend se debe ejecutar con las variables de `.env.test` para apuntar a la DB de pruebas y a un `PORT` diferente al de producción.
- No se realiza ningún cambio automático a la BD de producción.
