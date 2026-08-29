# CP13 — Resolución de conflictos

`SyncConflictResolver` compara tres snapshots: base confirmada, edición local y
versión del servidor. Un campo cambiado sólo por un lado se integra
automáticamente; si ambos lados lo cambiaron a valores distintos, el nombre del
campo queda en `unresolvedFields` para que la UI pida una decisión explícita.

La eliminación se trata como una dimensión adicional (`__deleted`). Un
delete-vs-edit queda visible y puede resolverse eligiendo local o servidor; no se
descarta ninguna edición de forma silenciosa.

`ConflictResolverTests` cubre merge no superpuesto, campo superpuesto,
delete-vs-edit y cambios idénticos en ambos dispositivos.
