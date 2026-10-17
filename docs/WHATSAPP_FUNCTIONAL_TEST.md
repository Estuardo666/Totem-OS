# Prueba funcional controlada

Estado: preparación local completada; sesión nueva pendiente de QR. Producción permanece desactivada.

Verificación: 234/234 unitarias y 39/39 integración. El nuevo ensayo usa PostgreSQL local `message_worker_functional_test`, grupo existente seleccionado explícitamente, cliente/tarea sintéticos y una sesión WhatsApp nueva. No se copiaron credenciales productivas. El worker rechaza producción, limita la cola al grupo/ejecución y solo acepta respuestas exactas citando la solicitud sintética. Sin sincronización general, IA, resúmenes, cobros, avisos privados ni SRI. La cola real se probó con transporte simulado; todavía no se afirma entrega funcional real.

Página local: `http://127.0.0.1:3091/`. Al escanear el QR, llega un único mensaje al grupo de pruebas; citarlo y responder `aprobado`. El controlador aplica la aprobación ficticia y espera una sola confirmación. Al terminar pausa la base local y detiene esa sesión de worker. La autenticación nueva queda en la base local para repetir el ensayo; no cambia la sesión almacenada en producción.

La configuración y el controlador del ensayo están fuera de Git, en el respaldo privado. El QR se sirve mediante proxy local sin entregar el token de salud al navegador. No publicar esa página ni sus credenciales.

La E2E anterior confirmó transporte y deduplicación de un acuse. El modo WA_TEST_GROUP_ONLY actual omite la cola y automatizaciones, por lo que no demuestra aprobación funcional. La ruta normal puede enviar avisos privados al equipo y dueño cuando se quita la pausa; clientsEnabled=false por sí solo no aísla todo el tráfico.

Antes de probar: limitar recepción y emisión al JID del grupo existente de pruebas; permitir solo los registros creados para el ensayo; deshabilitar sincronización general, resúmenes, cobros, recordatorios, promociones AUTO y avisos ajenos al ensayo. Usar una base separada con datos sintéticos; no reasignar grupos o tareas reales de producción. Mantener SRI_ENABLED=0.

Secuencia de aceptación:

1. Cola normal: encolar un mensaje identificado de prueba y comprobar una sola entrega visible.
2. Aprobar un contenido sintético desde el panel: cambia solo la tarea sintética y entrega una confirmación.
3. Repetir la aprobación y el evento: no repetir el cambio ni el mensaje.
4. Rechazar otro borrador: no modifica la tarea.
5. Pausar: no sale ningún mensaje posterior.
6. Reiniciar: conserva autenticación, no duplica envíos y sigue limitado al ensayo.

Intervención del dueño al final: observar y responder al mensaje indicado en el grupo existente; no necesita crear otro grupo. Se solicitará únicamente cuando el aislamiento y las pruebas locales estén listos.
