"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useSession } from "next-auth/react";
import { Loader2, Plus } from "lucide-react";
import {
  createInvoiceSchema,
  createExpenseSchema,
  createTransactionSchema,
  type CreateInvoiceInput,
  type CreateExpenseInput,
  type CreateTransactionInput,
} from "@/schemas/finance";
import type { Client, User } from "@prisma/client";
import { getClients } from "@/actions/client-actions";
import { getUsers } from "@/actions/user.actions";
import { createInvoice, createExpense, createTransaction } from "@/actions/finance-actions";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
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

interface TransactionDialogProps {
  children: React.ReactNode;
}

export function TransactionDialog({ children }: TransactionDialogProps) {
  const router = useRouter();
  const { toast } = useToast();
  const { data: session } = useSession();
  const userRole = session?.user?.role;
  const isAdmin = userRole === "ADMIN";
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loadingClients, setLoadingClients] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);

  // Formulario de Ingreso
  const incomeForm = useForm<CreateInvoiceInput>({
    resolver: zodResolver(createInvoiceSchema),
    defaultValues: {
      amount: 0,
      status: "PENDING",
      clientId: "",
      dueDate: undefined,
    },
  });

  // Formulario de Gasto
  const expenseForm = useForm<CreateExpenseInput>({
    resolver: zodResolver(createExpenseSchema),
    defaultValues: {
      description: "",
      amount: 0,
      category: "OTROS",
      date: new Date(),
      paidByUserId: undefined,
      paidByUserIds: [],
      clientId: undefined,
    },
  });

  // Formulario de Honorarios (solo ADMIN)
  const honorariosForm = useForm<CreateTransactionInput>({
    resolver: zodResolver(createTransactionSchema),
    defaultValues: {
      amount: 0,
      type: "HONORARIOS",
      status: "PAID",
      description: "",
      userId: undefined,
    },
  });

  // Cargar clientes y usuarios cuando se abre el dialog
  useEffect(() => {
    if (open) {
      setLoadingClients(true);
      setLoadingUsers(true);
      
      Promise.all([getClients(), getUsers()])
        .then(([clientsResult, usersResult]) => {
          if (clientsResult.success && clientsResult.data) {
            setClients(clientsResult.data);
          }
          if (usersResult.success && usersResult.data) {
            setUsers(usersResult.data);
          }
        })
        .finally(() => {
          setLoadingClients(false);
          setLoadingUsers(false);
        });
    }
  }, [open]);

  // Resetear formularios cuando se cierra el dialog
  useEffect(() => {
    if (!open) {
      incomeForm.reset();
      expenseForm.reset();
      honorariosForm.reset();
    }
  }, [open, incomeForm, expenseForm, honorariosForm]);

  const onIncomeSubmit = async (data: CreateInvoiceInput) => {
    setIsSubmitting(true);

    try {
      const result = await createInvoice(data);

      if (result.success) {
        toast({
          title: "Factura creada",
          description: "El ingreso se ha registrado correctamente.",
        });
        router.refresh();
        setOpen(false);
      } else {
        toast({
          variant: "destructive",
          title: "Error al crear factura",
          description: result.error || "Ocurrió un error inesperado",
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error al crear factura",
        description:
          error instanceof Error
            ? error.message
            : "Ocurrió un error inesperado",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const onExpenseSubmit = async (data: CreateExpenseInput) => {
    setIsSubmitting(true);

    try {
      const result = await createExpense(data);

      if (result.success) {
        toast({
          title: "Gasto creado",
          description: "El gasto se ha registrado correctamente.",
        });
        router.refresh();
        setOpen(false);
      } else {
        toast({
          variant: "destructive",
          title: "Error al crear gasto",
          description: result.error || "Ocurrió un error inesperado",
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error al crear gasto",
        description:
          error instanceof Error
            ? error.message
            : "Ocurrió un error inesperado",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const onHonorariosSubmit = async (data: CreateTransactionInput) => {
    setIsSubmitting(true);

    try {
      const result = await createTransaction(data);

      if (result.success) {
        toast({
          title: "Honorarios registrados",
          description: "La transacción de honorarios se ha registrado correctamente.",
        });
        router.refresh();
        setOpen(false);
      } else {
        toast({
          variant: "destructive",
          title: "Error al registrar honorarios",
          description: result.error || "Ocurrió un error inesperado",
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error al registrar honorarios",
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
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nueva Transacción</DialogTitle>
          <DialogDescription>
            Registra un ingreso o un gasto en el sistema
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue={isAdmin ? "income" : "expense"} className="w-full">
          <TabsList className={`grid w-full ${isAdmin ? "grid-cols-3" : "grid-cols-1"}`}>
            {isAdmin && <TabsTrigger value="income">Ingreso</TabsTrigger>}
            <TabsTrigger value="expense">Gasto</TabsTrigger>
            {isAdmin && <TabsTrigger value="honorarios">Honorarios</TabsTrigger>}
          </TabsList>

          {/* Tab de Ingreso - Solo visible para ADMIN */}
          {isAdmin && (
          <TabsContent value="income">
            <Form {...incomeForm}>
              <form
                onSubmit={incomeForm.handleSubmit(onIncomeSubmit)}
                className="space-y-4"
              >
                <FormField
                  control={incomeForm.control}
                  name="clientId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cliente</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                        disabled={isSubmitting || loadingClients}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecciona un cliente" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
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
                  control={incomeForm.control}
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
                          {...field}
                          onChange={(e) =>
                            field.onChange(parseFloat(e.target.value) || 0)
                          }
                          disabled={isSubmitting}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={incomeForm.control}
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
                            <SelectValue placeholder="Selecciona el estado" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="PAID">Pagada</SelectItem>
                          <SelectItem value="PENDING">Pendiente</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={incomeForm.control}
                  name="dueDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Fecha de Vencimiento (Opcional)</FormLabel>
                      <FormControl>
                        <Input
                          type="date"
                          value={
                            field.value
                              ? typeof field.value === "string"
                                ? field.value.split("T")[0]
                                : new Date(field.value).toISOString().split("T")[0]
                              : ""
                          }
                          onChange={(e) => {
                            field.onChange(
                              e.target.value ? new Date(e.target.value) : undefined
                            );
                          }}
                          disabled={isSubmitting}
                        />
                      </FormControl>
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
                        Guardando...
                      </>
                    ) : (
                      "Guardar Ingreso"
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setOpen(false)}
                    disabled={isSubmitting}
                  >
                    Cancelar
                  </Button>
                </div>
              </form>
            </Form>
          </TabsContent>
          )}

          {/* Tab de Gasto */}
          <TabsContent value="expense">
            <Form {...expenseForm}>
              <form
                onSubmit={expenseForm.handleSubmit(onExpenseSubmit)}
                className="space-y-4"
              >
                <FormField
                  control={expenseForm.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Categoría</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
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
                  control={expenseForm.control}
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
                      <p className="text-sm text-muted-foreground">
                        Vincula este gasto a un proyecto específico para análisis de rentabilidad
                      </p>
                    </FormItem>
                  )}
                />

                <FormField
                  control={expenseForm.control}
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
                  control={expenseForm.control}
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
                          {...field}
                          onChange={(e) =>
                            field.onChange(parseFloat(e.target.value) || 0)
                          }
                          disabled={isSubmitting}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={expenseForm.control}
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
                  control={expenseForm.control}
                  name="paidByUserIds"
                  render={({ field }) => (
                    <FormItem>
                      <div className="space-y-3">
                        <FormLabel>Asignar a Usuarios (Para Reembolso)</FormLabel>
                        <p className="text-sm text-muted-foreground">
                          Selecciona uno o más usuarios. Si seleccionas múltiples, el monto se dividirá equitativamente.
                        </p>
                        <div className="space-y-2">
                          {users.map((user) => (
                            <div key={user.id} className="flex items-center space-x-2">
                              <Checkbox
                                id={`user-${user.id}`}
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
                                htmlFor={`user-${user.id}`}
                                className="text-sm font-normal cursor-pointer"
                              >
                                {user.name}
                              </Label>
                            </div>
                          ))}
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
                        Guardando...
                      </>
                    ) : (
                      "Guardar Gasto"
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setOpen(false)}
                    disabled={isSubmitting}
                  >
                    Cancelar
                  </Button>
                </div>
              </form>
            </Form>
          </TabsContent>

          {/* Tab de Honorarios (solo ADMIN) */}
          {isAdmin && (
            <TabsContent value="honorarios">
              <Form {...honorariosForm}>
                <form
                  onSubmit={honorariosForm.handleSubmit(onHonorariosSubmit)}
                  className="space-y-4"
                >
                  <FormField
                    control={honorariosForm.control}
                    name="userId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Usuario</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                          disabled={isSubmitting || loadingUsers}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecciona un usuario" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {users.map((user) => (
                              <SelectItem key={user.id} value={user.id}>
                                {user.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                        <p className="text-sm text-muted-foreground">
                          Selecciona el usuario que recibirá el pago de honorarios
                        </p>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={honorariosForm.control}
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
                            {...field}
                            onChange={(e) =>
                              field.onChange(parseFloat(e.target.value) || 0)
                            }
                            disabled={isSubmitting}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={honorariosForm.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Descripción (Opcional)</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Ej: Pago de honorarios mensual"
                            {...field}
                            disabled={isSubmitting}
                          />
                        </FormControl>
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
                          Guardando...
                        </>
                      ) : (
                        "Registrar Honorarios"
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setOpen(false)}
                      disabled={isSubmitting}
                    >
                      Cancelar
                    </Button>
                  </div>
                </form>
              </Form>
            </TabsContent>
          )}
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}



