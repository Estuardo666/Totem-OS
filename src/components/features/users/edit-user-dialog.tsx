"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Mail } from "lucide-react";
import { updateUserAdmin, type UserWithTaskCount } from "@/actions/user.actions";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import { updateUserSchema, type UpdateUserInput } from "@/schemas/user";

interface EditUserDialogProps {
  user: UserWithTaskCount;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditUserDialog({
  user,
  open,
  onOpenChange,
}: EditUserDialogProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSendingRecovery, setIsSendingRecovery] = useState(false);

  const activeTasksCount =
    (user._count?.tasksAsEditor || 0) +
    (user._count?.tasksAsCommunity || 0);

  const form = useForm<UpdateUserInput>({
    resolver: zodResolver(updateUserSchema),
    defaultValues: {
      name: user.name,
      email: user.email,
      roleLegacy: user.roleLegacy as "ADMIN" | "EDITOR" | "USER",
      specialty: user.specialty || null,
    },
  });

  // Resetear formulario cuando cambia el usuario
  useEffect(() => {
    if (user && open) {
      form.reset({
        name: user.name,
        email: user.email,
        roleLegacy: user.roleLegacy as "ADMIN" | "EDITOR" | "USER",
        specialty: user.specialty || null,
      });
    }
  }, [user, open, form]);

  const onSubmit = async (data: UpdateUserInput) => {
    setIsSubmitting(true);

    try {
      const result = await updateUserAdmin(user.id, data);

      if (result.success) {
        toast({
          title: "Usuario actualizado",
          description: "Los cambios se han guardado correctamente.",
        });
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
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSendRecoveryEmail = async () => {
    setIsSendingRecovery(true);

    try {
      // Simular envío de correo (por ahora solo muestra un toast)
      // TODO: Integrar con servicio de correo (Nodemailer, SendGrid, etc.)
      await new Promise((resolve) => setTimeout(resolve, 1000));

      toast({
        title: "Correo enviado",
        description: `Se ha enviado un correo de recuperación de contraseña a ${user.email}`,
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error al enviar correo",
        description: "No se pudo enviar el correo de recuperación",
      });
    } finally {
      setIsSendingRecovery(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Usuario</DialogTitle>
          <DialogDescription>
            Modifica la información del usuario. Los cambios se guardarán inmediatamente.
          </DialogDescription>
        </DialogHeader>

        {/* Tarjeta de resumen de carga de trabajo */}
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="pt-4">
            <p className="text-sm">
              Este usuario tiene <strong className="font-semibold">{activeTasksCount} tareas activas</strong> en este momento.
            </p>
            {activeTasksCount > 10 && (
              <p className="text-xs text-destructive mt-2 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                Carga de trabajo alta. Considera redistribuir tareas antes de hacer cambios.
              </p>
            )}
            {activeTasksCount > 5 && activeTasksCount <= 10 && (
              <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-2 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                Carga de trabajo moderada.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Advertencia al cambiar rol con carga pendiente */}
        {form.watch("roleLegacy") !== user.roleLegacy && activeTasksCount > 5 && (
          <Card className="border-l-4 border-l-amber-500 bg-amber-50 dark:bg-amber-950/20">
            <CardContent className="pt-4">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                <div className="text-sm">
                  <p className="font-semibold text-amber-900 dark:text-amber-100 mb-1">
                    Advertencia: Cambio de Rol con Carga Pendiente
                  </p>
                  <p className="text-amber-800 dark:text-amber-200">
                    Este usuario tiene {activeTasksCount} tareas pendientes. Revisa sus tareas antes de cambiar permisos para evitar afectar el flujo de trabajo.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Foto de perfil */}
            <div className="flex items-center gap-4">
              <Avatar className="h-14 w-14">
                <AvatarImage src={user.image || undefined} alt={user.name || "Avatar"} />
                <AvatarFallback>
                  {(user.name || "?")
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col gap-1 text-sm text-muted-foreground">
                <span className="font-medium text-foreground">Foto de Perfil (opcional)</span>
                <span>{user.image ? "Imagen cargada" : "Sin imagen"}</span>
              </div>
            </div>

            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre Completo</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Ej: Juan Pérez"
                      {...field}
                      disabled={isSubmitting}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="usuario@ejemplo.com"
                      {...field}
                      disabled={isSubmitting}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="roleLegacy"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Rol</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                      disabled={isSubmitting}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona un rol" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="ADMIN">ADMIN</SelectItem>
                        <SelectItem value="EDITOR">EDITOR</SelectItem>
                        <SelectItem value="USER">USER</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="specialty"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Especialidad</FormLabel>
                    <Select
                      onValueChange={(value) => field.onChange(value === "none" ? null : value)}
                      value={field.value || "none"}
                      disabled={isSubmitting}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona una especialidad" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">Sin especialidad</SelectItem>
                        <SelectItem value="EDITOR">Editor</SelectItem>
                        <SelectItem value="COMMUNITY">Community Manager</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                    <p className="text-xs text-muted-foreground">
                      Especialidad para asignación de clientes
                    </p>
                  </FormItem>
                )}
              />
            </div>

            {/* Sección de Recuperación de Contraseña */}
            <div className="pt-4 border-t">
              <div className="space-y-3">
                <div>
                  <h3 className="text-sm font-medium mb-1">Recuperación de Acceso</h3>
                  <p className="text-xs text-muted-foreground mb-3">
                    Envía un correo de recuperación de contraseña al usuario
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleSendRecoveryEmail}
                    disabled={isSendingRecovery || isSubmitting}
                    className="w-full"
                  >
                    {isSendingRecovery ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Enviando...
                      </>
                    ) : (
                      <>
                        <Mail className="mr-2 h-4 w-4" />
                        Enviar correo de recuperación
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>

            <div className="flex gap-4 pt-4">
              <Button
                type="submit"
                disabled={isSubmitting}
                className="flex-1"
              >
                {isSubmitting ? (
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
                disabled={isSubmitting}
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

