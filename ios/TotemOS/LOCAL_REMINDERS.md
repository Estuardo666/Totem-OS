# Notificaciones locales

La app solicita alertas y sonido después de autenticar al usuario, también en
DebugFree (`TOTEM_NO_PUSH`). No requiere APNs para estos recordatorios.

`LocalReminderScheduler` obtiene `/api/v1/local-reminders`: una instantánea de
los próximos 60 rodajes SCHEDULED cuyo equipo incluye al usuario autenticado
(el dispositivo programa hasta 54 para reservar espacio al resumen y actividad).
El endpoint usa la protección y capacidad `notifications.self` existentes.
La consulta al servidor sincroniza la agenda; la entrega del aviso es local.

También devuelve asignaciones desde las notificaciones del usuario, publicaciones
de tareas (todas para ADMIN; propias para los demás) y transacciones creadas o
modificadas. Finanzas usa las capacidades existentes: `finance.strategic.read`
permite movimientos generales; `finance.personal.read` permite únicamente gastos
asignados al usuario y honorarios cuyo destinatario sea el usuario. Sin esas
capacidades no se consultan transacciones.

La primera sincronización establece una base sin inundar con avisos históricos.
Las siguientes consultan cambios desde un cursor persistido, hasta siete días
atrás. Los avisos se agrupan por categoría y se deduplican en el dispositivo.
Se reserva espacio en la cola para cinco categorías y el resumen diario.

El resumen de tareas propias pendientes se repite a las 08:00 en la zona
America/Guayaquil. Incluye hasta tres títulos y la fecha de última sincronización:
el contenido queda actualizado al sincronizar, no mediante ejecución en segundo
plano a las 08:00. Por ello puede mostrarse sin red o con la app cerrada.
Las nuevas asignaciones, publicaciones y movimientos necesitan una sincronización
con la app abierta. La entrega inmediata de cambios con la app cerrada requiere
push remoto y no puede garantizarse mediante notificaciones locales.

Cada aviso tiene título «Próximo rodaje · Totem OS», nombre del rodaje y sonido
predeterminado. Se programa una hora antes; si esa hora pasó pero el rodaje
todavía no empezó, se programa cinco segundos después. Se incluyen segundos
y zona horaria explícita para conservar el instante del evento.

La sincronización ocurre junto al shell (navegación y refresco cada minuto)
y al volver al primer plano. Reemplaza cambios de título/fecha, elimina
cancelados o desasignados y evita volver a programar avisos ya entregados.
Cerrar sesión elimina los avisos locales de Totem. Un fallo de red conserva
los avisos pendientes. Una edición hecha desde otro dispositivo necesita una
sincronización con la app abierta para actualizar los avisos ya programados.

## Validación en un iPhone

1. Desplegar el endpoint y generar el proyecto con XcodeGen como de costumbre.
2. Compilar la variante sin push, iniciar sesión y aceptar notificaciones.
3. Asignarse un rodaje dentro de 30 minutos; esperar la sincronización y luego
   cerrar la app y desconectar la red. El aviso debe aparecer cinco segundos
   después de su programación, con el nombre y sonido del rodaje.
4. Abrir y refrescar varias veces: no debe repetirse el mismo aviso.
5. Con red, cambiar fecha/título y verificar la sustitución; cancelar el rodaje
   o quitarse del equipo y verificar que desaparece de las solicitudes pendientes.
6. Programar otro rodaje y cerrar sesión: no deben quedar recordatorios de la cuenta.
7. Repetir con permiso denegado y luego activado desde Ajustes de iOS.
8. Tras una primera sincronización, asignar una tarea, publicar otra y crear o
   actualizar ingreso/gasto/honorarios; sincronizar y verificar avisos sin duplicados.
9. Repetir con ADMIN, EDITOR y USER: comprobar que no aparecen datos financieros
   de terceros ni transacciones para cuentas sin capacidad de finanzas.
10. Revisar el disparador diario a las 08:00 Ecuador y el texto con fecha de
    sincronización; cerrar sesión y comprobar que también se elimina el resumen.

Windows permite comprobar TypeScript, pero la compilación Swift y la entrega
real requieren Xcode y un simulador o iPhone.
