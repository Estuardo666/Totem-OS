"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import {
  updateExpenseSchema,
  type UpdateExpenseInput,
} from "@/schemas/finance";
import type { Expense, User, Client } from "@prisma/client";
import { updateExpense, getExpenseById } from "@/actions/finance-actions";
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
import { UserList } from "./user-list-row";

interface EditExpenseDialogProps {
  expenseId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditExpenseDialog({
  expenseId,
  open,
  onOpenChange,
}: EditExpenseDialogProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadingExpense, setLoadingExpense] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadingClients, setLoadingClients] = useState(false);
  const [isSharedExpense, setIsSharedExpense] = useState(false);
  const [totalAmount, setTotalAmount] = useState(0);
  const [numPeople, setNumPeople] = useState(1);

  const form = useForm<UpdateExpenseInput>({
    resolver: zodResolver(updateExpenseSchema),
    defaultValues: {
      description: "",
      amount: 0,
      category: "OTROS",
      date: new Date(),
      paidByUserIds: [],
      clientId: undefined,
    },
  });

  // Cargar datos cuando se abre el dialog
  useEffect(() => {
    if (open && expenseId) {
      setLoadingExpense(true);
      setLoadingUsers(true);
      setLoadingClients(true);

      Promise.all([
        getExpenseById(expenseId),
        getUsers(),
        getClients(),
      ])
        .then(([expenseResult, usersResult, clientsResult]) => {
          if (expenseResult.success && expenseResult.data) {
            const expense = expenseResult.data;
            
            // Detectar si es un gasto compartido
            const sharedMatch = expense.description.match(/\(Compartido - (\d+) personas\)/);
            const isShared = !!sharedMatch;
            
            // Usar relatedUserIds del servidor para obtener el número real de personas
            const relatedUserIds = (expense as any).relatedUserIds || (expense.paidByUserId ? [expense.paidByUserId] : []);
            // El número de personas debe ser la longitud de relatedUserIds, no el número en la descripción
            const peopleCount = relatedUserIds.length > 0 ? relatedUserIds.length : (isShared ? parseInt(sharedMatch[1]) : 1);
            
            setIsSharedExpense(isShared);
            setNumPeople(peopleCount);
            
            // Si es compartido, usar el totalAmount del servidor (suma de todos los gastos relacionados)
            // Si no está disponible, calcular como fallback usando el número real de personas
            const total = (expense as any).totalAmount || (isShared ? expense.amount * peopleCount : expense.amount);
            setTotalAmount(total);
            
            // Extraer la descripción base (sin el sufijo de compartido)
            const baseDescription = isShared 
              ? expense.description.replace(/\s*\(Compartido - \d+ personas\)/g, "").trim()
              : expense.description;
            
            form.reset({
              description: baseDescription,
              amount: total, // Mostrar el monto total en el formulario
              category: expense.category as any,
              date: expense.date,
              paidByUserId: expense.paidByUserId || undefined,
              paidByUserIds: relatedUserIds, // Incluir todos los usuarios relacionados si es compartido
              clientId: expense.clientId || undefined,
            });
          }
          if (usersResult.success && usersResult.data) {
            setUsers(usersResult.data);
          }
          if (clientsResult.success && clientsResult.data) {
            setClients(clientsResult.data);
          }
        })
        .finally(() => {
          setLoadingExpense(false);
          setLoadingUsers(false);
          setLoadingClients(false);
        });
    }
  }, [open, expenseId, form]);

  // Resetear formulario cuando se cierra
  useEffect(() => {
    if (!open) {
      form.reset();
    }
  }, [open, form]);

  const onSubmit = async (data: UpdateExpenseInput) => {
    if (!expenseId) return;

    setIsSubmitting(true);

    try {
      // Si es un gasto compartido y se cambió el monto, el monto en el formulario es el TOTAL
      // Necesitamos calcular el monto por persona antes de enviarlo
      let processedData = { ...data };
      
      // Asegurar que clientId sea undefined si es "none" o cadena vacía
      if (processedData.clientId === "none" || processedData.clientId === "") {
        processedData.clientId = undefined;
      }
      
      if (isSharedExpense && data.amount !== undefined && numPeople > 1) {
        // El monto en el formulario es el total, calcular el monto por persona
        const amountPerPerson = Math.round((data.amount / numPeople) * 100) / 100;
        processedData.amount = amountPerPerson;
      }
      
      const result = await updateExpense(expenseId, processedData);

      if (result.success) {
        toast({
          title: "Gasto actualizado",
          description: "El gasto se ha actualizado correctamente.",
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto custom-scroll">
        <DialogHeader>
          <DialogTitle>Editar Gasto</DialogTitle>
          <DialogDescription>
            Modifica los detalles del gasto
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descripción</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Ej: Suscripción Adobe Creative Cloud"
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
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Monto ($)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      min="0.01"
                      placeholder="0.00"
                      value={field.value === 0 ? "" : field.value ?? ""}
                      onChange={(e) => {
                        // Permitir borrar completamente
                        if (e.target.value === "") {
                          field.onChange(undefined);
                        } else {
                          field.onChange(parseFloat(e.target.value) || 0);
                        }
                      }}
                      onFocus={(e) => {
                        if (field.value === 0) {
                          field.onChange(undefined);
                          e.target.value = "";
                        }
                      }}
                      inputMode="decimal"
                      disabled={isSubmitting}
                    />
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
                      value={
                        field.value
                          ? typeof field.value === "string"
                            ? field.value.split("T")[0]
                            : new Date(field.value).toISOString().split("T")[0]
                          : new Date().toISOString().split("T")[0]
                      }
                      onChange={(e) => {
                        field.onChange(
                          e.target.value ? new Date(e.target.value) : new Date()
                        );
                      }}
                      disabled={isSubmitting}
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
                          {client.name}
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
                    <UserList
                      users={users}
                      selectedIds={field.value || []}
                      isLoading={isSubmitting || loadingUsers}
                      onChange={(userId) => {
                        const currentValue = field.value || [];
                        if (currentValue.includes(userId)) {
                          field.onChange(currentValue.filter((id) => id !== userId));
                        } else {
                          field.onChange([...currentValue, userId]);
                        }
                      }}
                    />
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex gap-4 pt-4">
              <Button
                type="submit"
                disabled={isSubmitting || loadingExpense}
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

