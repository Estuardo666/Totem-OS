# CP14 — Caché local de archivos

`LocalFileCache` mantiene binarios en `Library/Caches/TotemOS/Files`, fuera de
SwiftData y del outbox. El índice guarda tamaño y `lastAccessAt`; al superar el
límite se eliminan primero los elementos menos usados. El límite de producción
es 250 MiB y las pruebas usan uno menor para validar eviction determinista.

La API diferencia originales y thumbnails, permite limpieza manual y marca
archivos e índice con `isExcludedFromBackup`. `BackgroundFileUploadQueue` usa
una `URLSessionConfiguration.background` para que una subida pueda continuar al
salir la app; limpiar la caché nunca elimina las mutaciones estructuradas.
