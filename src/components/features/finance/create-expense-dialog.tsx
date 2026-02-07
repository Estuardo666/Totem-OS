"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { z } from "zod";
import type { User, Client } from "@prisma/client";
import { createExpense } from "@/actions/finance-actions";
import { getUsers } from "@/actions/user.actions";
import { getClients } from "@/actions/client-actions";
import { useToast } from "@/components/ui/use-toast";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
// Mapeo de palabras clave a categorías
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  COMIDA: ["almuerzo", "cena", "desayuno", "comida", "meal", "restaurant", "comedor", "pizza", "hamburguesa", "sushi", "café", "coffee", "lunch", "dinner", "breakfast", "food", "restaurante"],
  TRANSPORTE: ["taxi", "uber", "bus", "colectivo", "gasolina", "combustible", "parking", "estacionamiento", "viaje", "transporte", "flight", "vuelo", "aeropuerto", "aereo", "tren", "train"],
  INVITACIONES: ["invitación", "evento", "fiesta", "boda", "cumpleaños", "regalo", "gift", "invitación", "entrada", "ticket", "show", "concierto", "teatro"],
  SOFTWARE: ["software", "license", "licencia", "suscripción", "subscription", "adobe", "microsoft", "google", "app", "aplicación", "plugin", "extension", "saas", "cloud", "api"],
  OFICINA: ["oficina", "office", "supplies", "papelería", "tinta", "printer", "impresora", "escritorio", "desk", "silla", "chair", "estantería", "mueble"],
  EQUIPOS: ["equipo", "equipment", "cámara", "camera", "micrófono", "mic", "monitor", "pantalla", "computadora", "laptop", "teclado", "keyboard", "mouse", "disco", "drone", "luz", "light"],
};

const detectCategory = (description: string): string => {
  const lowerDescription = description.toLowerCase().trim();
  
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    for (const keyword of keywords) {
      if (lowerDescription.includes(keyword)) {
        return category;
      }
    }
  }
  
  return "OTROS";
};
// Función helper para obtener la fecha actual en zona horaria de Ecuador (America/Guayaquil)
const getCurrentDateInEcuador = (): Date => {
  const now = new Date();
  const ecuadorTime = new Date(now.toLocaleString("en-US", { timeZone: "America/Guayaquil" }));
  ecuadorTime.setHours(0, 0, 0, 0);
  return ecuadorTime;
};

const formatDateValue = (value?: Date | string) => {
  if (!value) return "";
  if (typeof value === "string") return value.split("T")[0];
  
  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

// Schema para crear gasto
const createExpenseSchema = z.object({
  description: z.string().min(1, "La descripción es obligatoria"),
  amount: z.number().positive("El monto debe ser mayor que 0"),
  category: z.enum([
    "COMIDA",
    "TRANSPORTE",
    "INVITACIONES",
    "SOFTWARE",
    "OFICINA",
    "EQUIPOS",
    "OTROS",
  ]),
  date: z.date(),
  paidByUserIds: z.array(z.string()).optional(),
  clientId: z.string().optional(),
});

type CreateExpenseInput = z.infer<typeof createExpenseSchema>;

interface CreateExpenseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateExpenseDialog({
  open,
  onOpenChange,
}: CreateExpenseDialogProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadingClients, setLoadingClients] = useState(false);

  const form = useForm<CreateExpenseInput>({
    resolver: zodResolver(createExpenseSchema),
    defaultValues: {
      description: "",
      amount: 0,
      category: "OTROS",
      date: getCurrentDateInEcuador(),
      paidByUserIds: [],
      clientId: undefined,
    },
  });

  // Cargar usuarios y clientes solo una vez al montar el componente
  useEffect(() => {
    setLoadingUsers(true);
    setLoadingClients(true);

    Promise.all([getUsers(), getClients()])
      .then(([usersResult, clientsResult]) => {
        if (usersResult.success && usersResult.data) {
          setUsers(usersResult.data);
        }
        if (clientsResult.success && clientsResult.data) {
          setClients(clientsResult.data);
        }
      })
      .finally(() => {
        setLoadingUsers(false);
        setLoadingClients(false);
      });
  }, []); // Solo se ejecuta al montar el componente

  // Handler para auto-detectar categoría cuando se sale del campo de descripción
  const handleDescriptionBlur = (descriptionValue: string) => {
    if (descriptionValue && descriptionValue.trim()) {
      const detectedCategory = detectCategory(descriptionValue);
      console.log("Detected category:", detectedCategory, "from description:", descriptionValue);
      form.setValue("category", detectedCategory);
    }
  };

  // Resetear formulario cuando se cierra
  useEffect(() => {
    if (!open) {
      form.reset({
        description: "",
        amount: 0,
        category: "OTROS",
        date: new Date(),
        paidByUserIds: [],
        clientId: undefined,
      });
    }
  }, [open, form]);

  const onSubmit = async (data: CreateExpenseInput) => {
    setIsSubmitting(true);

    try {
      // Procesar datos antes de enviar
      const processedData: any = {
        description: data.description,
        amount: data.amount,
        category: data.category,
        date: data.date,
      };

      // Agregar clientId solo si no es undefined
      if (data.clientId && data.clientId !== "none") {
        processedData.clientId = data.clientId;
      }

      // Si hay usuarios seleccionados, dividir el gasto entre ellos
      if (data.paidByUserIds && data.paidByUserIds.length > 0) {
        processedData.paidByUserIds = data.paidByUserIds;
        
        // Si hay más de un usuario, agregar indicador de gasto compartido
        if (data.paidByUserIds.length > 1) {
          processedData.description = `${data.description} (Compartido - ${data.paidByUserIds.length} personas)`;
        }
      }

      const result = await createExpense(processedData);

      if (result.success) {
        toast({
          title: "Gasto registrado",
          description: "El gasto se ha registrado correctamente.",
        });
        router.refresh();
        onOpenChange(false);
      } else {
        toast({
          variant: "destructive",
          title: "Error al registrar",
          description: result.error || "Ocurrió un error inesperado",
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error al registrar",
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto custom-scroll">
        <DialogHeader>
          <DialogTitle>Registrar Gasto</DialogTitle>
          <DialogDescription>
            Crea un nuevo registro de gasto para la agencia
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Descripción - Primer campo */}
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descripción</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Ej: Suscripción Adobe Creative Cloud"
                      className="text-2xl font-bold"
                      {...field}
                      onBlur={(e) => {
                        field.onBlur();
                        handleDescriptionBlur(e.currentTarget.value);
                      }}
                      disabled={isSubmitting}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Monto y Fecha - Grid 50/50 */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Monto</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-2xl font-bold text-muted-foreground dark:text-gray-400">$</span>
                        <Input
                          type="number"
                          step="0.01"
                          min="0.01"
                          placeholder="0.00"
                          className="pl-8 text-2xl font-bold"
                          {...field}
                          onChange={(e) =>
                            field.onChange(parseFloat(e.target.value) || 0)
                          }
                          disabled={isSubmitting}
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fecha</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        className="text-2xl font-bold"
                        value={
                          field.value
                            ? formatDateValue(field.value)
                            : formatDateValue(getCurrentDateInEcuador())
                        }
                        onChange={(e) => {
                          field.onChange(
                            e.target.value ? new Date(e.target.value) : getCurrentDateInEcuador()
                          );
                        }}
                        disabled={isSubmitting}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Categoría</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                    disabled={isSubmitting}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona la categoría" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="COMIDA">Comida</SelectItem>
                      <SelectItem value="TRANSPORTE">Transporte</SelectItem>
                      <SelectItem value="INVITACIONES">Invitaciones</SelectItem>
                      <SelectItem value="SOFTWARE">Software</SelectItem>
                      <SelectItem value="OFICINA">Oficina</SelectItem>
                      <SelectItem value="EQUIPOS">Equipos</SelectItem>
                      <SelectItem value="OTROS">Otros</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="clientId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Cliente (Opcional)</FormLabel>
                  <Select
                    onValueChange={(value) =>
                      field.onChange(value === "none" ? undefined : value)
                    }
                    value={field.value || "none"}
                    disabled={isSubmitting || loadingClients}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona un cliente (opcional)" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">Sin cliente</SelectItem>
                      {clients.map((client) => (
                        <SelectItem key={client.id} value={client.id}>
                          <div className="flex items-center gap-2">
                            <Avatar className="h-6 w-6">
                              <AvatarImage src={client.logo || undefined} alt={client.name} />
                              <AvatarFallback className="text-xs">
                                {client.name
                                  ?.split(' ')
                                  .map(n => n[0])
                                  .join('')
                                  .toUpperCase()
                                  .slice(0, 2) || '??'}
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

            <FormField
              control={form.control}
              name="paidByUserIds"
              render={({ field }) => (
                <FormItem>
                  <div className="space-y-3">
                    <FormLabel>Asignar a Usuarios (Para Reembolso)</FormLabel>
                    <p className="text-sm text-muted-foreground">
                      Selecciona uno o más usuarios. Si seleccionas múltiples, el monto se dividirá equitativamente.
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      {users.map((user) => {
                        const firstName = user.name?.split(' ')[0] || user.name;
                        const initials = user.name
                          ?.split(' ')
                          .map(n => n[0])
                          .join('')
                          .toUpperCase()
                          .slice(0, 2) || '??';
                        
                        return (
                          <div key={user.id} className="flex items-center space-x-2">
                            <Checkbox
                              id={`create-user-${user.id}`}
                              checked={field.value?.includes(user.id) || false}
                              onCheckedChange={(checked) => {
                                const currentValue = field.value || [];
                                if (checked) {
                                  field.onChange([...currentValue, user.id]);
                                } else {
                                  field.onChange(currentValue.filter((id) => id !== user.id));
                                }
                              }}
                              disabled={isSubmitting || loadingUsers}
                            />
                            <Label
                              htmlFor={`create-user-${user.id}`}
                              className="flex items-center gap-2 cursor-pointer flex-1"
                            >
                              <Avatar className="h-8 w-8">
                                <AvatarImage src={user.profileImage || undefined} alt={firstName} />
                                <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                              </Avatar>
                              <span className="text-sm font-normal truncate">{firstName}</span>
                            </Label>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex gap-4 pt-4">
              <Button
                type="submit"
                disabled={isSubmitting}
                className="flex-1"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Registrando...
                  </>
                ) : (
                  "Registrar Gasto"
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
