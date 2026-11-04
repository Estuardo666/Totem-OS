"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm, type Control } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import {
  updateExpenseSchema,
  type UpdateExpenseInput,
} from "@/schemas/finance";
import type { User, Client } from "@prisma/client";
import { updateExpense, getExpenseById } from "@/actions/finance-actions";
import { getUsers } from "@/actions/user.actions";
import { getClients } from "@/actions/client-actions";
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
import { ExpenseFormFields, type ExpenseFieldValues } from "./expense-form-fields";

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
  // Sufijo "(Compartido - N personas)" del gasto original: se oculta al editar
  // y se vuelve a poner al guardar, para que el gasto siga marcado como compartido.
  const [sharedSuffix, setSharedSuffix] = useState<string | null>(null);
  const [payerName, setPayerName] = useState<string | null>(null);

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
            
            // Un gasto compartido se guarda como una fila por persona; aquí se
            // edita solo esta fila (la parte de una persona).
            const sharedMatch = expense.description.match(/\(Compartido - \d+ personas\)/);
            setSharedSuffix(sharedMatch ? sharedMatch[0] : null);
            const baseDescription = expense.description
              .replace(/\s*\(Compartido - \d+ personas\)/g, "")
              .trim();
            const payer = usersResult.success && usersResult.data
              ? usersResult.data.find((user) => user.id === expense.paidByUserId)
              : undefined;
            setPayerName(payer?.name ?? null);

            form.reset({
              description: baseDescription,
              amount: expense.amount,
              category: expense.category as any,
              date: expense.date,
              paidByUserId: expense.paidByUserId || undefined,
              paidByUserIds: expense.paidByUserId ? [expense.paidByUserId] : [],
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
      const processedData = { ...data };

      // Asegurar que clientId sea undefined si es "none" o cadena vacía
      if (processedData.clientId === "none" || processedData.clientId === "") {
        processedData.clientId = undefined;
      }

      // Quién pagó no se cambia desde aquí (el servidor no lo guarda al editar).
      delete processedData.paidByUserId;
      delete processedData.paidByUserIds;

      if (sharedSuffix && processedData.description) {
        processedData.description = `${processedData.description.trim()} ${sharedSuffix}`;
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
            <ExpenseFormFields
              control={form.control as unknown as Control<ExpenseFieldValues>}
              users={users}
              clients={clients}
              disabled={isSubmitting || loadingExpense}
              loadingUsers={loadingUsers}
              loadingClients={loadingClients}
              payerNotice={
                <div className="space-y-1 rounded-lg bg-muted/40 p-3 text-sm" role="note">
                  <p className="font-medium">
                    {payerName ? `Pagado por ${payerName}` : "Pagado por la empresa"}
                  </p>
                  {sharedSuffix && (
                    <p className="text-muted-foreground">
                      Este gasto está dividido entre varias personas. Aquí cambias solo la parte de{" "}
                      {payerName ?? "esta persona"}.
                    </p>
                  )}
                  <p className="text-muted-foreground">
                    Para cambiar quién lo pagó, borra este gasto y vuelve a registrarlo.
                  </p>
                </div>
              }
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

