"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
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
import {
  createExpenseSchema,
  type CreateExpenseInput,
} from "@/schemas/finance";
import { OptimizedAvatar } from "@/components/ui/optimized-avatar";
import { UserList } from "./user-list-row";
import {
  buildDefaultAllocationValues,
  buildEqualAmountAllocationValues,
  calculateExpenseAllocations,
  detectCategory,
  detectClientByDescription,
  EXPENSE_SPLIT_OPTIONS,
  getAllocationDisplayValue,
} from "./expense-form-utils";
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

interface CreateExpenseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function CreateExpenseDialogComponent({
  open,
  onOpenChange,
}: CreateExpenseDialogProps) {
  const router = useRouter();
  const { data: session } = useSession();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadingClients, setLoadingClients] = useState(false);
  const [expenseAllocationValues, setExpenseAllocationValues] = useState<Record<string, string>>({});
  const [clientQuery, setClientQuery] = useState("");
  const [categoryManuallySelected, setCategoryManuallySelected] = useState(false);
  const [clientManuallySelected, setClientManuallySelected] = useState(false);

  const form = useForm<CreateExpenseInput>({
    resolver: zodResolver(createExpenseSchema),
    defaultValues: {
      description: "",
      amount: 0,
      category: "OTROS",
      date: getCurrentDateInEcuador(),
      paidByUserId: undefined,
      paidByUserIds: [],
      clientId: undefined,
      splitMode: "EQUALLY",
      allocations: [],
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
          const sessionUser = usersResult.data.find((user) => user.id === session?.user?.id);
          const defaultExpenseUsers = usersResult.data.filter((user) => {
            const normalizedEmail = user.email?.trim().toLowerCase() ?? "";
            return normalizedEmail === "totemcisnemedia@gmail.com"
              || normalizedEmail === "estuarlito@gmail.com";
          });
          const defaultExpenseUserIds = defaultExpenseUsers.length > 0
            ? defaultExpenseUsers.map((user) => user.id)
            : sessionUser
              ? [sessionUser.id]
              : [];

          if (sessionUser) {
            form.setValue("paidByUserId", sessionUser.id);
          }
          form.setValue("paidByUserIds", defaultExpenseUserIds);
        }
        if (clientsResult.success && clientsResult.data) {
          setClients(clientsResult.data);
        }
      })
      .finally(() => {
        setLoadingUsers(false);
        setLoadingClients(false);
      });
  }, [form, session?.user?.id]); // Solo se ejecuta al montar el componente

  // Handler para auto-detectar categoría cuando se sale del campo de descripción
  const handleDescriptionBlur = (descriptionValue: string) => {
    if (descriptionValue && descriptionValue.trim()) {
      if (!categoryManuallySelected) {
        const detectedCategory = detectCategory(descriptionValue) as CreateExpenseInput["category"];
        form.setValue("category", detectedCategory);
      }

      if (!clientManuallySelected) {
        const detectedClient = detectClientByDescription(descriptionValue, clients);
        form.setValue("clientId", detectedClient?.id);
        setClientQuery(detectedClient?.name ?? "");
      }
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
        paidByUserId: session?.user?.id,
        paidByUserIds: session?.user?.id ? [session.user.id] : [],
        clientId: undefined,
        splitMode: "EQUALLY",
        allocations: [],
      });
      setExpenseAllocationValues({});
      setClientQuery("");
      setCategoryManuallySelected(false);
      setClientManuallySelected(false);
    }
  }, [form, open, session?.user?.id]);

  const selectedUserIds = form.watch("paidByUserIds") ?? [];
  const splitMode = form.watch("splitMode") ?? "EQUALLY";
  const amountValue = form.watch("amount") ?? 0;
  const allocationPreview = useMemo(
    () =>
      calculateExpenseAllocations({
        splitMode,
        totalAmount: amountValue,
        selectedUserIds,
        allocationValues: expenseAllocationValues,
      }),
    [amountValue, expenseAllocationValues, selectedUserIds, splitMode]
  );

  useEffect(() => {
    setExpenseAllocationValues((currentValues) => {
      const nextValues = buildDefaultAllocationValues(selectedUserIds);

      selectedUserIds.forEach((userId) => {
        if (currentValues[userId] !== undefined) {
          nextValues[userId] = currentValues[userId];
        }
      });

      return nextValues;
    });

    if (selectedUserIds.length <= 1 && splitMode !== "EQUALLY") {
      form.setValue("splitMode", "EQUALLY");
    }
  }, [form, selectedUserIds, splitMode]);

  useEffect(() => {
    if (splitMode !== "AS_AMOUNTS") {
      return;
    }

    setExpenseAllocationValues((currentValues) => {
      const equalValues = buildEqualAmountAllocationValues({
        totalAmount: amountValue,
        selectedUserIds,
      });

      const hasAnyCustomValue = selectedUserIds.some((userId) => {
        const currentValue = currentValues[userId];
        return currentValue !== undefined && currentValue !== "";
      });

      if (!hasAnyCustomValue) {
        return equalValues;
      }

      const nextValues = { ...currentValues };

      selectedUserIds.forEach((userId) => {
        if (nextValues[userId] === undefined || nextValues[userId] === "") {
          nextValues[userId] = equalValues[userId] ?? "";
        }
      });

      return nextValues;
    });
  }, [amountValue, selectedUserIds, splitMode]);

  const onSubmit = async (data: CreateExpenseInput) => {
    setIsSubmitting(true);

    try {
      const allocationsResult = calculateExpenseAllocations({
        splitMode: data.splitMode ?? "EQUALLY",
        totalAmount: data.amount,
        selectedUserIds: data.paidByUserIds ?? [],
        allocationValues: expenseAllocationValues,
      });

      if (allocationsResult.error) {
        toast({
          variant: "destructive",
          title: "Split inválido",
          description: allocationsResult.error,
        });
        return;
      }

      const result = await createExpense({
        ...data,
        allocations: allocationsResult.allocations,
      });

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
                          inputMode="decimal"
                          value={field.value === 0 ? "" : field.value ?? ""}
                          onChange={(e) => {
                            if (e.target.value === "") {
                              field.onChange(0);
                            } else {
                              field.onChange(parseFloat(e.target.value) || 0);
                            }
                          }}
                          onFocus={() => {
                            if (field.value === 0) {
                              field.onChange(0);
                            }
                          }}
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
                        type="text"
                        inputMode="numeric"
                        placeholder="YYYY-MM-DD"
                        className="text-base"
                        value={field.value ? formatDateValue(field.value) : formatDateValue(getCurrentDateInEcuador())}
                        onChange={(e) => {
                          const nextValue = e.target.value;

                          if (!nextValue) {
                            field.onChange(getCurrentDateInEcuador());
                            return;
                          }

                          const parsedDate = /^\d{4}-\d{2}-\d{2}$/.test(nextValue)
                            ? new Date(`${nextValue}T00:00:00`)
                            : field.value;

                          field.onChange(parsedDate);
                        }}
                        disabled={isSubmitting}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Categoría</FormLabel>
                    <Select
                      onValueChange={(value) => {
                        setCategoryManuallySelected(true);
                        field.onChange(value as CreateExpenseInput["category"]);
                      }}
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
                      onValueChange={(value) => {
                        setClientManuallySelected(true);
                        field.onChange(value === "none" ? undefined : value);
                        const selectedClient = clients.find((client) => client.id === value);
                        setClientQuery(selectedClient?.name ?? "");
                      }}
                      value={field.value || "none"}
                      disabled={isSubmitting || loadingClients}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona un cliente (opcional)" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <div className="p-2">
                          <Input
                            placeholder="Buscar cliente..."
                            value={clientQuery}
                            onChange={(event) => setClientQuery(event.target.value)}
                            onKeyDown={(event) => event.stopPropagation()}
                            disabled={loadingClients}
                          />
                        </div>
                        <SelectItem value="none">Sin cliente</SelectItem>
                        {clients
                          .filter((client) =>
                            client.name
                              ?.toLowerCase()
                              .includes(clientQuery.trim().toLowerCase())
                          )
                          .map((client) => {
                            const initials = client.name
                              ?.split(" ")
                              .map((n) => n[0])
                              .join("")
                              .toUpperCase()
                              .slice(0, 2) || "??";

                            return (
                              <SelectItem key={client.id} value={client.id}>
                                <div className="flex items-center gap-2">
                                  <OptimizedAvatar
                                    src={client.logo}
                                    alt={client.name}
                                    fallback={initials}
                                    size="sm"
                                  />
                                  <span>{client.name}</span>
                                </div>
                              </SelectItem>
                            );
                          })}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="paidByUserId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Pagado por</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                    disabled={isSubmitting || loadingUsers}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona quién pagó" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {users.map((user) => {
                        const initials = user.name
                          ?.split(" ")
                          .map((n) => n[0])
                          .join("")
                          .toUpperCase()
                          .slice(0, 2) || "??";

                        return (
                          <SelectItem key={`create-expense-paid-by-${user.id}`} value={user.id}>
                            <div className="flex items-center gap-2">
                              <OptimizedAvatar
                                src={user.image}
                                alt={user.name ?? "Usuario"}
                                fallback={initials}
                                size="sm"
                              />
                              <span>{user.name}</span>
                            </div>
                          </SelectItem>
                        );
                      })}
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
                    <FormLabel>Dividido entre</FormLabel>
                    <div className="space-y-2">
                        <FormLabel>Modo de división</FormLabel>
                        <div className="max-w-xs">
                        <Select
                          onValueChange={(value) => {
                            const nextSplitMode = value as CreateExpenseInput["splitMode"];
                            form.setValue("splitMode", nextSplitMode);

                            if (nextSplitMode === "AS_AMOUNTS") {
                              setExpenseAllocationValues(
                                buildEqualAmountAllocationValues({
                                  totalAmount: amountValue,
                                  selectedUserIds,
                                })
                              );
                            }
                          }}
                          value={splitMode}
                          disabled={isSubmitting || selectedUserIds.length <= 1}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecciona el split" />
                          </SelectTrigger>
                          <SelectContent>
                            {EXPENSE_SPLIT_OPTIONS.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
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
                      splitMode={splitMode}
                      allocationValues={expenseAllocationValues}
                      allocationLabels={Object.fromEntries(
                        selectedUserIds.map((userId) => [
                          userId,
                          getAllocationDisplayValue({
                            splitMode,
                            userId,
                            allocations: allocationPreview.allocations,
                            fallbackAmount: amountValue,
                          }),
                        ])
                      )}
                      onAllocationChange={(userId, value) => {
                        setExpenseAllocationValues((currentValues) => ({
                          ...currentValues,
                          [userId]: value,
                        }));
                      }}
                    />
                    {allocationPreview.error ? (
                      <p className="text-sm text-destructive">{allocationPreview.error}</p>
                    ) : null}
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

/**
 * Exported component wrapped with React.memo
 * Evita re-renders cuando props no cambian
 */
export const CreateExpenseDialog = React.memo(CreateExpenseDialogComponent);
