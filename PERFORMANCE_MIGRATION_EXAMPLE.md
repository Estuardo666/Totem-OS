/**
 * EJEMPLO: Cómo migrar tus componentes existentes a usar lazy loading
 * Copia y adapta estos patrones a tus modales y componentes pesados
 */

// ============================================================================
// PASO 1: Crear un archivo de lazy wrappers para tu feature
// ============================================================================

// Archivo: src/components/features/clients/lazy-client-dialogs.tsx
import { lazy, Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";

const LazyCreateClientDialog = lazy(() =>
  import("./create-client-dialog").then((m) => ({
    default: m.CreateClientDialog,
  }))
);

const LazyEditClientDialog = lazy(() =>
  import("./edit-client-dialog").then((m) => ({
    default: m.EditClientDialog,
  }))
);

// Fallback component
const DialogFallback = () => (
  <div className="space-y-4 p-6">
    <Skeleton className="h-10 w-3/4" />
    <Skeleton className="h-10 w-full" />
    <Skeleton className="h-10 w-full" />
  </div>
);

// Wrappers
interface LazyCreateClientDialogWrapperProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (client: any) => void;
}

export function LazyCreateClientDialogWrapper({
  open,
  onOpenChange,
  onCreated,
}: LazyCreateClientDialogWrapperProps) {
  if (!open) return null;
  return (
    <Suspense fallback={<DialogFallback />}>
      <LazyCreateClientDialog open={open} onOpenChange={onOpenChange} onCreated={onCreated} />
    </Suspense>
  );
}

interface LazyEditClientDialogWrapperProps {
  client: any | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated?: (client: any) => void;
}

export function LazyEditClientDialogWrapper({
  client,
  open,
  onOpenChange,
  onUpdated,
}: LazyEditClientDialogWrapperProps) {
  if (!open || !client) return null;
  return (
    <Suspense fallback={<DialogFallback />}>
      <LazyEditClientDialog client={client} open={open} onOpenChange={onOpenChange} onUpdated={onUpdated} />
    </Suspense>
  );
}

// ============================================================================
// PASO 2: Usar los wrappers en tu vista
// ============================================================================

// Archivo: src/components/features/clients/clients-view.tsx
import { useState } from "react";
import { LazyCreateClientDialogWrapper, LazyEditClientDialogWrapper } from "./lazy-client-dialogs";

export function ClientsView({ clients: initialClients }) {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState(null);

  const handleEdit = (client) => {
    setSelectedClient(client);
    setIsEditOpen(true);
  };

  return (
    <>
      {/* Header con botón "Nuevo Cliente" */}
      <button onClick={() => setIsCreateOpen(true)}>Nuevo Cliente</button>

      {/* Tabla/lista de clientes */}
      <ClientsList clients={initialClients} onEdit={handleEdit} />

      {/* Los diálogos se cargan SOLO cuando se abren */}
      <LazyCreateClientDialogWrapper
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        onCreated={(client) => {
          // Actualizar lista, cerrar diálogo, etc.
        }}
      />

      <LazyEditClientDialogWrapper
        client={selectedClient}
        open={isEditOpen}
        onOpenChange={setIsEditOpen}
        onUpdated={(client) => {
          // Actualizar lista, cerrar diálogo, etc.
        }}
      />
    </>
  );
}

// ============================================================================
// PASO 3: Optimizar listas con memoización
// ============================================================================

// Archivo: src/components/features/clients/client-row.tsx
import React from "react";
import { OptimizedAvatar } from "@/components/ui/optimized-avatar";

interface ClientRowProps {
  client: any;
  isSelected: boolean;
  onSelect: (client: any) => void;
  onDelete: (clientId: string) => void;
}

/**
 * Componente de fila MEMOIZADO
 * Solo re-renderiza si el cliente específico cambia
 */
export const ClientRow = React.memo(
  ({ client, isSelected, onSelect, onDelete }: ClientRowProps) => {
    return (
      <tr className={isSelected ? "bg-blue-50" : ""}>
        <td className="p-4">
          <OptimizedAvatar
            src={client.logo}
            alt={client.name}
            fallback={client.name.slice(0, 2).toUpperCase()}
            size="md"
          />
        </td>
        <td className="p-4">{client.name}</td>
        <td className="p-4">{client.status}</td>
        <td className="p-4">
          <button onClick={() => onSelect(client)}>Editar</button>
          <button onClick={() => onDelete(client.id)}>Eliminar</button>
        </td>
      </tr>
    );
  },
  (prevProps, nextProps) => {
    // Retorna true si son iguales (no re-render)
    return (
      prevProps.client.id === nextProps.client.id &&
      prevProps.isSelected === nextProps.isSelected
    );
  }
);

ClientRow.displayName = "ClientRow";

// Uso en tabla:
function ClientsTable({ clients, onEdit, onDelete }) {
  return (
    <table>
      <tbody>
        {clients.map((client) => (
          <ClientRow
            key={client.id}
            client={client}
            isSelected={false}
            onSelect={onEdit}
            onDelete={onDelete}
          />
        ))}
      </tbody>
    </table>
  );
}

// ============================================================================
// PASO 4: Reemplazar Avatares normales por OptimizedAvatar
// ============================================================================

// ANTES:
//import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
//<Avatar>
//  <AvatarImage src={client.logo} alt={client.name} />
//  <AvatarFallback>{initials}</AvatarFallback>
//</Avatar>

// DESPUÉS:
import { OptimizedAvatar } from "@/components/ui/optimized-avatar";

<OptimizedAvatar
  src={client.logo}
  alt={client.name}
  fallback={initials}
  size="md"
  priority={false} // true solo para logos above-the-fold
/>;

// ============================================================================
// RESUMEN: Pasos para aplicar a otros componentes
// ============================================================================

/**
 * 1. Crea lazy-{feature}-dialogs.tsx con:
 *    - lazy imports de tus diálogos
 *    - Wrappers con Suspense + fallback
 *
 * 2. En tu vista principal:
 *    - Reemplaza imports directos por lazy wrappers
 *    - Usa condicional `{isOpen && <LazyWrapper />}`
 *
 * 3. Para listas:
 *    - Envuelve componentes de fila con React.memo
 *    - Implementa comparador de props personalizado
 *    - Usa useCallback para funciones pasadas como props
 *
 * 4. Para imágenes:
 *    - Reemplaza AvatarImage por OptimizedAvatar
 *    - Usa priority={true} solo para imágenes importantes
 *
 * Puedes aplicar este patrón a:
 * - ✅ clients/ (create, edit, delete dialogs)
 * - ✅ content/ (create task, edit content dialogs)
 * - ✅ finance/ (create settlement, reports)
 * - ✅ users/ (edit user, assign roles)
 * - ✅ admin/ (settings, configuration)
 */
