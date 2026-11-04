"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm, type Control } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { z } from "zod";
import type { CreateExpenseInput as FinanceCreateExpenseInput } from "@/schemas/finance";
import { createExpense } from "@/actions/finance-actions";
import { getUsers } from "@/actions/user.actions";
import { getClients } from "@/actions/client-actions";
import type {
  OfflineClientOption,
  OfflineUserOption,
} from "@/lib/finance-offline-types";
import {
  buildFinanceOfflineQueueId,
  cacheFinanceClients,
  cacheFinanceUsers,
  enqueueFinanceAction,
  getCachedFinanceClients,
  getCachedFinanceUsers,
} from "@/lib/finance-offline-store";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Form } from "@/components/ui/form";
import { ExpenseFormFields, todayExpenseDate, type ExpenseFieldValues } from "./expense-form-fields";
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

type CreateExpenseFormInput = z.infer<typeof createExpenseSchema>;

interface CreateExpenseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function CreateExpenseDialogComponent({
  open,
  onOpenChange,
}: CreateExpenseDialogProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [users, setUsers] = useState<OfflineUserOption[]>([]);
  const [clients, setClients] = useState<OfflineClientOption[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadingClients, setLoadingClients] = useState(false);

  const form = useForm<CreateExpenseFormInput>({
    resolver: zodResolver(createExpenseSchema),
    defaultValues: {
      description: "",
      amount: 0,
      category: "OTROS",
      date: todayExpenseDate(),
      paidByUserIds: [],
      clientId: undefined,
    },
  });

  // Cargar usuarios y clientes solo una vez al montar el componente
  useEffect(() => {
    const cachedUsers = getCachedFinanceUsers();
    if (cachedUsers.length > 0) {
      setUsers(cachedUsers);
    }

    const cachedClients = getCachedFinanceClients();
    if (cachedClients.length > 0) {
      setClients(cachedClients);
    }

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      return;
    }

    setLoadingUsers(true);
    setLoadingClients(true);

    Promise.all([getUsers(), getClients()])
      .then(([usersResult, clientsResult]) => {
        if (usersResult.success && usersResult.data) {
          const nextUsers = usersResult.data.map((user) => ({
            id: user.id,
            name: user.name,
            image: "image" in user ? user.image ?? null : null,
          }));
          setUsers(nextUsers);
          cacheFinanceUsers(nextUsers);
        }
        if (clientsResult.success && clientsResult.data) {
          const nextClients = clientsResult.data.map((client) => ({
            id: client.id,
            name: client.name,
            logo: client.logo ?? null,
            monthlyRate: client.monthlyRate ?? 0,
          }));
          setClients(nextClients);
          cacheFinanceClients(nextClients);
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
      form.setValue("category", detectedCategory as any);
    }
  };

  // Resetear formulario cuando se cierra
  useEffect(() => {
    if (!open) {
      form.reset({
        description: "",
        amount: 0,
        category: "OTROS",
        date: todayExpenseDate(),
        paidByUserIds: [],
        clientId: undefined,
      });
    }
  }, [open, form]);

  const onSubmit = async (data: CreateExpenseFormInput) => {
    setIsSubmitting(true);

    try {
      // Procesar datos antes de enviar
      const processedData: FinanceCreateExpenseInput = {
        description: data.description,
        amount: data.amount,
        category: data.category,
        date: data.date,
        reimbursed: false,
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

      if (typeof navigator !== "undefined" && !navigator.onLine) {
        enqueueFinanceAction({
          id: buildFinanceOfflineQueueId("expense"),
          kind: "CREATE_EXPENSE",
          createdAt: new Date().toISOString(),
          payload: processedData,
        });

        toast({
          title: "Gasto guardado offline",
          description: "Se sincronizará automáticamente cuando vuelva la conexión.",
        });
        onOpenChange(false);
        return;
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
            <ExpenseFormFields
              control={form.control as unknown as Control<ExpenseFieldValues>}
              users={users}
              clients={clients}
              disabled={isSubmitting}
              loadingUsers={loadingUsers}
              loadingClients={loadingClients}
              onDescriptionBlur={handleDescriptionBlur}
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

/**
 * Exported component wrapped with React.memo
 * Evita re-renders cuando props no cambian
 */
export const CreateExpenseDialog = React.memo(CreateExpenseDialogComponent);
