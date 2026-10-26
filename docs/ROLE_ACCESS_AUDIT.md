# Análisis de roles y aislamiento del editor

Fecha: 25 de octubre de 2026.

Estado: remediación implementada en el código local. Los hallazgos de la tabla documentan el estado anterior a la reparación; sus referencias de línea son históricas. No se modificaron datos reales ni se desplegaron cambios en producción.

## Conclusión

La auditoría inicial detectó que el editor no estaba aislado: varias acciones omitían autenticación, rol, alcance del recurso y proyecciones seguras. Se añadieron controles compartidos del servidor para identidad vigente, capacidades, clientes/tareas asignados, campos y transiciones. Las pruebas cubren ADMIN, EDITOR, USER y sesiones anónimas.

## Hallazgos prioritarios

| Prioridad | Evidencia | Consecuencia | Corrección necesaria |
| --- | --- | --- | --- |
| Crítica | `src/actions/user.actions.ts:57` y `:89`: createUser y updateUser no verifican sesión ni ADMIN. `src/schemas/user.ts` admite roleCode/roleLegacy ADMIN, password y baseSalary. | La función permite crear o modificar usuarios y elevar privilegios sin autorización propia. updateUserAdmin tiene controles, pero no protege la función alternativa. | Exigir administrador vigente antes de consultar o escribir; restringir campos; separar actualización propia de administración; no retornar password. |
| Crítica | `src/actions/user.actions.ts:304`: getUsers solo comprueba sesión y usa findMany con include, sin select de campos. `src/app/content/page.tsx` pasa el resultado al componente cliente. | Retorna todos los campos escalares de usuarios, incluidos hashes de contraseñas, información salarial y bancaria cuando existen. | Catálogo operativo con id, nombre, imagen y especialidad; datos administrativos en una consulta separada exclusiva de ADMIN. |
| Crítica | `src/actions/client-actions.ts:800`: getClientById consulta por id sin autenticación y carga todas las tareas y credentials. | No valida asignación del editor ni permiso de lectura de credenciales; retorna también todos los campos escalares del cliente. | Autenticar, comprobar relación con cliente, filtrar tareas y usar select explícito. Credenciales fuera de la respuesta operativa. |
| Crítica | `src/actions/client-actions.ts:1141`: getClientByShareToken incluye credentials y devuelve el objeto completo. `:1106`: generateShareToken no comprueba identidad o rol. | La respuesta del recurso compartido contiene secretos; la generación del enlace carece de autorización propia. No se verificó si la página pública renderiza todos esos campos. | DTO público exclusivo de reporte, sin credenciales ni tokens internos; emisión y rotación del enlace autorizadas por servidor. |
| Alta | `src/actions/content-actions.ts:517`, `:799`, `:1099`: updateTaskStatus, updateTask y quickPublishTask no rechazan por rol o asignación; auth se usa para notificaciones o auditoría. | Puede actualizarse una tarea ajena y marcarla publicada; se omiten límites de campos y transiciones por rol. `/api/content/tasks/status` solo comprueba sesión antes de delegar en esta acción. | Verificar capacidad y asignación antes de leer/escribir; definir campos y transiciones permitidas; proteger también efectos financieros derivados. |
| Alta | `src/actions/content-actions.ts:213`, `:235`: createTask y createTasksBatch no autorizan antes de persistTask. | Creación sobre clientes y asignaciones proporcionados sin comprobar alcance. | Autorizar creación, cliente, responsables y estado inicial; repetir la comprobación por elemento del lote. |
| Alta | `src/actions/content-actions.ts:1689`, `:1751`, `:1794`: duplicateTask, updateTaskClient y updateTaskNotes solo exigen sesión. | Un usuario autenticado puede operar sobre tareas por id sin verificar si le pertenecen; puede cambiar el cliente asociado. | Comprobar recurso y capacidad; reservar cambio de cliente/reasignación a administración. |
| Alta | `src/actions/client-actions.ts:612`: getClients devuelve el catálogo sin where de asignación, con campos escalares completos y datos de tareas/rodajes. | El editor recibe información de clientes ajenos y datos comerciales aunque no se muestren en pantalla. | Filtrar clientes accesibles y relaciones incluidas; separar datos comerciales de los operativos. |
| Alta | `src/actions/content-actions.ts:328`: getTasks limita EDITOR, pero USER y ausencia de sesión terminan en el filtro general. | El rol inferior y las sesiones sin identidad no quedan restringidos por la propia acción. | Denegar sin identidad o rol reconocido; aplicar alcance también a USER. |
| Alta | `src/auth.ts:207`: si la consulta no devuelve usuario/rol válido o falla la BD, se conserva el rol del token. | La revocación o eliminación del usuario puede no retirar privilegios mientras persista ese token. | Para operaciones protegidas, consultar identidad/rol vigentes y fallar cerrado si no pueden verificarse. Definir invalidación de sesiones. |

## Política aplicada

Se retiraron clients.write, shoots.write y meta.write de EDITOR. content.write solo autoriza campos de trabajo en tareas asignadas y etapas editables. Las creaciones, duplicaciones, reasignaciones, publicación, aprobaciones, métricas globales e integraciones se reservan a ADMIN. USER conserva lectura dentro de su asignación, sin escrituras de contenido ni acceso financiero.

| Recurso o acción | ADMIN | EDITOR | USER |
| --- | --- | --- | --- |
| Clientes y materiales operativos | Todos | Solo clientes asignados o vinculados a tareas asignadas, con campos mínimos | Solo alcance explícitamente concedido |
| Lectura de tareas | Todas | Solo tareas asignadas como editor/community | Solo alcance explícitamente concedido |
| Edición de tareas | Completa según flujo | postCopy, scriptUrl, coverImageUrl y audioBriefUrl de tareas asignadas; transiciones de edición | Bloqueada por defecto |
| Crear tareas y rodajes | Permitido | Bloqueado | Bloqueado |
| Aprobar por cliente o publicar | Según flujo | Bloqueado por defecto; requiere permiso específico distinto de editar | Bloqueado |
| Reasignar, cambiar cliente, eliminar | Permitido | Bloqueado | Bloqueado |
| Contraseñas y credenciales de clientes | Permiso específico y respuesta separada | Bloqueado por defecto | Bloqueado |
| Directorio del equipo | Datos mínimos; administración separada | Nombre, imagen y especialidad cuando sea necesario | Datos mínimos cuando sea necesario |
| Finanzas | Administración autorizada | Solo información propia; sin tarifas de clientes, sueldos ajenos o finanzas globales | Bloqueado salvo acceso propio explícito |
| Usuarios, roles, configuración, facturación | Permitido | Bloqueado | Bloqueado |
| Integraciones y publicación social | Administración autorizada | Sin gestión de tokens; operaciones específicas solo con permiso y alcance | Bloqueado |
| Preferencias y notificaciones | Propias; administración separada | Solo propias | Solo propias |

La especialidad editor/community no debe convertirse implícitamente en permiso de aprobar, publicar o gestionar integraciones. Si se necesita esa distinción, debe expresarse como capacidad adicional.

## Controles existentes útiles

- `roles.ts` define ADMIN, EDITOR y USER y una matriz de capacidades. EDITOR no tiene credentials.read, content.delete, admin.users ni finance.irreversible.
- El middleware restringe /admin a ADMIN, pero no sustituye la autorización de cada acción y excluye las API de su matcher.
- deleteTask exige ADMIN.
- getTasks filtra tareas asignadas para sesiones EDITOR válidas.
- getStrategicClientAnalyticsPlans y getStrategicClientPlans exigen ADMIN.
- Algunas rutas v1, como dashboard, usan withApiProtection con requiredCapability. Esta protección no se aplica automáticamente a las Server Actions revisadas.

## Orden de implementación

1. Cerrar elevación de privilegios y respuestas con hashes, datos bancarios y credenciales, incluidos reportes públicos.
2. Introducir autorización compartida de servidor: identidad vigente, capacidad, alcance del recurso y selección de campos. Denegar por defecto.
3. Aplicar la misma política a acciones, API, páginas, lotes y herramientas de asistentes que ejecuten las mismas operaciones.
4. Definir y aplicar transiciones y campos editables; proteger publicación, reasignaciones y cambios con efectos financieros.
5. Alinear menús y botones con la política del servidor y revisar notificaciones, tiempo real, archivos y cachés para evitar filtraciones indirectas.

## Reparaciones adicionales

- Las acciones financieras generales exigen ADMIN. El editor conserva proyecciones financieras propias y creación de gastos propios: el servidor fija el pagador, impide ingresos/honorarios y no acepta reembolsos o nóminas autoaprobados. Los filtros de estadísticas no pueden suplantar otro userId.
- Los reportes públicos devuelven únicamente identidad visual del cliente; las consultas del reporte, vistas y aprobaciones requieren el token ligado a ese cliente. Un id aislado o un objeto usado como filtro de Prisma no autorizan acceso.
- Se separaron los servicios internos de notificaciones y push de las Server Actions públicas. Los envíos manuales requieren ADMIN; cron y operaciones ya autorizadas siguen usando servicios internos. Solo se pueden marcar leídas las notificaciones de la cuenta actual.
- Pusher usa private-user-ID para notificaciones y private-content para señales sin datos. La firma de suscripción exige sesión vigente y rechaza canales de otros usuarios. Los eventos compartidos ya no transmiten tareas, ids, estados ni tokens.
- Se filtraron clientes, tareas, rodajes, estrategias, agregados y calendarios. Los tokens de revisión se excluyen de las respuestas operativas. El asistente de usuarios no administradores conserva consultas de tareas y gastos propios, sin herramientas administrativas.
- Se alinearon formularios, menús, arrastre del tablero y creación de tareas con la política. El editor puede enviar RECORDED → EDITING y EDITING → REVIEW_CLIENT, o devolver una revisión/rechazo a EDITING; no puede publicar ni representar la aprobación del cliente.
- Las escrituras editoriales incluyen la asignación y el estado autorizado en el filtro de actualización, para rechazar reasignaciones o cambios de etapa concurrentes.

- Se retiró `use server` de los servicios internos de finanzas e IA: sus funciones ya no se registran como acciones HTTP alternativas a las acciones autorizadas. Las consultas detalladas de rodajes incluyen su alcance en la propia lectura.

## Verificación

`tests/unit/role-access-actions.test.mjs` ejecuta acciones y controles reales con dependencias de framework y base de datos simuladas. Comprueba denegación sin efectos, escalada de rol, tareas ajenas, campos prohibidos, filtros manipulados, proyecciones sin secretos, hash de contraseñas nuevas, editor funcional, carreras de asignación, rol revocado, cuenta eliminada, BD caída, enlaces compartidos y canales privados.

La validación final se registra en el mensaje de entrega: suite unitaria, TypeScript, ESLint y compilación de producción. No se ejecutaron pruebas contra una base real ni recorridos autenticados en navegador. No se corrieron integraciones que reinicializan la base de pruebas. Esta remediación no constituye una certificación exhaustiva de todas las integraciones y servicios externos.

No se requiere migración de base de datos. Para aplicar los cambios hace falta desplegar el código y recargar los clientes abiertos para usar los canales privados. No se rotaron enlaces o credenciales existentes ni se limpiaron datos ya guardados por clientes antiguos.
