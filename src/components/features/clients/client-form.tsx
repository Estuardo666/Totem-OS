"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { z } from "zod";
import { createClientSchema } from "@/schemas/client";
import { createClient } from "@/actions/client-actions";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { UploadButton } from "@/utils/uploadthing";
import { useState } from "react";
import { X } from "lucide-react";
import type { User } from "@prisma/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface ClientFormProps {
  users: User[];
}

export function ClientForm({ users }: ClientFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  type CreateClientFormInput = z.input<typeof createClientSchema>;

  const form = useForm<CreateClientFormInput>({
    resolver: zodResolver(createClientSchema),
    defaultValues: {
      name: "",
      status: "ACTIVE",
      color: "#000000",
      monthlyReels: 0,
      monthlyFlyers: 0,
      monthlyRate: 0,
      paymentDay: null,
      editorId: null,
      communityId: null,
      contactEmails: "",
    },
  });

  const { formState: { isSubmitting } } = form;

  const onSubmit = async (data: CreateClientFormInput) => {
    startTransition(async () => {
      try {
        // Include logo URL in the data
        const clientData = {
          ...data,
          logo: logoUrl,
        };
        
        const result = await createClient(clientData);

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
                  className="text-2xl font-medium border-0 border-b-2 border-input rounded-none px-0 pb-2 bg-transparent focus:border-primary"
                  style={{ fontSize: "1.5rem", fontWeight: 500 }}
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
                  <SelectItem value="DEBT">En Deuda</SelectItem>
                  <SelectItem value="INACTIVE">Inactivo</SelectItem>
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

        {/* Logo Upload */}
        <div>
          <FormLabel>Logotipo del Cliente</FormLabel>
          <div className="mt-2">
            {logoUrl ? (
              <div className="flex items-center gap-4">
                <div className="relative w-20 h-20 border rounded-lg overflow-hidden bg-white">
                  <img
                    src={logoUrl}
                    alt="Logo del cliente"
                    className="w-full h-full object-contain"
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setLogoUrl(null)}
                  className="text-destructive hover:text-destructive"
                >
                  <X className="mr-2 h-4 w-4" />
                  Eliminar
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                {isUploading && (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                )}
                <UploadButton
                  endpoint="imageUploader"
                  onClientUploadComplete={(res) => {
                    if (res && res.length > 0) {
                      setLogoUrl(res[0].url);
                      setIsUploading(false);
                      toast({
                        title: "Logo subido",
                        description: "El logo se ha subido correctamente.",
                      });
                    }
                  }}
                  onUploadProgress={() => {
                    setIsUploading(true);
                  }}
                  onUploadError={(error: Error) => {
                    setIsUploading(false);
                    toast({
                      variant: "destructive",
                      title: "Error al subir logo",
                      description: error.message,
                    });
                  }}
                />
              </div>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Sube el logotipo del cliente. Se usará en reportes y materiales.
          </p>
        </div>

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
          name="contactEmails"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Correos electrónicos</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="correo1@gmail.com, correo2@gmail.com"
                  value={typeof field.value === "string" ? field.value : ""}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  name={field.name}
                  ref={field.ref}
                  disabled={isPending}
                  className="min-h-[90px]"
                />
              </FormControl>
              <FormMessage />
              <p className="text-xs text-muted-foreground">
                Separa con comas o saltos de línea. Solo @gmail.com se sincronizan en Google Calendar.
              </p>
            </FormItem>
          )}
        />

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

        <FormField
          control={form.control}
          name="paymentDay"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Fecha de pago (día del mes)</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  min="1"
                  max="31"
                  placeholder="Ej: 15"
                  value={field.value ?? ""}
                  onChange={(e) => {
                    const value = e.target.value;
                    field.onChange(value ? parseInt(value, 10) : null);
                  }}
                  disabled={isPending}
                />
              </FormControl>
              <FormMessage />
              <p className="text-sm text-muted-foreground">
                Día fijo en que se generará la transacción mensual (1-31).
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
                        <div className="flex items-center gap-2">
                          <Avatar className="h-6 w-6">
                            <AvatarImage src={user.image || undefined} alt={user.name || ""} />
                            <AvatarFallback>{user.name?.charAt(0).toUpperCase()}</AvatarFallback>
                          </Avatar>
                          <span>{user.name}</span>
                        </div>
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
                        <div className="flex items-center gap-2">
                          <Avatar className="h-6 w-6">
                            <AvatarImage src={user.image || undefined} alt={user.name || ""} />
                            <AvatarFallback>{user.name?.charAt(0).toUpperCase()}</AvatarFallback>
                          </Avatar>
                          <span>{user.name}</span>
                        </div>
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

