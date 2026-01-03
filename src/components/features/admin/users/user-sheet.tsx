"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, UserPlus, Save, X } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { userCreateSchema, userUpdateSchema } from "@/schemas/admin-schemas";
import { createUser, updateUser } from "@/actions/admin/user-actions";
import { getSpecialties } from "@/actions/admin/specialty-actions";
import { UserImageUpload } from "./user-image-upload";
import type { AdminUserWithRelations } from "@/actions/admin/user-actions";

interface UserSheetProps {
  user?: AdminUserWithRelations | null;
  trigger?: React.ReactNode;
  mode?: "create" | "edit";
  // Props para control externo (cuando se usa desde la tabla)
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function UserSheet({ user, trigger, mode = "create", open: externalOpen, onOpenChange }: UserSheetProps) {
  // Si se pasa open externo, úsalo; si no, usa estado interno
  const [internalOpen, setInternalOpen] = useState(false);
  const open = externalOpen !== undefined ? externalOpen : internalOpen;
  const setOpen = onOpenChange || setInternalOpen;

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [specialties, setSpecialties] = useState<Array<{ id: string; name: string }>>([]);
  const router = useRouter();
  const { toast } = useToast();

  const isEditMode = mode === "edit";
  const schema = isEditMode ? userUpdateSchema : userCreateSchema;

  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      name: user?.name || "",
      email: user?.email || "",
      password: "",
      roleLegacy: user?.roleLegacy || "EDITOR",
      specialty: user?.specialty || "",
      image: user?.image || "",
    },
  });

  // Cargar especialidades al abrir
  useEffect(() => {
    if (open) {
      loadSpecialties();
    }
  }, [open]);

  // Resetear formulario cuando cambia el usuario o se abre en modo edición
  useEffect(() => {
    if (user && open && isEditMode) {
      form.reset({
        name: user.name,
        email: user.email,
        password: "",
        roleLegacy: user.roleLegacy || "EDITOR",
        specialty: user.specialty || "",
        image: user.image || "",
      });
    } else if (!user && open && !isEditMode) {
      // Reset para creación
      form.reset({
        name: "",
        email: "",
        password: "",
        roleLegacy: "EDITOR",
        specialty: "",
        image: "",
      });
    }
  }, [user, open, isEditMode, form]);

  const loadSpecialties = async () => {
    try {
      const result = await getSpecialties();
      if (result.success && result.data) {
        setSpecialties(result.data);
      }
    } catch (error) {
      console.error("Error al cargar especialidades:", error);
    }
  };

  const handleImageChange = (url: string | null) => {
    form.setValue("image", url || "", { shouldValidate: true });
  };

  const onSubmit = async (data: any) => {
    setIsSubmitting(true);
    try {
      // Limpiar string vacíos a null para specialty
      if (data.specialty === "") data.specialty = null;

      let result;
      if (isEditMode && user) {
        const updateData: any = {
          name: data.name,
          email: data.email,
          roleLegacy: data.roleLegacy,
          specialty: data.specialty,
          image: data.image || null,
        };
        if (data.password && data.password.length > 0) {
          updateData.password = data.password;
        }
        result = await updateUser(user.id, updateData);
      } else {
        result = await createUser(data);
      }

      if (result.success) {
        toast({
          title: isEditMode ? "Actualizado" : "Creado",
          description: "Operación exitosa.",
        });
        router.refresh();
        setOpen(false);
        form.reset();
      } else {
        toast({ variant: "destructive", title: "Error", description: result.error });
      }
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "Error inesperado" });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Si hay trigger, renderiza el botón/trigger
  const content = (
    <Sheet open={open} onOpenChange={setOpen}>
      {trigger && <SheetTrigger asChild>{trigger}</SheetTrigger>}
      <SheetContent side="right" className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{isEditMode ? "Editar Usuario" : "Crear Usuario"}</SheetTitle>
          <SheetDescription>Gestiona la información del usuario.</SheetDescription>
        </SheetHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 mt-6">
            
            {/* Imagen */}
            <div className="space-y-2">
              <FormLabel>Foto de Perfil (Opcional)</FormLabel>
              <FormField
                control={form.control}
                name="image"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <UserImageUpload value={field.value} onChange={handleImageChange} disabled={isSubmitting} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Básicos */}
            <div className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre *</FormLabel>
                    <FormControl>
                      <Input placeholder="Juan Pérez" {...field} disabled={isSubmitting} />
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
                    <FormLabel>Email *</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="..." {...field} disabled={isSubmitting} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{isEditMode ? "Nueva Contraseña" : "Contraseña *"}</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder={isEditMode ? "Opcional" : "Mín 8 chars"} {...field} disabled={isSubmitting} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Configuración de Acceso */}
            <div className="space-y-4 p-4 bg-muted/50 rounded-lg border">
              <h3 className="font-semibold text-sm text-muted-foreground uppercase">Configuración de Acceso</h3>
              
              <FormField
                control={form.control}
                name="roleLegacy"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Rol *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || "EDITOR"} disabled={isSubmitting}>
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="Selecciona rol" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="ADMIN">ADMIN</SelectItem>
                        <SelectItem value="EDITOR">EDITOR</SelectItem>
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
                    <Select onValueChange={(v) => field.onChange(v === "none" ? null : v)} value={field.value || "none"} disabled={isSubmitting}>
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="Selecciona especialidad" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">Ninguna</SelectItem>
                        {specialties.map((spec) => (
                          <SelectItem key={spec.id} value={spec.name}>
                            {spec.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                    <p className="text-xs text-muted-foreground">
                      Opciones gestionadas en la pestaña "Especialidades"
                    </p>
                  </FormItem>
                )}
              />
            </div>

            <div className="flex gap-3 pt-4 border-t">
              <Button type="submit" disabled={isSubmitting} className="flex-1">
                {isSubmitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                {isEditMode ? "Guardar" : "Crear"}
              </Button>
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isSubmitting}>
                <X className="h-4 w-4 mr-2" /> Cancelar
              </Button>
            </div>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );

  // Si no hay trigger (modo edición desde tabla), renderiza solo el Sheet
  if (!trigger) {
    return content;
  }

  // Si hay trigger (modo creación desde botón), renderiza con trigger
  return content;
}
