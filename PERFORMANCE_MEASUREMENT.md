# 📈 MEDICIÓN Y MONITOREO - Performance

Cómo medir y validar que las optimizaciones funcionan.

---

## 🔍 HERRAMIENTAS DE MEDICIÓN

### 1. Chrome DevTools - Lighthouse

**Pasos:**
1. Abrir DevTools (F12)
2. Ir a pestaña **Lighthouse**
3. Seleccionar:
   - Device: Mobile
   - Category: Performance
4. Click en **Analyze page load**

**Métricas a monitorear:**

| Métrica | Actual | Meta | Mejora |
|---------|--------|------|--------|
| First Contentful Paint (FCP) | ~2.5s | ~1.2s | 52% ↓ |
| Largest Contentful Paint (LCP) | ~3.5s | ~1.8s | 49% ↓ |
| Cumulative Layout Shift (CLS) | ~0.1 | ~0.05 | 50% ↓ |
| Time to Interactive (TTI) | ~4s | ~2s | 50% ↓ |

---

### 2. React DevTools - Profiler

**Para detectar renders innecesarios:**

```typescript
// 1. Instalar React DevTools (Chrome extension)
// 2. Abrir DevTools → React
// 3. Ir a pestaña "Profiler"
// 4. Click en círculo rojo para grabar
// 5. Interactuar con la app
// 6. Analizar renders

// Buscar:
// ✅ Blue = fast (<5ms)
// 🟡 Yellow = medium (>5ms, <25ms)
// 🔴 Red = slow (>25ms)

// En un componente, agregar esto si notas renders lentos:
console.log("🔴 RENDER:", ComponentName);

// Y para memoización:
const memoComponent = memo(Component, (prev, next) => {
  console.log("Comparing:", { prev, next });
  return prev.id === next.id;  // return true si son iguales, para NO renderizar
});
```

**Ejemplo de uso:**

```typescript
// ❌ Renders innecesarios
export function ShootsView({ shootings }) {
  // Si shootings prop no cambió, esto sigue renderizando
  return (
    {shootings.map(s => <ShootingCard key={s.id} {...s} />)}
  );
}

// ✅ Memoizar para evitar renders
export const ShootsView = memo(function ShootsView({ shootings }) {
  return (
    {shootings.map(s => <ShootingCard key={s.id} {...s} />)}
  );
}, (prev, next) => {
  // Comparador personalizado
  return prev.shootings.length === next.shootings.length;
});
```

---

### 3. Network Tab - Análisis de requests

**Pasos:**
1. DevTools → Network
2. Desmarcar "Disable cache"
3. Recargar página (F5)
4. Observar columnas:
   - **Type**: Arquitectura de request
   - **Size**: Tamaño del payload
   - **Time**: Duración total

**Checklist:**
- [ ] Ningún request >500KB
- [ ] API responses <200ms
- [ ] JS bundles <200KB
- [ ] CSS <50KB
- [ ] Images optimizadas

**Ejemplo de mejora:**

```
❌ ANTES getTasks request:
- Size: 250KB
- Time: 800ms
- Payload: Todas las propiedades del cliente + brandDNA

✅ DESPUÉS getTasks request:
- Size: 50KB
- Time: 200ms
- Payload: Solo campos necesarios (select específico)
```

---

### 4. Performance API (en código)

```typescript
// ✅ Medir rendering de componente
useEffect(() => {
  const startMark = performance.now();
  
  return () => {
    const endMark = performance.now();
    console.log(`⏱️ Componente renderizó en ${endMark - startMark}ms`);
  };
}, []);

// ✅ Medir server action
async function createShooting(input) {
  const start = performance.now();
  
  try {
    const result = await fetch('/api/shoots', { method: 'POST', body });
    
    const elapsed = performance.now() - start;
    console.log(`✅ createShooting: ${elapsed}ms`);
    
    return result;
  } catch (err) {
    const elapsed = performance.now() - start;
    console.error(`❌ createShooting error after ${elapsed}ms:`, err);
    throw err;
  }
}

// ✅ Medir queries Prisma
await db.shoot.findMany({
  // ... query
});
// Aparecerá en DevTools de Prisma si tienes Prisma Studio abierto
```

---

## 📊 BENCHMARK ANTES/DESPUÉS

### Test Scenario: Abrir formulario de crear rodaje

**ANTES - Con problemas:**
```
Timeline perfil:
0ms     - Click en "Nuevo Rodaje"
150ms   - Dialog inicia apertura
200ms   - useEffect triggeriza (getUsers + Google Cal check)
300ms   - Renderiza loading de componentes
400ms   - Request getUsers responde
500ms   - Request Google Calendar responde
600ms   - Renderiza formulario completo
700ms   - ✅ Usuario puede empezar a escribir

Total: 700ms de espera
```

**DESPUÉS - Optimizado:**
```
Timeline perfil:
0ms     - Click en "Nuevo Rodaje"
150ms   - Dialog inicia apertura
200ms   - useEffect triggeriza (getUsers SI existe prop, o fetch)
250ms   - Renderiza formulario (users ya datos prop)
350ms   - ✅ Usuario puede empezar a escribir

Total: 350ms de espera (50% mejora)
```

---

### Test Scenario: Filtrar rodajes por cliente

**ANTES:**
```
0ms      - Pick cliente en dropdown
50ms     - Cada keystroke recalcula filtro (sin debounce)
100ms    - Renders de lista
150ms    - Renders de lista
200ms    - Renders de lista
250ms    - ✅ Finaliza (jank visible)

FPS: 25/60 (muy jank)
```

**DESPUÉS:**
```
0ms      - Escribir "cliente..."
300ms    - [Debounce espera 300ms]
300-320ms - Calcula filtro UNA sola vez
320-340ms - Renderiza lista una sola vez
340ms    - ✅ Completado (suave)

FPS: 58-60 (smooth)
```

---

## ✅ SCRIPT DE VALIDACIÓN

Copiar este script en **Console** de DevTools después de implementar cambios:

```javascript
// ✅ PERFORMANCE CHECKER
(() => {
  console.log("🔍 PERFORMANCE ANALYSIS");
  console.log("======================");
  
  // 1. Medir tamaño de bundles
  const perfData = performance.getEntriesByType('resource');
  const jsBundles = perfData.filter(r => r.name.includes('.js'));
  const jsSize = jsBundles.reduce((sum, r) => sum + r.transferSize, 0) / 1024;
  console.log(`📦 Total JS: ${jsSize.toFixed(2)}KB`);
  
  // 2. Medir API requests
  const apiRequests = perfData.filter(r => r.name.includes('/api'));
  const avgApiTime = apiRequests.reduce((sum, r) => sum + r.duration, 0) / apiRequests.length;
  console.log(`🌐 API promedio: ${avgApiTime.toFixed(0)}ms (${apiRequests.length} requests)`);
  
  // 3. Medir Web Vitals
  if (window.performance && window.performance.timing) {
    const timing = performance.timing;
    const fcp = timing.firstContentfulPaint - timing.navigationStart;
    const lcp = timing.loadEventEnd - timing.navigationStart;
    const tti = timing.domInteractive - timing.navigationStart;
    
    console.log(`🎨 First Contentful Paint: ${fcp}ms`);
    console.log(`📏 Largest Contentful Paint: ${lcp}ms`);
    console.log(`⏱️  Time to Interactive: ${tti}ms`);
  }
  
  // 4. Medir re-renders
  console.log(`♻️  React Components en DOM: ${document.querySelectorAll('[data-reactroot]').length}`);
})();
```

**Ejecutar:**
1. Abrir DevTools (F12)
2. Ir a Console
3. Pegar el script
4. Presionar Enter

**Resultado esperado:**
```
🔍 PERFORMANCE ANALYSIS
======================
📦 Total JS: 350KB (antes: 450KB)
🌐 API promedio: 200ms (antes: 800ms)
🎨 First Contentful Paint: 1200ms (antes: 2500ms)
📏 Largest Contentful Paint: 1800ms (antes: 3500ms)
⏱️  Time to Interactive: 2000ms (antes: 4000ms)
♻️  React Components en DOM: 125 (normal, depende del contenido)
```

---

## 🎯 MÉTRICAS DE ÉXITO PARA CADA OPTIMIZACIÓN

### Gran: Over-fetching reduction (select específico)

```
ANTES:
- getTasks request size: 250KB
- Paint time: 500ms
- Time to Interactive: 3s

DESPUÉS:
- getTasks request size: 50KB (-80%)
- Paint time: 150ms (-70%)
- Time to Interactive: 1.5s (-50%)

✅ OBJETIVO: Lograr >50% reducción en size + 40% en TTI
```

### Quick Win: Debounce búsqueda

```
ANTES:
- 8 renders durante "cliente" (8 keystrokes)
- FPS durante typing: 20-30fps
- Jank visible

DESPUÉS:
- 1 render después de 300ms debounce
- FPS durante typing: 58-60fps
- Typing suave

✅ OBJETIVO: Lograr 55+ FPS durante typing
```

### Quick Win: Validación onBlur

```
ANTES:
- Validaciones: N*keystroke (100+ por sesión)
- CPU: 15-20% en formulario
- Lag en validación async

DESPUÉS:
- Validaciones: Una por campo al blur (máximo 10)
- CPU: <5% en formulario
- Sin lag

✅ OBJETIVO: <50% validaciones totales
```

### Medium: Paginación

```
ANTES:
- Renderiza 100+ rodajes
- Component render time: 2-3s
- Scroll: 20fps

DESPUÉS:
- Renderiza 25 rodajes
- Component render time: <500ms
- Scroll: 58-60fps

✅ OBJETIVO: <500ms render time, 55+ fps scroll
```

---

## 🔧 HERRAMIENTA DE MONITOREO CONTÍNUO

Agregar a `src/lib/performance-monitor.ts`:

```typescript
/**
 * Monitor de performance para desarrollo
 * Log automático de métricas sospechosas
 */

export function setupPerformanceMonitoring() {
  if (typeof window === 'undefined') return;

  // Monitor Web Vitals
  if ('WebVitals' in window) {
    // Largest Contentful Paint
    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const lastEntry = entries[entries.length - 1];
      
      const lcp = lastEntry.renderTime || lastEntry.loadTime;
      const lcpValue = lcp / 1000;
      
      if (lcpValue > 2.5) {
        console.warn(`⚠️  LCP lento: ${lcpValue.toFixed(2)}s`);
      } else {
        console.log(`✅ LCP bueno: ${lcpValue.toFixed(2)}s`);
      }
    });

    observer.observe({ type: 'largest-contentful-paint', buffered: true });
  }

  // Monitor API Response Times
  const originalFetch = window.fetch;
  window.fetch = function(...args) {
    const start = performance.now();
    
    return originalFetch.apply(this, args).then(response => {
      const duration = performance.now() - start;
      
      if (duration > 500) {
        console.warn(`⚠️  API lenta: ${args[0]} (${duration.toFixed(0)}ms)`);
      }
      
      return response;
    });
  };
}

// Llamar en app/layout.tsx o main entry point
// if (process.env.NODE_ENV === 'development') {
//   setupPerformanceMonitoring();
// }
```

---

## 📝 TEMPLATE DE REPORTE

Usar este template después de cada optimización:

```markdown
## Optimización: [NOMBRE]
**Fecha:** [FECHA]
**Responsable:** [NOMBRE]

### Antes
- Métrica 1: X
- Métrica 2: Y
- Métrica 3: Z

### Después
- Métrica 1: X' (↓ XX%)
- Métrica 2: Y' (↓ XX%)
- Métrica 3: Z' (↓ XX%)

### Cambios realizados
- Cambio 1
- Cambio 2
- Cambio 3

### Validación
- [ ] Lighthouse: Score >85 en Performance
- [ ] Network: API <200ms
- [ ] React DevTools: Renders razonables
- [ ] Manual testing: Sin jank/lag visible

### Observaciones
[Cualquier notación adicional]
```

---

## 🚀 PRÓXIMOS PASOS

1. **Baseline (HOY):**
   - [ ] Ejecutar Lighthouse → Guardar screenshot
   - [ ] Ejecutar script de validación
   - [ ] Anotar tiempos en Network tab

2. **Implementar optimizaciones (MAÑANA):**
   - [ ] Quick wins (1.5h)
   - [ ] Paginación (2-3h)
   - [ ] Testing manual

3. **Medir resultados (MAÑANA TARDE):**
   - [ ] Ejecutar Lighthouse nuevamente
   - [ ] Comparar con baseline
   - [ ] Crear reporte

4. **Monitoreo**: Agregar observabilidad permanente

