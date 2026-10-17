# Preparación de producción: WhatsApp

Preparado el 2026-10-16 (Ecuador). El worker productivo ya se publicó desactivado;
la web continúa en la versión anterior mientras se resuelve el despliegue de
Vercel. **No se hizo push, merge a main ni activación de mensajes o SRI.**
Las esperas de 48/72 horas fueron eximidas por el dueño.

## Avance de publicación

- Aplicación Hostinger nueva: `whitesmoke-hare-297793.hostingersite.com`.
  Se usan nombres neutrales para los recursos nuevos: archivo
  `message-worker-release-20261016.zip`, identificador `message-worker-production`
  y variable `APP_API_URL`. No se renombraron ni modificaron servicios ajenos.
- Build `01a147b1-bafe-710f-90c0-34a9957388ae` completado con Node 22;
  `/health` y `/health/live` devuelven 200, `disabled=true`, `connected=false`,
  `pairingOnly=true`, `testGroupOnly=false`, `SRI_ENABLED=0`.
- Se añadieron únicamente las tres variables WA faltantes de Vercel; las
  variables productivas anteriores se conservaron. Los secretos nuevos son
  distintos de staging y su copia cifrada está en `planned-environment.aes`.
- Respaldo renovado antes del despliegue en
  `D:/Users/Stuart/Documents/Totem-Backups/production-deploy-20261016-211942`,
  restaurado y verificado: 71 tablas y 25.215 registros. Después de publicar el
  worker, los hashes de usuarios, clientes, tareas, transacciones, facturas,
  sesión WhatsApp y grupos coinciden con esa instantánea. El worker escribe solo
  sus eventos de salud y lock durante esta comprobación; no se aplicó DDL.
- Primer intento web: `dpl_J99RekxWWME4UmgN4UEXAqg8iqEG`, bloqueado porque la
  identidad Git local era `luisloyolaaguirre-dev`, distinta del propietario
  autenticado. El dueño confirmó usar `Estuardo666` para los commits nuevos.
  Se conserva intacto el historial de Luis; no se amplían permisos en Vercel.
- El segundo intento web (`dpl_3QqJTJEvBeHgEpDkD3ZsZae74Ltt`, commit `a85def5`)
  ya recibe la autoría confirmada de `Estuardo666`, pero Vercel vuelve a bloquearlo
  por permisos del autor. La cuenta GitHub autenticada es `Estuardo666` y la
  cuenta Vercel es `estuardo666`; comprobar Login Connections y el acceso al
  proyecto desde Vercel. No se cambiaron permisos, identidades de otros autores
  ni protecciones del proyecto para evitar ese bloqueo.
- La comprobación del puente nuevo y la promoción del dominio quedan pendientes
  de resolver ese permiso. El dominio público conserva el despliegue anterior.
  Guía del proveedor: https://vercel.com/docs/deployments/troubleshoot-project-collaboration
- La configuración temporal en texto plano se eliminó después de configurarla;
  permanece su copia cifrada. La salud/QR verificó 200 para salud, 401 para QR
  sin credencial y 404 autenticado mientras el worker está desactivado.

## Identidad Git y versión publicable

Se verificó un correo que GitHub asocia a commits existentes de `Estuardo666`
y que coincide con la cuenta autenticada de Vercel. Se actualizó `user.email`
global y el ajuste local que lo anulaba; el historial anterior no se reescribe.
El correo `noreply` anterior también figura en commits verificados de GitHub,
por lo que el problema no es su sintaxis; se usa la dirección reconocida por
ambos servicios para el nuevo intento.

La configuración local histórica contenía teléfonos personales. La rama
`codex/whatsapp-production-release-20261016` publica una instantánea revisada
sobre `origin/main`, con configuración de ejemplo y fixtures sintéticos. Las
ramas locales originales y los respaldos privados conservan el historial y la
configuración real; no se envían esas ramas al remoto. La base de producción
conserva los teléfonos configurados. `WA_BOT_PHONE` pasa a ser configuración
obligatoria del worker y del panel; está configurada en el worker productivo y
en Vercel, sin valores reales incrustados en el código. El bootstrap versionado
arranca pausado, con dueño y equipo sin configurar, y conserva las claves ya
existentes cuando se ejecuta explícitamente.

## Candidato y versión a conservar

- Rama local de revisión: `codex/whatsapp-production-candidate-20261016`.
- Checkout aislado: `C:/Users/Stuart/.codex/worktrees/whatsapp-production-prep/Totem OS`.
- El checkout original sigue en `feat/whatsapp-bot`, con sus cambios conservados.
- El candidato incluye los cambios sin commit de WhatsApp y conserva la función
  de ingresos por chat/voz. Integra `origin/main` en el checkout aislado; las tres
  colisiones de herramientas del asistente conservan ambas funcionalidades.
- Versión web productiva observada: `11704c14f77066920431997f757de6636bc1ee70`.
- Despliegue anterior para recuperación: `dpl_8NE3kx396Exc4FbqwQdRLryDEQpg`,
  `totem-av1yxxjkd-stuarts-projects-bdd60b3d.vercel.app` (READY).
- La referencia exacta del candidato, hashes y archivos del paquete quedan en
  `release-manifest.json` dentro del respaldo privado. Comprobar que producción
  no avanzó antes de publicar; si avanzó, reconciliar y volver a verificar.

## Respaldo comprobado

Carpeta privada, fuera del repositorio:
`D:/Users/Stuart/Documents/Totem-Backups/production-prep-20261016-204632`.
Su ACL permite acceso al usuario Windows actual y SYSTEM.

- `repository.bundle`: historial Git anterior a la preparación; bundle verificado.
- `working-tree.patch`, `staged.patch`, `candidate-source/` y
  `source-manifest.json`: estado inicial, incluidos archivos sin commit.
- `release-repository.bundle` y `release-candidate-source/`: candidato final
  y cambios de preservación del esquema, separados del estado inicial.
- `database.pgdump.aes`: copia consistente de `neondb` (PostgreSQL 17), obtenida
  en una transacción de solo lectura y cifrada con AES-256-GCM.
- `database-manifest.json`: hashes de los archivos y de los registros de cada
  tabla en la misma instantánea de PostgreSQL.
- `local-config.aes`: configuración local cifrada, incluidos los archivos de
  entorno y la vinculación local del proyecto Vercel. No está en Git.
- `key.dpapi`: clave protegida por Windows CurrentUser. Se necesita el mismo
  usuario/perfil Windows para descifrar; copiar la carpeta a otro equipo por sí
  solo no proporciona recuperación allí. Esta copia local no sustituye un
  respaldo externo con una clave de recuperación independiente.

La restauración real en un contenedor nuevo PostgreSQL 17 verificó **71 tablas y
25.215 registros**, con igualdad de hashes por tabla, incluida `WhatsAppAuth`.
El contenedor no tuvo red, puertos publicados ni procesos de la aplicación, y
se eliminó al terminar. Una segunda prueba independiente, usando únicamente el
respaldo y la clave DPAPI guardada, confirmó también el descifrado de la
configuración. Evidencia: `offline-recovery-drill.log`.

La exportación adicional de las variables reales de Vercel fue bloqueada por la
revisión automática, sin una razón más específica. **No está respaldado aquí el
entorno remoto completo de Vercel** ni se verificó que todas sus claves coincidan
con las locales. Conservar/exportar ese entorno por un medio autorizado antes
de modificarlo. El despliegue anterior conserva su entorno asociado.

El dump incluye referencias a archivos externos, no copias de sus binarios.
Este despliegue no debe eliminar ni reemplazar almacenamiento, adjuntos o
certificados externos. No cambiar `TOKEN_ENCRYPTION_KEY` ni otras claves que
cifran información existente.

Para repetir el ensayo de recuperación, sin acceso a una base remota:

```powershell
node scripts/restore-postgres-backup-local.mjs 'D:/Users/Stuart/Documents/Totem-Backups/production-prep-20261016-204632'
```

Para renovar el respaldo inmediatamente antes de publicar, crear otra carpeta
privada fuera de Git y ejecutar `scripts/backup-postgres-encrypted.mjs` con esa
carpeta, el hostname directo esperado y `neondb`. Nunca sobrescribe un dump
existente. Los secretos se leen del entorno local, no de argumentos ni logs.

## Esquema y datos existentes

La producción ya tiene las **13 migraciones** aplicadas; sus checksums coinciden
con los archivos del candidato, normalizando únicamente CRLF/LF.
**No hay una migración nueva que aplicar para esta entrega.**

La revisión detectó dos tablas productivas ausentes del esquema local:
`SocialPost` y `SocialPostMetric`. Una sincronización habría propuesto borrarlas.
Se recuperaron sus modelos y relaciones, y el SQL histórico de
`20260910_social_publishing` desde `c0d251e`, idéntico al checksum registrado en
producción. También se conservó el default existente de
`ApnsDeviceInstallation.updatedAt`. Estos son cambios de representación local;
no se ejecutó DDL en producción. La comparación final devuelve migración vacía.

Durante el despliegue:

1. No ejecutar `db push`, `migrate dev`, `migrate reset`, seeds, truncados ni SQL
   histórico a mano. No ejecutar `configure-whatsapp.mjs` como inicialización
   indiscriminada de una producción ya configurada.
2. Conservar la base actual, usuarios, clientes, facturas, configuraciones,
   sesión de WhatsApp y claves de cifrado. No importar la base o autenticación
   de staging sobre producción.
3. `postinstall` solo genera Prisma Client; no aplica migraciones ni hace seed.
4. Ejecutar la barrera de solo lectura antes de publicar, con el hostname
   directo esperado (sin contraseña):

```powershell
node scripts/check-whatsapp-release.mjs '<CARPETA_PRIVADA_DEL_RESPALDO>' '<HOSTNAME_DIRECTO_ESPERADO>' 'neondb'
```

Esta barrera comprueba identidad/TLS, integridad y restauración del respaldo,
antigüedad menor de 24 h, historial/checksums, ausencia de diferencias de esquema,
sesión existente y pausa productiva. Cualquier fallo detiene el procedimiento.

## Publicación gradual, pendiente de ejecución

1. Guardar la configuración remota actual y volver a comprobar la versión
   productiva. Renovar y verificar el respaldo si hubo cambios desde esta muestra.
2. Configurar por canal seguro los secretos nuevos de WhatsApp. La inspección
   de nombres de variables de Vercel encontró pendientes `WA_HEALTH_URL`,
   `WA_HEALTH_TOKEN` y `WA_WORKER_SECRET`. El token del worker debe coincidir con
   el backend, tener al menos 32 caracteres y ser distinto de staging.
   El worker también necesita `APP_API_URL` y la clave de cifrado productiva
   existente, sin regenerarla. No pegar secretos en Git ni en esta documentación.
3. Identificar la aplicación worker de producción y conservar cualquier servicio
   existente antes de cambiar su configuración. No sustituir staging por accidente.
   Hostinger requiere el paquete completo con `src/`, `prisma/` y `worker/`;
   construir con Node 22 y `build:wa:hostinger`.
4. Publicar primero la web y el worker con `WA_DISABLED=1`, `WA_PAIRING_ONLY=1`,
   `WA_TEST_GROUP_ONLY=0`, `SRI_ENABLED=0`. Conservar `whatsapp.paused=true`,
   `clientsEnabled=false`, AUTO apagado y los grupos de clientes deshabilitados.
   Mantener crons de envío deshabilitados. No se necesita resetear la sesión.
5. Verificar login, usuarios/clientes/facturas existentes, panel ADMIN,
   autenticación del puente y salud del worker. La sesión y configuración deben
   conservarse. Una salud correcta en modo desactivado no demuestra envío real.
6. Completar las pruebas funcionales en un entorno/grupo autorizado: cola normal,
   aprobaciones y recordatorios. La E2E ya observada en staging demuestra solo
   transporte real y deduplicación de un acuse; no valida esos flujos ni el
   descubrimiento automático. No habilitar grupos de clientes como parte de esa
   prueba. La activación se mantiene separada del despliegue pausado.
7. SRI permanece apagado hasta validar facturas reales en el ambiente de pruebas
   del SRI. La excepción temporal de `node-forge` no equivale a esa validación.

## Recuperación si falla la publicación

Publicar el candidato local no integra la rama en `main`. Un despliegue automático
posterior desde `main` puede volver a sustituir el código del candidato. Antes
de ese próximo despliegue, coordinar la integración y revisión de la rama; no
se cambia ni desactiva aquí el pipeline existente.

- Detener el worker nuevo y conservar la pausa antes de cualquier recuperación,
  evitando envíos y reintentos paralelos. No borrar filas de auth o locks para
  forzar el arranque.
- Volver la web al despliegue Vercel anterior identificado arriba, verificando
  primero que sigue siendo la referencia correcta. No reescribir `main` ni hacer
  force push. Conservar el código y configuración anterior del worker.
- Como esta entrega no cambia el esquema productivo, la recuperación habitual
  consiste en volver el código; **no restaurar la base encima de la base viva**.
  Así se conservan escrituras que hayan llegado después del respaldo.
- Si el incidente afecta datos, restaurar en una base nueva y aislada, comparar
  y decidir la recuperación o el cambio de conexión con el dueño. No reemplazar
  toda la base sin contemplar las escrituras posteriores a la instantánea.

## Verificación local del candidato

Resultados y logs se guardan en la carpeta privada del respaldo. La integración
usa únicamente `totem_whatsapp_release_test` en PostgreSQL local; nunca `neondb`.
La revisión de seguridad de los scripts fue independiente y corrigió el guard
que podía aceptar un directorio interno cuyo nombre comenzara con `..`.

- Unitarias: 229/229, incluido el rechazo real de destinos internos de backup.
- Integración: 38/38 en una base local creada para esta entrega.
- Worker: build WhatsApp y comprobación de tipos correctos.
- Tipos y build web: PASS; 69 rutas generadas, usando solo base local y valores
  sintéticos de Pusher. Lint: PASS, con 14 advertencias existentes de imágenes.
- Comparación productiva de esquema: vacía; barrera de base de datos: PASS.
- No se afirma estabilidad de 48/72 h ni aceptación de facturas por el SRI.
