# 🔄 Guía de Configuración: SQLite (Local) ↔ PostgreSQL (Neon)

## 📋 Resumen

- **Desarrollo Local**: SQLite (`file:./dev.db`) con datos dummy
- **Producción/Nube**: PostgreSQL (Neon) solo para estructura

---

## 🏠 DESARROLLO LOCAL (SQLite)

### 1. Configurar Schema

En `prisma/schema.prisma`, asegúrate de tener:

```prisma
datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}
```

### 2. Configurar .env

```env
DATABASE_URL="file:./dev.db"
```

### 3. Inicializar Base de Datos

```bash
# Generar cliente de Prisma
npx prisma generate

# Crear/actualizar base de datos
npx prisma db push

# Sembrar datos dummy (5 clientes + 10 tareas)
npx prisma db seed
```

### 4. Resetear Base de Datos

```bash
# Eliminar base de datos y recrear
rm prisma/dev.db
npx prisma db push
npx prisma db seed
```

---

## ☁️ PRODUCCIÓN/NUBE (PostgreSQL Neon)

### 1. Cambiar Schema

En `prisma/schema.prisma`, **COMENTAR** SQLite y **DESCOMENTAR** PostgreSQL:

```prisma
// 🔧 DESARROLLO LOCAL (SQLite) - COMENTADO
// datasource db {
//   provider = "sqlite"
//   url      = env("DATABASE_URL")
// }

// 🔧 PRODUCCIÓN/NUBE (PostgreSQL Neon) - ACTIVO
datasource db {
  provider  = "postgresql"
  url       = env("POSTGRES_PRISMA_URL") // Connection Pooling
  directUrl = env("POSTGRES_URL_NON_POOLING") // Direct connection
}
```

### 2. Configurar .env

```env
# Comentar SQLite
# DATABASE_URL="file:./dev.db"

# Activar PostgreSQL
POSTGRES_PRISMA_URL="postgresql://user:password@host.neon.tech/dbname?sslmode=require&pgbouncer=true"
POSTGRES_URL_NON_POOLING="postgresql://user:password@host.neon.tech/dbname?sslmode=require"
```

### 3. Aplicar Schema a Neon

```bash
# Generar cliente de Prisma
npx prisma generate

# Aplicar schema (solo estructura, sin datos)
npx prisma db push
```

⚠️ **IMPORTANTE**: No ejecutes `db seed` en producción, solo `db push` para crear la estructura.

---

## 🔄 Checklist de Cambio

### De SQLite → PostgreSQL (Para deploy)

- [ ] Comentar datasource SQLite en `schema.prisma`
- [ ] Descomentar datasource PostgreSQL en `schema.prisma`
- [ ] Actualizar `.env` con URLs de Neon
- [ ] Ejecutar `npx prisma generate`
- [ ] Ejecutar `npx prisma db push` (solo estructura)

### De PostgreSQL → SQLite (Para desarrollo)

- [ ] Comentar datasource PostgreSQL en `schema.prisma`
- [ ] Descomentar datasource SQLite en `schema.prisma`
- [ ] Actualizar `.env` con `DATABASE_URL="file:./dev.db"`
- [ ] Eliminar `prisma/dev.db` (si existe)
- [ ] Ejecutar `npx prisma generate`
- [ ] Ejecutar `npx prisma db push`
- [ ] Ejecutar `npx prisma db seed` (datos dummy)

---

## 📊 Datos Dummy Generados

El seed crea:
- ✅ **1 Usuario Admin**: `admin@totem.com`
- ✅ **5 Clientes**: Audisens, TransCity, Arevalo Moda, 7 Pingas, La Choricería
- ✅ **10 Tareas**: Distribuidas entre los 5 clientes (2 por cliente)

---

## ⚠️ Notas Importantes

1. **No mezclar**: Nunca uses SQLite y PostgreSQL al mismo tiempo
2. **Backup**: Antes de cambiar, haz backup de tus datos
3. **Seed solo local**: El seed está diseñado para desarrollo local, no para producción
4. **Compatibilidad**: El schema es compatible con ambos sistemas (sin tipos exclusivos de PostgreSQL)

