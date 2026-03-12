"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { z } from "zod";
import {
  updateClientSchema,
} from "@/schemas/client";
import type { Client } from "@prisma/client";
import { updateClient } from "@/actions/client-actions";
import { useToast } from "@/components/ui/use-toast";
import { useRedirectOnAuthError } from "@/hooks";
import { ShareReportButton } from "./share-report-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { UploadButton } from "@/utils/uploadthing";
import { X } from "lucide-react";
import type { User } from "@prisma/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface EditClientDialogProps {
  client: Client;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  users: User[];
}

type EditableClient = Client & {
  billingStartDate?: Date | null;
  paymentDay?: number | null;
  editorId?: string | null;
  communityId?: string | null;
  contactEmails?: string | null;
  logo?: string | null;
  shareToken?: string | null;
};

function formatDateInputValue(date: Date | null | undefined): string {
  if (!date) {
    return "";
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function EditClientDialog({
  client,
  open,
  onOpenChange,
  users,
}: EditClientDialogProps) {
  const editableClient: EditableClient = client;
  type UpdateClientFormInput = z.input<typeof updateClientSchema>;
  const contactEmailsValue = (() => {
    if (!editableClient.contactEmails) return "";
    try {
      const parsed = JSON.parse(editableClient.contactEmails) as string[];
      return Array.isArray(parsed) ? parsed.join(", ") : "";
    } catch {
      return "";
    }
  })();
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [currentShareToken, setCurrentShareToken] = useState<string | null>(editableClient.shareToken ?? null);
  const [logoUrl, setLogoUrl] = useState<string | null>(editableClient.logo ?? null);
  const [isUploading, setIsUploading] = useState(false);

  const form = useForm<UpdateClientFormInput>({
    resolver: zodResolver(updateClientSchema),
    defaultValues: {
      name: client.name,
      status: client.status as "ACTIVE" | "PAUSED" | "DEBT" | "INACTIVE",
      color: client.color || "#000000",
      monthlyReels: client.monthlyReels ?? 0,
      monthlyFlyers: client.monthlyFlyers ?? 0,
      monthlyRate: client.monthlyRate ?? 0,
      paymentDay: editableClient.paymentDay ?? null,
      billingStartDate: editableClient.billingStartDate ?? null,
      editorId: editableClient.editorId ?? null,
      communityId: editableClient.communityId ?? null,
      contactEmails: contactEmailsValue,
    },
  });

  // Resetear formulario cuando cambia el cliente
  useEffect(() => {
    if (client && open) {
      form.reset({
        name: client.name,
        status: client.status as "ACTIVE" | "PAUSED" | "DEBT" | "INACTIVE",
        color: client.color || "#000000",
        monthlyReels: client.monthlyReels ?? 0,
        monthlyFlyers: client.monthlyFlyers ?? 0,
        monthlyRate: client.monthlyRate ?? 0,
        paymentDay: editableClient.paymentDay ?? null,
        billingStartDate: editableClient.billingStartDate ?? null,
        editorId: editableClient.editorId ?? null,
        communityId: editableClient.communityId ?? null,
        contactEmails: contactEmailsValue,
      });
    }
  }, [client, editableClient.billingStartDate, editableClient.communityId, editableClient.editorId, editableClient.paymentDay, open, form]);

  const handleAuthError = useRedirectOnAuthError();

  const onSubmit = async (data: UpdateClientFormInput) => {
    startTransition(async () => {
      try {
        const clientData = {
          ...data,
          logo: logoUrl,
        };
        
        const result = await updateClient(client.id, clientData);

        if (result.success) {
          toast({
            title: "Cliente actualizado",
            description: "Los cambios se han guardado correctamente.",
          });
          router.refresh();
          onOpenChange(false);
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
      setCurrentShareToken(editableClient.shareToken ?? null);
    }
  }, [client, editableClient.shareToken, open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-hidden flex flex-col min-h-0">
        {isUploading && (
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex flex-col items-center justify-center gap-3 z-50 rounded-lg">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="text-lg font-medium">Subiendo logo...</p>
          </div>
        )}
        <DialogHeader>
          <DialogTitle>Editar Cliente</DialogTitle>
          <DialogDescription>
            Modifica los detalles del cliente y su plan mensual.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col flex-1 min-h-0">
            <div className="overflow-y-auto overflow-x-hidden pr-2 flex-1 min-h-0 custom-scroll">
              <div className="space-y-6 pb-4">
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
                        <UploadButton
                          endpoint="imageUploader"
                          appearance={{
                            button: "px-4 py-2 rounded-md bg-primary text-white hover:bg-primary/90 text-sm font-medium shadow-sm",
                            allowedContent: "text-xs text-muted-foreground",
                          }}
                          content={{
                            button({ ready }: { ready: boolean }) {
                              return ready ? "Subir logo" : "Preparando...";
                            },
                            allowedContent: "Imagen (máx. 4MB)",
                          }}
                          onUploadBegin={() => {
                            setIsUploading(true);
                          }}
                          onClientUploadComplete={(res: Array<{ url: string }>) => {
                            if (res && res.length > 0) {
                              setLogoUrl(res[0].url);
                              setIsUploading(false);
                              toast({
                                title: "✅ Logo subido",
                                description: "El logo se ha subido correctamente.",
                              });
                            }
                          }}
                          onUploadError={(error: Error) => {
                            setIsUploading(false);
                            toast({
                              variant: "destructive",
                              title: "❌ Error al subir logo",
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

                <FormField
                  control={form.control}
                  name="billingStartDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Inicio de facturación</FormLabel>
                      <FormControl>
                        <Input
                          type="date"
                          value={field.value instanceof Date ? formatDateInputValue(field.value) : ""}
                          onChange={(e) => field.onChange(e.target.value || null)}
                          disabled={isPending}
                        />
                      </FormControl>
                      <FormMessage />
                      <p className="text-sm text-muted-foreground">
                        Define desde qué fecha empieza realmente el cobro del cliente, aunque haya sido creado antes.
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
                            <SelectTrigger className="justify-start">
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

                <div className="flex gap-4 pt-4 border-t">
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
              </div>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
