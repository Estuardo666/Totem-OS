# Totem Bot: implementación y pruebas locales

La implementación está en la rama local `feat/whatsapp-bot`; los commits de
implementación incluyen `4d7073a`, `3b8f2a0`, `24552bb` y `b5fc503`. No se hizo
push a `main`, PR ni merge. El número del bot
se vinculó y su identidad quedó verificada. La sesión persiste en la base de
producción; allí se mantiene la pausa global y los clientes bloqueados, y el
worker local está detenido.

El worker de staging está desplegado en
<https://palevioletred-viper-585081.hostingersite.com>, desde un artefacto de
`feat/whatsapp-bot` sin push. Usa una base Neon separada
`totem_whatsapp_staging` y `WA_DISABLED=1`, `WA_PAIRING_ONLY=1`, `SRI_ENABLED=0`;
`WA_HEALTH_TOKEN` está configurado como secreto del servicio.
`/health/live` y `/health` responden 200 como disabled; el QR sin autorización
responde 401. La base de staging registra solo latidos de conexión: cero grupos,
entradas, mensajes, eventos de sincronización de grupos o envíos. Así, el
staging no accede a la sesión ni a los grupos de producción.

La migración aditiva de producción se probó con PostgreSQL aislado y se aplicó
en Neon tras confirmar que era la única migración pendiente y que las columnas
no existían.

El dueño y Paty están configurados con sus teléfonos y opt-in; Paty tiene
horario L–V. Daniela trabaja en fechas variables;
su opt-in sigue apagado y su teléfono no se configuró, y Paty podrá cargar sus
fechas exactas desde el panel. Hostinger se renovará. Se mantienen los defaults
del plan: pausa global activada, clientes bloqueados, DRAFT, 48 horas,
dos recordatorios, omitir fines de semana, 08:00 Ecuador y sin montos en grupos.

## Resultado verificado el 2026-10-16

- `npm run typecheck`, `npm run build` y `npm run lint` terminaron con exit 0. Lint conserva 14 advertencias previas de imágenes.
- `npm run test:unit`: 217/217. Integración completa: 36/36 en el contenedor PostgreSQL local protegido por `TOTEM_TEST_DATABASE=1`.
- Navegador Chromium: ADMIN configura/pausa, responde decisiones, guarda y descarta borradores y deshace una aprobación; EDITOR no puede abrir el panel. El proxy QR entrega PNG al ADMIN, responde 403 al EDITOR y 401 sin sesión. El puente interno rechaza el bearer ausente y el payload que intenta elegir texto o destinatarios. La imagen QR es sintética y no vincula WhatsApp.
- Worker: `typecheck:wa`, bundle y guard de dependencias verdes; el bundle no requiere Next/Pusher/React. Dos instancias locales compiten por un único lock; solo una queda operativa.
- Docker construido desde cero, sin `node_modules` padre, y ejecutado con Node **22.23.3**: `/health/live` y `/health` responden 200 en modo disabled, QR sin token 401 y QR deshabilitado 404. El segundo latido persistió; SIGTERM cerró con exit 0 y liberó el lock. No hubo conexión WhatsApp ni envío de mensajes reales.
- El watchdog tiene pruebas locales de autorización, umbral de cinco minutos, destinatario, recuperación y no duplicación; el transporte push se simuló y no se enviaron notificaciones. La prueba de inyección usa un generador simulado y comprueba que solo dispone de herramientas de lectura acotadas al cliente; no se llamó a un modelo externo.
- Vinculación real verificada. Durante la activación previa a la pausa se envió un saludo al grupo `Totem Bot – Pruebas`; no hubo mensajes a clientes. Se sincronizaron siete grupos, seis sin asignar y deshabilitados. Tras la instrucción de solo vincular, la pausa global quedó activada y se detuvo el worker: no hay procesamiento de grupos ni nuevos envíos. AUTO continúa apagado.
- H1: dueño y Paty configurados con opt-in; Paty tiene horario L–V. Hostinger se renovará. Daniela sigue sin teléfono ni opt-in; Paty podrá registrar sus fechas mediante el horario `dates`.

Las salidas están en `reports/whatsapp-*.log`. La captura del panel es
`reports/whatsapp-admin-local.png`. La vinculación sí fue real; los smokes
locales de QR y Docker no sustituyen la estabilidad prolongada del worker remoto.
La base aislada quedó con fixtures iniciales. La sesión de WhatsApp permanece
persistida en Neon y la configuración de producción conserva la pausa global,
el gate de clientes apagado y el número verificado del bot.

## Instalación y build del worker

```powershell
npm ci
npm ci --prefix worker
npm run build:wa --prefix worker
npm run typecheck:wa --prefix worker
```

El build necesita el checkout completo para leer `src/` y `prisma/schema.prisma`.
El artefacto de ejecución es `worker/dist/whatsapp/index.js` más
`worker/node_modules/` generado para el sistema destino. El comando de arranque
es `npm run start:wa --prefix worker`; recibe secretos del entorno, sin exigir
un archivo `.env` dentro del servicio. Solo `WA_DISABLED=0` permite conectar.

Alternativa reproducible desde la raíz:

```powershell
docker build -f worker/Dockerfile -t totem-whatsapp:local .
```

`render.yaml` prepara un Web Service Free con auto-deploy desactivado. Sigue la
[referencia oficial de Blueprints](https://render.com/docs/blueprint-spec).
No se ha creado el servicio. `/health/live` comprueba proceso/DB/lock y permite
publicar el QR antes de vincular; `/health` refleja la conexión de WhatsApp para
el watchdog. La sesión vive en Postgres y no requiere disco persistente.

## Base de pruebas

Contenedor local: `totem-whatsapp-test`, PostgreSQL 16, puerto **55439**, base
`totem_whatsapp_test`. Configurar `DATABASE_URL` y `DATABASE_URL_UNPOOLED`
explícitamente a esa base en cada proceso de pruebas. `TOTEM_TEST_DATABASE=1`
es obligatorio para el harness de integración, que vacía sus tablas.

```powershell
# Usar exclusivamente una URL de pruebas en estas variables.
$env:DATABASE_URL = '<URL_POSTGRES_LOCAL_DE_PRUEBAS>'
$env:DATABASE_URL_UNPOOLED = $env:DATABASE_URL
$env:TOTEM_TEST_DATABASE = '1'
npx prisma migrate deploy
npm run db:seed:test
npm run test:integration
node scripts/configure-whatsapp.mjs
npm run typecheck
npm run lint
npm run test:unit
```

`configure-whatsapp.mjs` crea únicamente claves que todavía no existen; no
sobrescribe decisiones previas. Ejecutarlo después del seed, pues el seed
restablece toda la base de pruebas. La interfaz administrativa está en
`/admin/whatsapp` y exige una cuenta ADMIN.

La prueba de navegador usa exclusivamente esta base local y un servidor Next
en el puerto 3080 con `AUTH_SECRET=local-whatsapp-browser-fixture-only-secret`,
`WA_HEALTH_URL=http://127.0.0.1:3082/health`,
`WA_HEALTH_TOKEN=local-qr-proxy-fixture-only` y
`WA_WORKER_SECRET=local-worker-bridge-fixture-only-32-characters`.
Son valores sintéticos, nunca credenciales de despliegue. Luego se ejecuta
`node scripts/whatsapp-browser-smoke.mjs` con la URL de pruebas y
`TOTEM_TEST_DATABASE=1`; el script inicia su propio worker QR simulado y bloquea
las peticiones del navegador a dominios externos.

`whatsapp.aiModel` es opcional: si tiene un id de modelo, el worker lo usa con
el proveedor y la clave que ya están configurados para el asistente; si queda
vacío, usa el modelo normal del asistente. El resumen del equipo consulta la
hora configurada cada minuto y se deduplica por usuario y día de Ecuador.

## Staging y rollout de producción pendiente

Antes de reactivar el teléfono: completar dueño y equipo en el panel, instalar
el worker con Node 22, configurar sus secretos fuera del repositorio, y probar
con `WA_DISABLED=1`. No poner tokens reales en comandos guardados, capturas,
logs ni parámetros de crons. El QR se protege con `WA_HEALTH_TOKEN`.

El backend y el worker comparten `WA_WORKER_SECRET` (al menos 32 caracteres)
para `/api/internal/whatsapp/notify`; el backend conserva sus credenciales
Pusher/Web Push. El worker requiere `TOTEM_API_URL` y la misma
`TOKEN_ENCRYPTION_KEY` que cifra las claves de IA existentes. Los avisos enlazan
al panel autenticado; el token QR nunca se envía en esos mensajes.

El worker remoto está en Hostinger con WhatsApp desactivado y una base de staging
separada. Se reconstruyó desde el estado con `b5fc503` en el build Hostinger
`01a145c2-3899-71e3-847f-2e4209bac652`; `/health/live` y `/health` responden
200 con `disabled=true`, y la base conserva cero grupos, entradas y mensajes.
Un cron Hostinger hace `GET /health` cada minuto (UID `d6tlvmxJDl`), y su salida
reciente fue `HEALTH_OK`. La ventana de estabilidad de 48–72 h está en curso.
Siguen pendientes desplegar el panel y el puente backend, instalar los crons
que llaman rutas de Vercel y cualquier activación de mensajes. AUTO, SRI y crons
de correo permanecen desactivados.

### Dependencias auditadas

`npm audit --omit=dev` del worker reportaba 5 paquetes. Con `xmlbuilder2@^4`
(`b5fc503`) desaparecen `js-yaml@3`, `argparse` y `sprintf-js`; queda solo
`node-forge@1.4.0`.

La auditoría de producción de la aplicación raíz también reportaba alertas con
corrección disponible. `npm audit fix` actualizó el lockfile dentro de los
rangos declarados (`next@15.5.28`, `axios@1.20.0`, `sharp@0.35.5`,
`@xmldom/xmldom@0.8.15` y `source-map-js@1.2.2`). Después del cambio,
`npm audit --omit=dev` en la raíz y el worker deja solo `node-forge`.

La auditoría completa de la raíz todavía informa alertas de dependencias de
desarrollo bajo Tailwind CSS 3 (`braces` y `postcss-selector-parser`, entre
otras dependencias encadenadas). npm propone `tailwindcss@4.3.3` con
`--force`, lo que sería una migración mayor; no se forzó como parte de este
cambio.

**Excepción temporal: `node-forge` (GHSA-86w9-cpqp-85rv / CVE-2026-85393, alta).**

- El aviso afecta la *verificación* de firmas RSA PKCS#1 v1.5 y no tiene versión
  corregida. `src/lib/sri/xml-signer.ts` solo parsea el `.p12`, calcula hashes y
  firma; no llama a ninguna API de verificación de node-forge.
- Revisión del 2026-10-16: el advisory sigue sin versión parcheada y el [PR
  upstream #1152](https://github.com/digitalbazaar/forge/pull/1152) continúa
  abierto.
- `node:crypto` no sustituye a node-forge por completo: no lee PKCS#12, así que
  seguiría haciendo falta un parser de `.p12`.
- Prueba local 2026-10-16: `tests/unit/sri-xml-signer.test.mjs` crea un `.p12`
  sintético en memoria, comprueba lectura/contraseña/huella y verifica con
  `node:crypto` la firma RSA y los digests generados. Detectó y corrigió que el
  digest XAdES se calculaba sobre el `ds:Object` entero mientras `URI` apuntaba
  al elemento `xades:SignedProperties`. [ETSI TS 101 903](https://www.etsi.org/deliver/etsi_ts/101900_101999/101903/01.04.02_60/ts_101903v010402p.pdf)
  exige cubrir `SignedProperties` con un `ds:Reference`, y [XMLDSig](https://www.w3.org/TR/2002/REC-xmldsig-core-20020212/)
  calcula cada digest sobre el dato resuelto y transformado de su referencia.
- La prueba sintética no demuestra aceptación por el SRI. `canonicalizeExcC14N`
  sigue siendo simplificada; la firma debe validarse con facturas reales en el
  ambiente de pruebas antes de habilitar SRI.
- Vigencia: hasta el **2026-11-16** o hasta que exista versión corregida, lo
  que ocurra antes. Revisar entonces el aviso de nuevo.
- Condición: SRI sigue desactivado hasta probar el parseo del `.p12` y la firma
  con un fixture, y validarlos en el ambiente de pruebas del SRI con facturas
  reales.
- Si la política exige limpiar el hallazgo, evaluar como cambio aparte un parser
  P12 mantenido o una extracción basada en OpenSSL.

Hostinger vence el **2026-11-16** según el plan. La zona horaria, alertas y
capacidad real de hosting no se han vuelto a verificar en esta ejecución local.
El Bearer expuesto en un cron de eternavida debe rotarse sin copiarlo a este
repositorio. `DAILY_DIGEST_SETUP.md` ya no contiene valores Bearer literales,
pero el commit `e6b9b44` que los contenía también está en `origin/main`; cualquier
`CRON_SECRET` asociado que siga activo debe rotarse. No se modificaron crons de
otros sitios ni se reescribió historial compartido.
