# Totem OS

Sistema operativo interno para agencia de marketing digital.

## Stack Tecnológico

- **Framework:** Next.js 15 (App Router)
- **Lenguaje:** TypeScript (Strict Mode)
- **Estilos:** Tailwind CSS (Mobile-First)
- **UI Kit:** Shadcn/ui
- **Base de Datos:** Prisma ORM + MySQL
- **Validación:** Zod + React Hook Form
- **Iconos:** Lucide React
- **Optimización:** Sharp

## Estructura del Proyecto

```
/src
  /actions        # Server Actions (Mutaciones de DB)
  /app            # Rutas y Layouts (Next.js App Router)
  /components
    /ui           # Componentes base Shadcn (Dumb components)
    /features     # Módulos atómicos (Smart components)
      /clients    # Módulo de clientes
      /content    # Módulo de producción de contenido
      /finance    # Módulo financiero
      /users      # Módulo de usuarios
      /shared     # Componentes compartidos
  /lib            # Utils, DB connection, configuraciones
  /hooks          # Custom hooks
  /schemas        # Zod Schemas (Single Source of Truth)
  /types          # TypeScript Interfaces globales
```

## Configuración Inicial

### 1. Instalar dependencias

```bash
npm install
```

### 2. Configurar variables de entorno

Crea un archivo `.env` en la raíz del proyecto:

```env
DATABASE_URL="mysql://usuario:password@host:puerto/database"
NODE_ENV="development"

# Pusher (Actualizaciones en tiempo real)
PUSHER_APP_ID="tu_app_id"
PUSHER_KEY="tu_key"
PUSHER_SECRET="tu_secret"
PUSHER_CLUSTER="us2"

# Variables públicas para el frontend
NEXT_PUBLIC_PUSHER_KEY="tu_key"
NEXT_PUBLIC_PUSHER_CLUSTER="us2"
```

### 3. Configurar Prisma

```bash
# Generar cliente de Prisma
npm run db:generate

# Aplicar migraciones (desarrollo)
npm run db:push

# O crear migración (producción)
npm run db:migrate
```

### 4. Ejecutar en desarrollo

```bash
npm run dev
```

## Scripts Disponibles

- `npm run dev` - Inicia servidor de desarrollo
- `npm run build` - Construye para producción
- `npm run start` - Inicia servidor de producción
- `npm run lint` - Ejecuta ESLint
- `npm run db:generate` - Genera cliente de Prisma
- `npm run db:push` - Aplica cambios al schema (desarrollo)
- `npm run db:migrate` - Crea migración (producción)
- `npm run db:studio` - Abre Prisma Studio

## Despliegue en cPanel

Este proyecto está configurado con `output: 'standalone'` para compatibilidad con cPanel/Node.js.

1. Construir el proyecto: `npm run build`
2. Subir la carpeta `.next/standalone` y `.next/static` al servidor
3. Configurar Node.js 20.x en cPanel
4. Configurar la base de datos MySQL
5. Configurar variables de entorno en cPanel

## Reglas de Desarrollo

Ver `.cursorrules` para las reglas de calidad y arquitectura del proyecto.






