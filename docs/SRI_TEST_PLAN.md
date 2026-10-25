# SRI y facturación electrónica — certificación

Objetivo autorizado: flujo funcional en ambiente 1 de pruebas, sin comprobantes tributarios reales.

## Estado vigente — verificado 25-oct-2026

Funcional en ambiente 1: interfaz https://invoice-certification.vercel.app/admin/facturacion y worker independiente https://orangered-wildcat-493803.hostingersite.com. No requiere computadora encendida. Ambiente 2 permanece bloqueado.

- Web Vercel READY: dpl_HmKi4qzjKjeXkBQPjT6MSXayiQ3b. Worker Hostinger build 01a172a3-d222-708b-a3dd-9b057e5a9faf completado; cron final yhvOj4qnCb cada minuto, salida status200/oktrue.
- Acción real de emisión de la web publicada → worker Hostinger → SRI: factura ficticia 002-002-000000011 AUTORIZADA, importe1.15, ambiente1, jobDONE. Sin worker local.
- Acción real de anulación web: nota de crédito ficticia 002-002-000000002 AUTORIZADA; factura11 ANULADA; jobDONE/error nulo.
- Descargas remotas PDF/XML/estado: ADMIN200, anónimo401 y EDITOR401. PDF4286bytes y XML8765bytes de factura11. Cero EmailEnviado en base aislada.
- Formulario y detalle remotos responden200 con sesión. Verificación HTTP de las mismas server actions usadas por el formulario. La inspección visual remota no pudo ejecutarse por error de inicialización del navegador de Codex (kernel assets); no se afirma QA visual.
- Los apartados posteriores conservan el historial de diagnóstico; sus pendientes antiguos quedan sustituidos por este estado.
- Respaldo privado verificado: Estuardo666/whatsapp-implementation-backup, rama codex/sri-certification-20261025, commit raíz 1fd1e26e13b854e8d557f0cff80d7d78012f9e49. Snapshot de las fuentes publicadas, sin historial anterior ni secretos; 978 archivos escaneados. No se modificó main.
- Login Credentials remoto comprobado con cuenta sintética ADMIN y contraseña temporal aleatoria, restaurada al finalizar. La cuenta del dueño conserva su contraseña existente.
- Verificación final: npm run typecheck y 267/267 unitarias pasan. Tipo del runtime SRI completo (index.ts, sri-http.ts y dependencias) pasa con worker/tsconfig.sri.json; comando reproducible npm --prefix worker run typecheck:sri. La comprobación general que también incluye WhatsApp agotó el heap de4GB; no se usa ese intento como evidencia de tipos correctos.

## Uso y custodia

1. Abrir la interfaz indicada e iniciar sesión con el correo y contraseña de la cuenta administradora existente. Google OAuth no está habilitado en esta interfaz aislada.
2. En Facturación, crear factura para el receptor ficticio de certificación. Revisar datos y confirmar emisión. Consultar estado y descargar XML/PDF. Los comprobantes pertenecen exclusivamente al SRI de pruebas.
3. El certificado p12 queda cifrado AES-256-GCM en Neon, base aislada totem_sri_test. PIN y clave maestra son variables privadas de Hostinger; la clave maestra también permite renovar el certificado desde la web administradora. No hay p12 público ni dentro de Git.
4. Reemplazar el certificado al renovarlo (vigencia actual hasta 2027-09-05). Copias de recuperación de secretos protegidas con Windows DPAPI fuera de Git, en Documents/Sri-Test-Secrets; DPAPI depende del usuario/máquina de Windows. Conservar el original por separado.
5. Si el disparo inmediato falla, la factura conserva su trabajo en cola y el cron lo procesa. Revisar /health y salida del cron mediante Hostinger API; no crear una factura duplicada para reintentar.
6. La app principal y los secuenciales productivos permanecen separados. Para facturación tributaria real se requiere autorización posterior y configuración de ambiente2; esta entrega no la activa.

## Condiciones obligatorias

- Ambiente 2 bloqueado salvo autorización técnica explícita independiente.
- Ambiente del transporte, XML y clave de acceso coincidentes.
- Worker de pruebas limitado a base aislada totem_sri_test o sri_local_test.
- Correos a clientes bloqueados en pruebas aunque el trabajo los solicite.
- No reutilizar ni avanzar secuenciales de la base de la aplicación.
- No guardar PIN, claves maestras ni binarios del certificado en Git.

## Evidencia actual

- Certificado y PIN validados localmente; clave privada coincide y firma RSA verificada.
- Vigencia: 2026-09-05 a 2027-09-05.
- WSDL de recepción y autorización celcer.sri.gob.ec: HTTP200, sin enviar XML.
- Base aislada totem_sri_test creada; 14 migraciones aplicadas solo allí.
- Datos legales del emisor copiados, configuración forzada a ambiente 1.
- Certificado almacenado cifrado AES-256-GCM en la base aislada; descifrado de control coincide.
- PIN y clave maestra protegidos con DPAPI y ACL local fuera del repositorio.
- Política nueva: 259/259 unitarias y typecheck worker correctos.
- Configuración de certificado de la aplicación productiva no modificada. Worker SRI aún no activado.

## Pendiente

1. Crear cliente y factura ficticios en la base aislada con secuencial independiente.
2. Validar XML y firma con certificado real, sin envío inicialmente.
3. Enviar solo a recepción de pruebas y consultar autorización; corregir rechazos verificables.
4. Verificar persistencia de estados, XML autorizado y RIDE sin correos ni transacciones reales.
5. Preparar operación de pruebas accesible y persistente; verificar límites y documentar recuperación.
6. Respaldar código limpio sin historial sensible. Activación tributaria de producción fuera de este alcance.
## Certificación realizada — 25-oct-2026

- Factura ficticia 001-002-000000001 rechazada: establecimiento 001 cerrado. Conservada como RECHAZADA, job FAILED.
- Dueño indicó establecimiento 002; se mantuvo punto de emisión 002, solo en base aislada.
- Factura ficticia 002-002-000000001, USD1.15: AUTORIZADA por SRI ambiente1, job DONE y XML autorizado persistido. Cero correos enviados.
- Corregidos nombreComercial vacío, respuesta SOAP singular, referencia de firma URI=#comprobante, estados/errores al autorizar y rechazos permanentes sin reintentos ciegos.
- RIDE y XML exportados en reports/sri-test-ride.pdf y reports/sri-test-authorized.xml. PDF renderizado/revisado, una página con aviso SIN VALIDEZ TRIBUTARIA.
- Descarga PDF ahora tiene generación desde datos autorizados cuando no existe URL de storage. Tipo de ambiente tomado de la clave del propio comprobante.
- Heartbeat de pruebas queda en su propia base, sin reportar estado ficticio a la aplicación productiva.
- Verificación actual: 261 unitarias y tipos raíz/worker correctos.
- Pendientes: habilitar interfaz aislada persistente, probar descargas autenticadas y flujo desde UI; corregir catálogo IVA inconsistente (código2 se interpreta erróneamente como2%, código4 difiere entre catálogos); probar concurrencia de secuenciales y nota de crédito de prueba; publicar y respaldar cambios sin secretos.

## Avance de operación y controles

- Catálogo IVA unificado entre UI, servicio y XML: código2=12%, código4=15%; no objeto/exento separados al agrupar impuestos.
- Seis emisiones concurrentes en base aislada: seis números únicos y un job por factura. Las seis se cancelaron localmente, cero trabajos enviables y cero envíos SRI para esas pruebas.
- Guard de cancelación bloquea trabajos en ejecución y cancela cola pendiente dentro de transacción.
- Factura y job de envío guardados en una transacción; reserva de secuencial con upsert/incremento atómico.
- Acciones de facturación exigen ADMIN y ya no devuelven al navegador el binario cifrado/IV/tag del certificado.
- Descargas HTTP reales en Next local: PDF/XML/estado 200 ADMIN, 401 anónimo y EDITOR. Corregido empaquetado de PDFKit para fuentes AFM.
- Consumidor final no admite nota de crédito; guard y UI corregidos.
- Runtime local reproducible preparado: scripts/start-sri-test.ps1 carga secretos DPAPI y scripts/sri-test-runtime.mjs levanta web localhost y worker solo contra totem_sri_test, ambiente1 y sin correo.
- Segunda factura ficticia identificada 002-002-000000008 AUTORIZADA en SRI pruebas. Siguiente: NC sobre esta factura, interfaz y runtime persistente verificados, build y respaldo limpio.

## Nota de crédito y runtime verificados

- Dos peticiones simultáneas de NC sobre factura ficticia identificada: una aceptada, sin duplicado; bloqueo de fila de factura y creación NC/job dentro de una transacción.
- NC ficticia 002-002-000000001 AUTORIZADA en ambiente1. Job DONE/error nulo, factura 002-002-000000008 ANULADA. Cero correos. XML autorizado NC conservado en resultado del job y reports/sri-test-credit-note-authorized.xml.
- Corregidos nodos de NC: detalle fuera de totalConImpuestos y codigoInterno conforme al esquema; prueba de regresión añadida.
- Runtime versionado iniciado con PowerShell5.1 y DPAPI, puerto3095. Web+worker vivos; latido reciente, ambiente1, cero pendientes y cero correos.
- Descargas repetidas en runtime: PDF/XML/estado 200ADMIN,401EDITOR/anónimo.
- Pendiente creación visual desde formulario, respaldo limpio de versión y guía final. El entorno local exige PC encendida; no se presenta como worker cloud persistente.

## Hostinger — worker remoto

- Aplicación independiente orangered-wildcat-493803.hostingersite.com creada con API en Cloud Professional, nombre neutral.
- Build 01a17299-3428-7231-a5f6-95e967ab7765 completado; worker HTTP autenticado, un trabajo por solicitud y consultas separadas si autorización queda pendiente.
- Usuario de BD sri_certification_app creado y con permisos solo en base aislada de certificación. Certificado sigue cifrado en Neon; PIN/clave maestra y secreto de proceso configurados como variables de la aplicación remota. Copia del entorno protegida DPAPI fuera de Git.
- Salud 200, POST /process sin bearer401, autenticado200.
- Worker local detenido; Hostinger procesó factura ficticia002-002-000000009: AUTORIZADA y job DONE sin error, cero correos.
- Cron Hostinger HQNolnBjH8 programado cada minuto, script carga hbuilds/config/.env sin secretos en comando. Factura ficticia002-002-000000010 pendiente de comprobar que el cron la procese autónomamente.
- Pendiente interfaz remota aislada, comprobación de cola/cron y respaldo final; producción tributaria sigue bloqueada.


## Automatización Hostinger comprobada

- Cron inicial con cd no produjo salida; se reemplazó por comando con rutas absolutas (246 caracteres). Cron final yhvOj4qnCb, cada minuto. Diagnóstico temporal eliminado.
- Salida cron real: status200/oktrue. Factura ficticia002-002-000000010, creada sin llamada manual a /process y con worker local detenido, quedó AUTORIZADA, jobDONE/error nulo y cero correos.
- Interfaz aislada en proyecto Vercel invoice-certification, build dpl_8AfHnE8K9NkkZqntsw3wWH8fjSzB en curso. Base totem_sri_test y usuario limitado; credenciales del dueño habilitadas para login en base de pruebas, sin copiar sesiones/OAuth.
- El guardado de factura/NC dispara POST autenticado al worker; si falla transporte conserva cola. Variables de entorno respaldadas con DPAPI fuera de Git. PIN solo en Hostinger; certificado cifrado solo en Neon.


## Alcance de publicación remota

- Worker remoto y cron final activos en Hostinger (sin procesos locales necesarios). Certificado AES-GCM en Neon; SRI_MASTER_KEY y SRI_P12_PASSWORD privados de la aplicación Hostinger. El servidor no guarda p12 en carpetas públicas.
- Interfaz de certificación independiente en Vercel, con solo BD de pruebas y cuenta ADMIN del dueño. La app principal y sus datos no se cambiaron para emitir comprobantes.
- Se corrigió el empaquetado web: exclusiones ancladas a raíz e inclusión explícita de AppPageHeader, FacturacionNav y segmented, dependencias del módulo actual. Se revisaron imports; única coincidencia ausente era un ejemplo dentro de comentario.
- Fecha de clave y XML definida en America/Guayaquil sin depender del huso horario del servidor.
- Disparo post-commit autenticado nunca convierte un fallo de transporte en error de creación: factura ya encolada permanece válida para recuperación por cron.
- Verificación actual: 267 unitarias y tipos raíz/worker correctos; falta comprobar la publicación final de interfaz, el recorrido HTTP de emisión y respaldo privado.
