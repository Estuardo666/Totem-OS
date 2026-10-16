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
`totem_whatsapp_staging`; las claves `WA_DISABLED`, `WA_PAIRING_ONLY`,
`SRI_ENABLED` y `WA_HEALTH_TOKEN` están configuradas, aunque Hostinger enmascara
los valores y no permite verificar por API el valor efectivo de `SRI_ENABLED`.
El build actual es `01a146f5-2e74-7154-b4ca-9ffd1fbcf563`. La comprobación tras
el rebuild obtuvo `/health` HTTP 200 con `disabled=true`, `pairingOnly=true` y
`connected=false`; el cron respondió `HEALTH_OK`. La base de staging registra
solo latidos de conexión: cero grupos, entradas, mensajes, eventos de
sincronización de grupos o envíos. Así, el staging no accede a la sesión ni a
los grupos de producción.

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
- `npm run test:unit`: 226/226. Integración completa: 38/38 en el contenedor PostgreSQL local protegido por `TOTEM_TEST_DATABASE=1`.
- Navegador Chromium: ADMIN configura/pausa, responde decisiones, guarda y descarta borradores y deshace una aprobación; EDITOR no puede abrir el panel. El proxy QR entrega PNG al ADMIN, responde 403 al EDITOR y 401 sin sesión. El puente interno rechaza el bearer ausente y el payload que intenta elegir texto o destinatarios. La imagen QR es sintética y no vincula WhatsApp.
- Worker: `typecheck:wa`, bundle y guard de dependencias verdes; el bundle no requiere Next/Pusher/React. La integración de lock, contra PostgreSQL aislado, fuerza dos claims concurrentes y verifica un solo holder, denegación de refresh ajeno y takeover tras vencer el heartbeat. No se han conectado dos procesos worker desplegados. La prueba unitaria también verifica el veto de `WA_PAIRING_ONLY` a inbound, grupos y automatizaciones.
- Docker construido desde cero, sin `node_modules` padre, y ejecutado con Node **22.23.3**: `/health/live` y `/health` responden 200 en modo disabled, QR sin token 401 y QR deshabilitado 404. El segundo latido persistió; SIGTERM cerró con exit 0 y liberó el lock. No hubo conexión WhatsApp ni envío de mensajes reales.
- El watchdog tiene pruebas locales de autorización, umbral de cinco minutos, destinatario, recuperación y no duplicación; el transporte push se simuló y no se enviaron notificaciones. La prueba de inyección usa un generador simulado y comprueba que solo dispone de herramientas de lectura acotadas al cliente; no se llamó a un modelo externo.
- Vinculación real verificada. Durante la activación previa a la pausa se envió un saludo al grupo `Totem Bot – Pruebas`; no hubo mensajes a clientes. Se sincronizaron siete grupos, seis sin asignar y deshabilitados. Tras la instrucción de solo vincular, la pausa global quedó activada y se detuvo el worker: no hay procesamiento de grupos ni nuevos envíos. AUTO continúa apagado.
- H1: dueño y Paty configurados con opt-in; Paty tiene horario L–V. Hostinger se renovará. Daniela sigue sin teléfono ni opt-in; Paty podrá registrar sus fechas mediante el horario `dates`.

Las salidas están en `reports/whatsapp-*.log`. La captura del panel es
`reports/whatsapp-admin-local.png`. La vinculación sí fue real. El dueño eximió
las esperas de estabilidad remota de 48/72 h por confianza en Hostinger; el
smoke posterior al rebuild confirma el arranque y la salud en ese momento, no
estabilidad prolongada ni reconexión tras reinicio.
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
separada. El build actual `01a146f5-2e74-7154-b4ca-9ffd1fbcf563` se generó desde
`totem-worker-20261016-230223.zip`, validado localmente y sin `.env`,
`node_modules` ni `dist`; Hostinger no registra un SHA de commit para archivos.
El build terminó el 2026-10-16 23:04:16 UTC. Tras el reinicio, la primera
consulta inmediata dio `lock_unavailable`; unos segundos después `/health`
respondió HTTP 200 con `disabled=true`, `pairingOnly=true`, `connected=false` y
uptime de 27 s. El cron Hostinger `d6tlvmxJDl` respondió `HEALTH_OK`. Las claves
de entorno siguen presentes; sus valores están enmascarados y el valor efectivo
de `SRI_ENABLED` no pudo leerse por API. El dueño eximió las esperas de 48/72 h
por confianza en Hostinger; no se afirma estabilidad ni reconexión probadas. La
automatización de sondeo se eliminó. Siguen pendientes desplegar el panel y el
puente backend, instalar los crons que llaman rutas de Vercel y cualquier
activación de mensajes. AUTO, SRI y crons de correo permanecen desactivados.

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
- Revisión del 2026-10-16: `npm audit --omit=dev` en raíz y worker sigue
  reportando solo `node-forge` como alta, sin versión corregida. Los PR upstream
  [#1152](https://github.com/digitalbazaar/forge/pull/1152) y
  [#1159](https://github.com/digitalbazaar/forge/pull/1159) continúan abiertos.
  El autor de #1159 advierte que el conteo de elementos propuesto en #1152 puede
  aceptar bytes dentro del `NULL` y longitudes DER no mínimas; no tratar ninguno
  como parche publicado o definitivo. Mantener la excepción temporal hasta una
  versión revisada y publicada.
- `node:crypto` no sustituye a node-forge por completo: no lee PKCS#12, así que
  seguiría haciendo falta un parser de `.p12`.
- Prueba local 2026-10-16: `tests/unit/sri-xml-signer.test.mjs` crea un `.p12`
  sintético en memoria, comprueba lectura/contraseña/huella y verifica con
  `node:crypto` la firma RSA y los digests; `xml-crypto.checkSignature` valida
  el XMLDSig completo del fixture. Detectó y corrigió que el
  digest XAdES se calculaba sobre el `ds:Object` entero mientras `URI` apuntaba
  al elemento `xades:SignedProperties`. [ETSI TS 101 903](https://www.etsi.org/deliver/etsi_ts/101900_101999/101903/01.04.02_60/ts_101903v010402p.pdf)
  exige cubrir `SignedProperties` con un `ds:Reference` cuyo `Type` sea
  `http://uri.etsi.org/01903#SignedProperties`, y [XMLDSig](https://www.w3.org/TR/2002/REC-xmldsig-core-20020212/)
  calcula cada digest sobre el dato resuelto y transformado de su referencia.
- La fixture también confirmó que `xades:CertDigest` debe resumir el certificado
  DER; se reemplazó el digest incorrecto de emisor+serial por el de los bytes
  DER, como exige ETSI TS 101 903 v1.4.2.
- Se usa `xml-crypto` para Exclusive C14N en `SignedInfo` y la factura; como la
  referencia a `SignedProperties` no declara transforms, su digest usa el
  Canonical XML 1.0 implícito de XMLDSig. Se copia al elemento referenciado el
  contexto de namespaces y atributos `xml:*` heredados del comprobante; la
  fixture con namespace por defecto/no usado, `xml:lang` y `xml:space` verifica
  que el digest coincide con el nodo ya insertado.
- `X509SerialNumber` se escribe como entero decimal de precisión arbitraria
  (node-forge entrega el serial hexadecimal). `X509IssuerName` usa el formato
  DN RFC 2253 de OpenSSL, invirtiendo el orden de líneas para conservar el orden
  de RDN y quitando espacios de presentación alrededor del `+` multivaluado;
  la fixture comprueba RDNs simples y multivaluados, y el escape de coma, `+`
  y espacio.
  Referencias: [XMLDSig](https://www.w3.org/TR/2002/REC-xmldsig-core-20020212/),
  [Canonical XML 1.0 §2.4](https://www.w3.org/TR/2001/REC-xml-c14n-20010315/#DocumentSubsets)
  y [RFC 2253](https://www.rfc-editor.org/rfc/rfc2253.html).
- La prueba sintética no demuestra aceptación por el SRI. La firma debe
  validarse con facturas reales en el ambiente de pruebas antes de habilitar
  SRI.
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
