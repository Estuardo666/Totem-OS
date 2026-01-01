"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import {
  updateClientSchema,
  type UpdateClientInput,
} from "@/schemas/client";
import type { Client } from "@prisma/client";
import { updateClient } from "@/actions/client-actions";
import { useToast } from "@/components/ui/use-toast";
import { ShareReportButton } from "./share-report-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ColorPicker } from "./color-picker";
import type { User } from "@prisma/client";

interface EditClientDialogProps {
  client: Client;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  users: User[];
}

export function EditClientDialog({
  client,
  open,
  onOpenChange,
  users,
}: EditClientDialogProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [currentShareToken, setCurrentShareToken] = useState<string | null>(client.shareToken);

  const form = useForm<UpdateClientInput>({
    resolver: zodResolver(updateClientSchema),
    defaultValues: {
      name: client.name,
      status: client.status as "ACTIVE" | "PAUSED" | "DEBT",
      color: client.color || "#000000",
      monthlyReels: client.monthlyReels ?? 0,
      monthlyFlyers: client.monthlyFlyers ?? 0,
      monthlyRate: client.monthlyRate ?? 0,
      editorId: (client as any).editorId || null,
      communityId: (client as any).communityId || null,
    },
  });

  // Resetear formulario cuando cambia el cliente
  useEffect(() => {
    if (client && open) {
      form.reset({
        name: client.name,
        status: client.status as "ACTIVE" | "PAUSED" | "DEBT",
        color: client.color || "#000000",
        monthlyReels: client.monthlyReels ?? 0,
        monthlyFlyers: client.monthlyFlyers ?? 0,
        monthlyRate: client.monthlyRate ?? 0,
        editorId: (client as any).editorId || null,
        communityId: (client as any).communityId || null,
      });
    }
  }, [client, open, form]);

  const onSubmit = async (data: UpdateClientInput) => {
    startTransition(async () => {
      try {
        const result = await updateClient(client.id, data);

        if (result.success) {
          toast({
            title: "Cliente actualizado",
            description: "Los cambios se han guardado correctamente.",
          });
          // La UI se actualizará automáticamente gracias a revalidatePath
          router.refresh();
          onOpenChange(false);
        } else {
          toast({
            variant: "destructive",
            title: "Error al actualizar",
            description: result.error || "Ocurrió un error inesperado",
          });
        }
      } catch (error) {
        toast({
          variant: "destructive",
          title: "Error al actualizar",
          description:
            error instanceof Error
              ? error.message
              : "Ocurrió un error inesperado",
        });
      }
    });
  };

  // Actualizar el token cuando cambia el cliente
  useEffect(() => {
    if (client && open) {
      setCurrentShareToken((client as any).shareToken || null);
    }
  }, [client, open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Cliente</DialogTitle>
          <DialogDescription>
            Modifica los detalles del cliente y su plan mensual.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre del Cliente</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Ej: Empresa XYZ"
                      {...field}
                      disabled={isPending}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Estado</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                    disabled={isPending}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona un estado" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="ACTIVE">Activo</SelectItem>
                      <SelectItem value="PAUSED">Pausado</SelectItem>
                      <SelectItem value="DEBT">En Deuda</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="color"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Color de Marca</FormLabel>
                  <FormControl>
                    <ColorPicker
                      value={field.value || "#000000"}
                      onChange={field.onChange}
                      disabled={isPending}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="monthlyReels"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reels Mensuales</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="0"
                        placeholder="0"
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                        value={field.value || 0}
                        disabled={isPending}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="monthlyFlyers"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Flyers Mensuales</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="0"
                        placeholder="0"
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                        value={field.value || 0}
                        disabled={isPending}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="monthlyRate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tarifa Mensual ($)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      {...field}
                      onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                      value={field.value || 0}
                      disabled={isPending}
                    />
                  </FormControl>
                  <FormMessage />
                  <p className="text-sm text-muted-foreground">
                    Monto que se cobrará automáticamente cuando se cumpla el plan mensual
                  </p>
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="editorId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Editor Responsable</FormLabel>
                    <Select
                      onValueChange={(value) => field.onChange(value === "none" ? null : value)}
                      value={field.value || "none"}
                      disabled={isPending}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona un editor (opcional)" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">Sin asignar</SelectItem>
                        {users.map((user) => (
                          <SelectItem key={user.id} value={user.id}>
                            {user.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                    <p className="text-xs text-muted-foreground">
                      Editor responsable de la cuenta
                    </p>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="communityId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Community Manager Responsable</FormLabel>
                    <Select
                      onValueChange={(value) => field.onChange(value === "none" ? null : value)}
                      value={field.value || "none"}
                      disabled={isPending}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona un CM (opcional)" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">Sin asignar</SelectItem>
                        {users.map((user) => (
                          <SelectItem key={user.id} value={user.id}>
                            {user.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                    <p className="text-xs text-muted-foreground">
                      Community Manager responsable de la publicación
                    </p>
                  </FormItem>
                )}
              />
            </div>

            {/* Sección de Enlace Compartido */}
            <div className="pt-4 border-t">
              <div className="space-y-3">
                <div>
                  <h3 className="text-sm font-medium mb-1">Enlace de Reporte Compartido</h3>
                  <p className="text-xs text-muted-foreground mb-3">
                    Genera un enlace público para compartir el reporte con el cliente
                  </p>
                  <ShareReportButton
                    clientId={client.id}
                    shareToken={currentShareToken}
                    onTokenGenerated={(token) => {
                      setCurrentShareToken(token);
                      router.refresh();
                    }}
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-4 pt-4">
              <Button
                type="submit"
                disabled={isPending}
                className="flex-1"
              >
                {isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  "Guardar Cambios"
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isPending}
              >
                Cancelar
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

