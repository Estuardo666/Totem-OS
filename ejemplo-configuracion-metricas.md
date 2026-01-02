# Ejemplo: Configuración de Métricas Dinámicas por Cliente

## 1. Configurar Métricas para un Cliente

Para configurar qué métricas debe rastrear un cliente específico, puedes usar la función `updateClientMetricsConfig`:

```typescript
import { updateClientMetricsConfig } from "@/actions/client-actions";

// Ejemplo 1: Cliente que solo rastrea métricas de Meta (Instagram/Facebook)
const result1 = await updateClientMetricsConfig(
  "clx123abc456", // ID del cliente
  [
    "metaViews",
    "metaLikes", 
    "metaShares",
    "metaComments",
    "metaReach"
  ]
);

// Ejemplo 2: Cliente que rastrea métricas de ambas plataformas + business impact
const result2 = await updateClientMetricsConfig(
  "clx789def012",
  [
    // Meta
    "metaViews",
    "metaLikes",
    "metaShares", 
    "metaComments",
    "metaSaves",
    "metaReach",
    // TikTok
    "ttViews",
    "ttLikes",
    "ttShares",
    "ttComments",
    "ttSaves",
    // Business Impact
    "conversions",
    "salesCount",
    "revenue",
    "conversionSource"
  ]
);

// Ejemplo 3: Cliente que solo quiere métricas básicas
const result3 = await updateClientMetricsConfig(
  "clx345ghi678",
  [
    "metaViews",
    "metaLikes",
    "ttViews",
    "ttLikes"
  ]
);
```

## 2. Cómo Funciona en el EditTaskModal

Cuando abres el modal de edición de una tarea:

1. **El sistema detecta automáticamente** qué métricas tiene configuradas el cliente de esa tarea
2. **Genera inputs dinámicos** solo para las métricas habilitadas
3. **Usa un grid de 2 columnas** para optimizar el espacio
4. **Muestra un mensaje** si el cliente no tiene métricas configuradas

## 3. Valores por Defecto

Si un cliente no tiene configuración de métricas (`metricsConfig = null`), el sistema usará **TODAS** las métricas disponibles por defecto:

```typescript
// Métricas por defecto si no hay configuración:
[
  "metaViews", "metaLikes", "metaShares", "metaComments", "metaSaves", "metaReach",
  "ttViews", "ttLikes", "ttShares", "ttComments", "ttSaves",
  "totalBudgetSpent", "notes",
  "conversions", "salesCount", "revenue", "conversionSource"
]
```

## 4. Campos Disponibles

### Métricas Meta (Instagram/Facebook)
- `metaViews` - Vistas
- `metaLikes` - Likes
- `metaShares` - Shares
- `metaComments` - Comentarios
- `metaSaves` - Guardados
- `metaReach` - Alcance

### Métricas TikTok
- `ttViews` - Vistas
- `ttLikes` - Likes
- `ttShares` - Shares
- `ttComments` - Comentarios
- `ttSaves` - Guardados

### Métricas de Business Impact
- `totalBudgetSpent` - Presupuesto gastado
- `notes` - Notas adicionales
- `conversions` - Conversiones
- `salesCount` - Número de ventas
- `revenue` - Ingresos generados
- `conversionSource` - Fuente de conversión (WhatsApp, Web, DM, Link en Bio, Local Físico, Otro)

## 5. Ejemplo Práctico

Imagina que tienes un cliente "Cafetería Local" que solo publica en Instagram y quiere rastrear engagement y conversiones:

```typescript
// Configurar el cliente
await updateClientMetricsConfig(
  clientId,
  [
    "metaViews",
    "metaLikes",
    "metaComments",
    "metaShares",
    "metaReach",
    "conversions",
    "conversionSource"
  ]
);

// Ahora, cuando edites una tarea para este cliente:
// - Solo aparecerán los inputs para las métricas anteriores
// - El botón "Guardar Métricas" guardará solo esos valores
// - El resumen copiado incluirá solo esos datos
```

## 6. Actualización de la Base de Datos

Después de agregar el campo `metricsConfig` al esquema Prisma, ejecuta:

```bash
npx prisma db push
```

Esto actualizará tu base de datos sin perder datos existentes.
