"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import type { Credential } from "@prisma/client";
import { deleteCredentialGroup, saveCredentialGroup } from "@/actions/client-actions";
import { useRedirectOnAuthError } from "@/hooks/use-redirect-on-auth-error";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { VaultGroupCard } from "./vault-group-card";
import { VaultGroupForm } from "./vault-group-form";
import type { VaultCredentialGroup, VaultGroupFormValues } from "./vault-types";
import { groupVaultCredentials } from "./vault-utils";

interface VaultListProps {
  credentials: Credential[];
  clientId: string;
}

export function VaultList({ credentials, clientId }: VaultListProps) {
  const router = useRouter();
  const { toast } = useToast();
  const handleAuthError = useRedirectOnAuthError();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [deletingGroupId, setDeletingGroupId] = useState<string | null>(null);

  const groupedCredentials = useMemo(
    () => groupVaultCredentials(credentials, clientId),
    [clientId, credentials]
  );

  const handleSaveGroup = async (values: VaultGroupFormValues, groupId?: string) => {
    setIsSubmitting(true);
    if (groupId) {
      setActiveGroupId(groupId);
    }

    try {
      const result = await saveCredentialGroup(values);

      if (result.success) {
        toast({
          title: groupId ? "Credenciales actualizadas" : "Credenciales agregadas",
          description: groupId
            ? "El grupo de credenciales ha sido actualizado exitosamente."
            : "Las credenciales han sido guardadas exitosamente.",
        });
        setIsCreateOpen(false);
        router.refresh();
      } else {
        if (handleAuthError(result)) {
          toast({
            variant: "destructive",
            title: "Sesión expirada",
            description: "Tu sesión ha expirado. Serás redirigido al login.",
          });
          return;
        }

        toast({
          variant: "destructive",
          title: groupId ? "Error al actualizar credenciales" : "Error al agregar credenciales",
          description: result.error || "Ocurrió un error inesperado",
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: groupId ? "Error al actualizar credenciales" : "Error al agregar credenciales",
        description:
          error instanceof Error
            ? error.message
            : "Ocurrió un error inesperado",
      });
    } finally {
      setIsSubmitting(false);
      setActiveGroupId(null);
    }
  };

  const handleCopy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: "Copiado",
        description: `${label} copiado al portapapeles`,
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error al copiar",
        description: "No se pudo copiar al portapapeles",
      });
    }
  };

  const handleDeleteGroup = async (group: VaultCredentialGroup) => {
    setDeletingGroupId(group.id);
    try {
      const result = await deleteCredentialGroup({
        clientId,
        credentialIds: group.credentials.map((credential) => credential.id),
      });

      if (result.success) {
        toast({
          title: "Grupo eliminado",
          description: "Las credenciales del grupo han sido eliminadas exitosamente.",
        });
        router.refresh();
      } else {
        toast({
          variant: "destructive",
          title: "Error al eliminar grupo",
          description: result.error || "Ocurrió un error inesperado",
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error al eliminar grupo",
        description:
          error instanceof Error
            ? error.message
            : "Ocurrió un error inesperado",
      });
    } finally {
      setDeletingGroupId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <h2 className="text-xl font-semibold">Bóveda de Credenciales</h2>
        <Button onClick={() => setIsCreateOpen((prev) => !prev)}>
          <Plus className="h-4 w-4" />
          {isCreateOpen ? "Cerrar formulario" : "Agregar Credenciales"}
        </Button>
      </div>

      {isCreateOpen ? (
        <VaultGroupForm
          clientId={clientId}
          isSubmitting={isSubmitting && activeGroupId === null}
          submitLabel="Guardar credenciales"
          onCancel={() => setIsCreateOpen(false)}
          onSubmit={(values) => handleSaveGroup(values)}
        />
      ) : null}

      {groupedCredentials.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground text-center text-lg">
              No hay credenciales guardadas
            </p>
            <p className="text-muted-foreground mt-2 text-center text-sm">
              Agrega tu primera credencial para comenzar
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {groupedCredentials.map((group) => (
            <VaultGroupCard
              key={group.id}
              group={group}
              isSaving={isSubmitting && activeGroupId === group.id}
              isDeleting={deletingGroupId === group.id}
              onCopy={handleCopy}
              onSave={(values) => handleSaveGroup(values, group.id)}
              onDelete={handleDeleteGroup}
            />
          ))}
        </div>
      )}
    </div>
  );
}
