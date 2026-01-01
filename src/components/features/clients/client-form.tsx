"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { createClientSchema, type CreateClientInput } from "@/schemas/client";
import { createClient } from "@/actions/client-actions";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

interface ClientFormProps {
  users: User[];
}

export function ClientForm({ users }: ClientFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const form = useForm<CreateClientInput>({
    resolver: zodResolver(createClientSchema),
    defaultValues: {
      name: "",
      status: "ACTIVE",
      color: "#000000",
      monthlyReels: 0,
      monthlyFlyers: 0,
      monthlyRate: 0,
      editorId: null,
      communityId: null,
    },
  });

  const { formState: { isSubmitting } } = form;

  const onSubmit = async (data: CreateClientInput) => {
    startTransition(async () => {
      try {
        const result = await createClient(data);

        if (result.success && result.data) {
          toast({
            title: "Cliente creado",
            description: `El cliente "${result.data.name}" ha sido creado exitosamente.`,
          });
          // Redirigir a la lista de clientes (la UI se actualizará automáticamente gracias a revalidatePath)
          router.push("/clients");
        } else {
          toast({
            variant: "destructive",
            title: "Error al crear cliente",
            description: result.error || "Ocurrió un error inesperado",
          });
        }
      } catch (error) {
        toast({
          variant: "destructive",
          title: "Error al crear cliente",
          description:
            error instanceof Error
              ? error.message
              : "Ocurrió un error inesperado",
        });
      }
    });
  };

  return (
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
                defaultValue={field.value}
                disabled={isSubmitting}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona un estado" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="ACTIVE">Activo</SelectItem>
                  <SelectItem value="PAUSED">Pausado</SelectItem>
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

        <div className="flex gap-4">
          <Button
            type="submit"
            disabled={isSubmitting}
            className="min-w-[120px]"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Guardando...
              </>
            ) : (
              "Guardar"
            )}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            disabled={isSubmitting}
          >
            Cancelar
          </Button>
        </div>
      </form>
    </Form>
  );
}

