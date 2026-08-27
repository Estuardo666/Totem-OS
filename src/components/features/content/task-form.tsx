"use client";

import { useTransition, useState, useEffect } from "react";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { subHours } from "date-fns";
import { Loader2, X, Download, Copy, Check } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { generateTaskOptionsAction, refineTaskContentAction } from "@/actions/ai-actions";
import { AiContentAssistant } from "@/components/features/ai/ai-content-assistant";
import { createContentTaskSchema, type CreateContentTaskInput } from "@/schemas/content";
import type { Client } from "@prisma/client";
import { createTask } from "@/actions/content-actions";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { UserWithTaskCount } from "@/actions/user.actions";
import { UploadButton } from "@uploadthing/react";
import type { OurFileRouter } from "@/app/api/uploadthing/core";
import Image from "next/image";
import Link from "next/link";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import { cn } from "@/lib/utils";

interface TaskFormProps {
  clients: Client[];
  users: UserWithTaskCount[];
}

type CreateTaskFormValues = z.input<typeof createContentTaskSchema>;

/**
 * Convierte una fecha a formato YYYY-MM-DD usando la zona local del navegador.
 */
const formatToDateInput = (value?: Date | string | null): string => {
  if (!value) return "";
  const date = typeof value === "string" ? new Date(value) : value;
  if (isNaN(date.getTime())) return "";

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

export function TaskForm({ clients, users }: TaskFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const form = useForm<CreateTaskFormValues>({
    resolver: zodResolver(createContentTaskSchema),
    mode: "onBlur",
    defaultValues: {
      title: "",
      type: "REEL",
      status: "IDEA",
      priority: "MEDIUM",
      clientId: "",
      assignedEditorId: undefined,
      assignedCommunityId: undefined,
      dueDate: undefined,
      scheduledAt: formatToDateInput(new Date()),
      postCopy: undefined,
      coverImageUrl: undefined,
      audioBriefUrl: undefined,
    },
  });

  const [copied, setCopied] = useState(false);
  const [isGenerating, startGenerating] = useTransition();
  const [isRefining, startRefining] = useTransition();
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const coverImageUrl = form.watch("coverImageUrl");
  const selectedClientId = form.watch("clientId");
  const postCopy = form.watch("postCopy");

  // Verificar si el cliente seleccionado tiene ADN de marca configurado
  const selectedClient = selectedClientId ? clients.find((c) => c.id === selectedClientId) : null;

  // Auto-rellenar Editor y Community cuando se selecciona un cliente
  useEffect(() => {
    if (selectedClientId) {
      const selectedClient = clients.find((c) => c.id === selectedClientId);
      if (selectedClient) {
        if (selectedClient.editorId) {
          form.setValue("assignedEditorId", selectedClient.editorId);
        }
        if (selectedClient.communityId) {
          form.setValue("assignedCommunityId", selectedClient.communityId);
        }
      }
    }
  }, [selectedClientId, clients, form]);

  const handleCopy = async () => {
    const copyText = form.getValues("postCopy");
    if (!copyText) {
      toast({
        variant: "destructive",
        title: "Sin contenido",
        description: "No hay texto para copiar",
      });
      return;
    }

    try {
      await navigator.clipboard.writeText(copyText);
      setCopied(true);
      toast({
        title: "Copiado 📋",
        description: "El texto se ha copiado al portapapeles",
        duration: 2000,
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudo copiar el texto",
      });
    }
  };

  const onSubmit = async (data: CreateTaskFormValues) => {
    startTransition(async () => {
      try {
        const parsedData = createContentTaskSchema.parse(data);

        // Calcular automáticamente la fecha de entrega: 24 horas antes de la fecha programada
        let calculatedDueDate: Date | undefined = undefined;
        if (parsedData.scheduledAt) {
          const scheduledDate = parsedData.scheduledAt instanceof Date
            ? parsedData.scheduledAt
            : new Date(parsedData.scheduledAt);
          calculatedDueDate = subHours(scheduledDate, 24);
        }

        // Preparar los datos con la fecha de entrega calculada
        const taskData: CreateContentTaskInput = {
          ...parsedData,
          dueDate: calculatedDueDate,
        };

        const result = await createTask(taskData);

        if (result.success && result.data) {
          toast({
            title: "Tarea creada",
            description: `La tarea "${result.data.title}" ha sido creada exitosamente.`,
          });
          // Forzar refresco de los datos antes de redirigir
          router.refresh();
          // Redirigir a la lista de contenido (la UI se actualizará automáticamente gracias a revalidatePath)
          router.push("/content");
        } else {
          toast({
            variant: "destructive",
            title: "Error al crear tarea",
            description: result.error || "Ocurrió un error inesperado",
          });
        }
      } catch (error) {
        toast({
          variant: "destructive",
          title: "Error al crear tarea",
          description:
            error instanceof Error
              ? error.message
              : "Ocurrió un error inesperado",
        });
      }
    });
  };

  // Función helper para obtener el color del círculo de prioridad
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "LOW":
        return "bg-white border border-gray-300";
      case "MEDIUM":
        return "bg-green-500";
      case "HIGH":
        return "bg-orange-500";
      case "URGENT":
        return "bg-red-500";
      default:
        return "bg-gray-300";
    }
  };

  // Función helper para obtener el texto de prioridad
  const getPriorityLabel = (priority: string) => {
    switch (priority) {
      case "LOW":
        return "Baja";
      case "MEDIUM":
        return "Media";
      case "HIGH":
        return "Alta";
      case "URGENT":
        return "Urgente";
      default:
        return priority;
    }
  };

  const getUserInitials = (name: string) =>
    name
      .split(" ")
      .map((word) => word[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);

  // Función helper para verificar si el brandDNA está completo
  const isBrandDNAComplete = (brandDNA: any): boolean => {
    if (!brandDNA) return false;
    
    const requiredFields = ["businessDescription", "toneOfVoice", "audience"];
    return requiredFields.every(field => {
      const value = brandDNA[field];
      return value && typeof value === "string" && value.trim().length > 0;
    });
  };

  // Función helper para obtener el error del brandDNA
  const getBrandDNAError = (brandDNA: any): string => {
    if (!brandDNA) return "El cliente no tiene configurado el ADN de Marca";
    
    const missingFields: string[] = [];
    
    if (!brandDNA.businessDescription || brandDNA.businessDescription.trim().length === 0) {
      missingFields.push("Descripción del negocio");
    }
    if (!brandDNA.toneOfVoice || brandDNA.toneOfVoice.trim().length === 0) {
      missingFields.push("Tono de voz");
    }
    if (!brandDNA.audience || brandDNA.audience.trim().length === 0) {
      missingFields.push("Audiencia objetivo");
    }
    
    if (missingFields.length > 0) {
      return `Faltan campos en el ADN de marca: ${missingFields.join(", ")}`;
    }
    
    return "ADN de marca completo";
  };

  // Calcular si el brandDNA está completo
  const hasCompleteBrandDNA = selectedClient ? isBrandDNAComplete(selectedClient.brandDNA) : false;
  const brandDNAError = selectedClient ? getBrandDNAError(selectedClient.brandDNA) : "Selecciona un cliente primero";

  return (
    <TooltipProvider>
      <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col h-full relative">
        <div className="flex-1 overflow-y-auto py-4 px-1 space-y-6">
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Título de la Tarea</FormLabel>
              <FormControl>
                <Input
                  placeholder="Ej: Reel de producto nuevo"
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
          name="clientId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Cliente</FormLabel>
              <Select
                onValueChange={field.onChange}
                value={field.value}
                disabled={isPending}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona un cliente" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      <div className="flex items-center gap-2">
                        <Avatar className="h-6 w-6">
                          <AvatarImage src={client.logo || undefined} alt={client.name} />
                          <AvatarFallback className="bg-primary text-white text-xs font-medium">
                            {client.name.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span>{client.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Tipo de Contenido</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  value={field.value}
                  disabled={isPending}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona el tipo" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="REEL">Reel</SelectItem>
                    <SelectItem value="FLYER">Flyer</SelectItem>
                    <SelectItem value="STORY">Story</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="assignedEditorId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Editor Asignado</FormLabel>
                <Select
                  onValueChange={(value) => field.onChange(value === "none" ? undefined : value)}
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
                            <AvatarImage src={user.image || undefined} alt={user.name} />
                            <AvatarFallback className="text-xs font-semibold">
                              {getUserInitials(user.name)}
                            </AvatarFallback>
                          </Avatar>
                          <span>{user.name}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="assignedCommunityId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Community Asignado</FormLabel>
                <Select
                  onValueChange={(value) => field.onChange(value === "none" ? undefined : value)}
                  value={field.value || "none"}
                  disabled={isPending}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona un community (opcional)" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="none">Sin asignar</SelectItem>
                    {users.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-6 w-6">
                            <AvatarImage src={user.image || undefined} alt={user.name} />
                            <AvatarFallback className="text-xs font-semibold">
                              {getUserInitials(user.name)}
                            </AvatarFallback>
                          </Avatar>
                          <span>{user.name}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="scheduledAt"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Fecha de Entrega Interna</FormLabel>
              <FormControl>
                <Input
                  type="date"
                  value={field.value ? formatToDateInput(field.value) : ""}
                  onChange={(e) => {
                    field.onChange(e.target.value || undefined);
                  }}
                  disabled={isPending}
                />
              </FormControl>
              <FormMessage />
              <p className="text-xs text-muted-foreground">
                Selecciona el dia de publicacion. La hora no es obligatoria.
              </p>
            </FormItem>
          )}
        />

        <Separator className="h-[2px] bg-primary/50" />

        {/* Sección de Recursos Creativos */}
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-semibold mb-4">Recursos Creativos</h3>
          </div>

          {/* Campo de Copy */}
          <FormField
            control={form.control}
            name="postCopy"
            render={({ field }) => (
              <FormItem>
                <div className="flex items-center justify-between">
                  <FormLabel>Copy del Post</FormLabel>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={handleCopy}
                    disabled={!field.value || isPending}
                  >
                    {copied ? (
                      <Check className="h-4 w-4 text-green-600" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <FormControl>
                  <div className="relative">
                    <Textarea
                      placeholder="Escribe el texto del post aquí..."
                      {...field}
                      value={field.value ?? ""}
                      disabled={isPending}
                      className="min-h-[120px] resize-y"
                    />
                  </div>
                </FormControl>
                <FormMessage />
                <p className="text-xs text-muted-foreground">
                  Usa el botón de copiar para copiar el texto al portapapeles
                </p>
                
                {/* IA Content Assistant */}
                {selectedClientId ? (
                  <AiContentAssistant
                    taskId="" // No hay taskId en creación, pero el componente maneja este caso
                    currentCopy={postCopy ?? undefined}
                    onInsertCopy={(content) => {
                      form.setValue("postCopy", content, {
                        shouldDirty: true,
                        shouldTouch: true,
                        shouldValidate: false,
                      });
                    }}
                    hasCompleteBrandDNA={hasCompleteBrandDNA}
                    brandDNAError={brandDNAError}
                  />
                ) : null}
              </FormItem>
            )}
          />

          {/* Campo de Imagen de Portada */}
          <FormField
            control={form.control}
            name="coverImageUrl"
            render={({ field }) => {
              // Verificar si hay un valor válido
              const hasImage = !!field.value && field.value !== "";
              
              return (
                <FormItem>
                  <FormLabel>Imagen de Portada</FormLabel>
                  <FormControl>
                    {hasImage ? (
                    <div className="relative rounded-lg border border-input overflow-hidden">
                      <div className="relative w-full h-64">
                        <Image
                          src={field.value ?? ""}
                          alt="Imagen de portada"
                          fill
                          className="object-cover"
                        />
                        <div className="absolute top-2 right-2 flex gap-2">
                          <Button
                            type="button"
                            variant="secondary"
                            size="icon"
                            className="h-8 w-8 bg-background/80 backdrop-blur-sm"
                            asChild
                          >
                            <Link href={field.value ?? ""} target="_blank" rel="noopener noreferrer">
                              <Download className="h-4 w-4" />
                            </Link>
                          </Button>
                          <Button
                            type="button"
                            variant="destructive"
                            size="icon"
                            className="h-8 w-8 bg-background/80 backdrop-blur-sm"
                            onClick={() => {
                              // Establecer el valor a una cadena vacía para que React Hook Form lo maneje correctamente
                              // El esquema Zod convertirá esto a null en el servidor
                              field.onChange("");
                              toast({
                                title: "Imagen eliminada",
                                description: "Guarda cambios para confirmar.",
                              });
                            }}
                            disabled={isPending}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 flex flex-col items-center justify-center gap-4 bg-gray-50 relative">
                      {isUploadingImage && (
                        <div className="absolute inset-0 bg-background/80 backdrop-blur-sm rounded-lg flex flex-col items-center justify-center gap-3 z-10">
                          <Loader2 className="h-8 w-8 animate-spin text-primary" />
                          <p className="text-sm font-medium text-muted-foreground">Subiendo imagen...</p>
                        </div>
                      )}
                      <UploadButton<OurFileRouter, "brandAsset">
                        endpoint="brandAsset"
                        appearance={{
                          button: "bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2 inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
                          allowedContent: "hidden"
                        }}
                        content={{ button: "Subir Portada" }}
                        onUploadBegin={() => {
                          setIsUploadingImage(true);
                        }}
                        onClientUploadComplete={(res) => {
                          setIsUploadingImage(false);
                          if (res && res[0]) {
                            const newUrl = res[0].ufsUrl || res[0].url; // Usa ufsUrl, con fallback a url
                            // Actualiza el estado local "en caliente" para mostrar la nueva imagen inmediatamente
                            form.setValue("coverImageUrl", newUrl, {
                              shouldDirty: true,
                              shouldTouch: true,
                              shouldValidate: true
                            });
                            toast({
                              title: "✅ Imagen subida",
                              description: "La imagen se ha subido correctamente",
                            });
                          }
                        }}
                        onUploadError={(error: Error) => {
                          setIsUploadingImage(false);
                          toast({
                            title: "❌ Error al subir",
                            description: error.message,
                            variant: "destructive"
                          });
                        }}
                      />
                    </div>
                  )}
                  </FormControl>
                  <FormMessage />
                </FormItem>
              );
            }}
          />

        </div>
        </div>

        <div className="sticky bottom-0 left-0 right-0 bg-background pt-4 border-t flex justify-end gap-4 z-10">
          <Button
            type="submit"
            disabled={isPending}
            className="min-w-[120px]"
          >
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creando...
              </>
            ) : (
              "Crear Tarea"
            )}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            disabled={isPending}
          >
            Cancelar
          </Button>
        </div>
      </form>
    </Form>
    </TooltipProvider>
  );
}
