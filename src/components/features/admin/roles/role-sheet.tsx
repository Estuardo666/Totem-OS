"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Plus, Save, X } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { roleSchema, type RoleInput } from "@/schemas/admin-schemas";
import { createRole, updateRole } from "@/actions/admin/role-actions";
import type { Role } from "@prisma/client";

interface RoleSheetProps {
  role?: Role | null;
  trigger?: React.ReactNode;
  mode?: "create" | "edit";
}

export function RoleSheet({ role, trigger, mode = "create" }: RoleSheetProps) {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const isEditMode = mode === "edit";

  const form = useForm<RoleInput>({
    resolver: zodResolver(roleSchema),
    defaultValues: {
      name: role?.name || "",
      description: role?.description || "",
    },
  });

  // Resetear formulario cuando cambia el rol (para editar)
  useEffect(() => {
    if (role && open) {
      form.reset({
        name: role.name,
        description: role.description || "",
      });
    }
  }, [role, open, form]);

  const onSubmit = async (data: RoleInput) => {
    setIsSubmitting(true);

    try {
      let result;

      if (isEditMode && role) {
        result = await updateRole(role.id, data);
      } else {
        result = await createRole(data);
      }

      if (result.success) {
        toast({
          title: isEditMode ? "Rol actualizado" : "Rol creado",
          description: isEditMode
            ? "Los cambios se han guardado correctamente."
            : "El nuevo rol ha sido creado exitosamente.",
        });
        router.refresh();
        setOpen(false);
        form.reset();
      } else {
        toast({
          variant: "destructive",
          title: isEditMode ? "Error al actualizar" : "Error al crear",
          description: result.error || "Ocurrió un error inesperado",
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "Ocurrió un error inesperado",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        {trigger || (
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            {isEditMode ? "Editar Rol" : "Nuevo Rol"}
          </Button>
        )}
      </SheetTrigger>
      <SheetContent side="right" className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle>
            {isEditMode ? "Editar Rol" : "Crear Nuevo Rol"}
          </SheetTitle>
          <SheetDescription>
            {isEditMode
              ? "Modifica la información del rol existente."
              : "Define un nuevo rol para gestionar permisos en el sistema."}
          </SheetDescription>
        </SheetHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 mt-6">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre del Rol *</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Ej: Editor, Community Manager, etc."
                      {...field}
                      disabled={isSubmitting}
                    />
                  </FormControl>
                  <FormMessage />
                  <p className="text-xs text-muted-foreground">
                    Mínimo 2 caracteres. Ejemplos: "Admin", "Editor", "Viewer"
                  </p>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descripción (Opcional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Describe las responsabilidades de este rol..."
                      {...field}
                      disabled={isSubmitting}
                      className="resize-none"
                      rows={4}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex gap-3 pt-4 border-t">
              <Button
                type="submit"
                disabled={isSubmitting}
                className="flex-1"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    {isEditMode ? "Guardar Cambios" : "Crear Rol"}
                  </>
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={isSubmitting}
              >
                <X className="h-4 w-4 mr-2" />
                Cancelar
              </Button>
            </div>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
}

