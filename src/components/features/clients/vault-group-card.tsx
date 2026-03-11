"use client";

import { useState } from "react";
import { Copy, ExternalLink, Eye, EyeOff, Pencil, Trash2, ChevronDown } from "lucide-react";
import type { CredentialService } from "@/schemas/client";
import type { VaultCredentialGroup, VaultGroupFormValues } from "./vault-types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { VaultGroupForm } from "./vault-group-form";

type VaultGroupCardProps = {
  group: VaultCredentialGroup;
  isSaving: boolean;
  isDeleting: boolean;
  onCopy: (text: string, label: string) => Promise<void>;
  onSave: (values: VaultGroupFormValues) => Promise<void>;
  onDelete: (group: VaultCredentialGroup) => Promise<void>;
};

export function VaultGroupCard({
  group,
  isSaving,
  isDeleting,
  onCopy,
  onSave,
  onDelete,
}: VaultGroupCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const initialValues: VaultGroupFormValues = {
    services: group.services,
    username: group.username,
    password: group.password,
    url: group.url,
    clientId: group.clientId,
    existingCredentials: group.credentials.map((credential) => ({
      id: credential.id,
      service: credential.service as CredentialService,
    })),
  };

  return (
    <Card className="rounded-3xl">
      <CardHeader className="gap-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {group.services.map((service) => (
                <Badge key={service} variant="secondary" className="rounded-full px-3 py-1 text-xs">
                  {service}
                </Badge>
              ))}
            </div>
            <div className="space-y-1">
              <CardTitle className="text-lg">{group.username}</CardTitle>
              {group.url ? (
                <a
                  href={group.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Abrir URL
                </a>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => setIsEditing((prev) => !prev)}>
              <Pencil className="h-4 w-4" />
              {isEditing ? "Cerrar edición" : "Editar"}
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" className="text-destructive hover:text-destructive">
                  <Trash2 className="h-4 w-4" />
                  Eliminar
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>¿Eliminar grupo de credenciales?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Se eliminarán de forma permanente las credenciales de {group.services.join(", ")}.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => onDelete(group)}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    disabled={isDeleting}
                  >
                    Eliminar
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_auto_auto] md:items-center">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-muted-foreground">Usuario:</span>
            <span className="truncate text-sm">{group.username}</span>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onCopy(group.username, "Usuario")}>
            <Copy className="h-4 w-4" />
          </Button>
          <div />
        </div>

        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <span className="text-sm font-medium text-muted-foreground">Contraseña:</span>
          <div className="flex flex-1 items-center gap-2">
            <Input type={showPassword ? "text" : "password"} value={group.password} readOnly className="flex-1" />
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowPassword((prev) => !prev)}>
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onCopy(group.password, "Contraseña")}>
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-between rounded-2xl border border-dashed">
              <span>Ver cuentas incluidas ({group.credentials.length})</span>
              <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`} />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-2 pt-3">
            {group.credentials.map((credential) => (
              <div
                key={credential.id}
                className="flex items-center justify-between rounded-2xl border px-3 py-3 text-sm"
              >
                <div className="flex flex-col">
                  <span className="font-medium">{credential.service}</span>
                  <span className="text-muted-foreground">{credential.username}</span>
                </div>
                {credential.url ? (
                  <a
                    href={credential.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-primary hover:underline"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    URL
                  </a>
                ) : null}
              </div>
            ))}
          </CollapsibleContent>
        </Collapsible>

        {isEditing ? (
          <VaultGroupForm
            clientId={group.clientId}
            initialValues={initialValues}
            isSubmitting={isSaving}
            submitLabel="Guardar cambios"
            onCancel={() => setIsEditing(false)}
            onSubmit={async (values) => {
              await onSave(values);
              setIsEditing(false);
            }}
          />
        ) : null}
      </CardContent>
    </Card>
  );
}
