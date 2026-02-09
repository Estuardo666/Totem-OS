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

interface TransactionDialogProps {
  children?: React.ReactNode;
  defaultTab?: "income" | "expense" | "honorarios";
}

// Función helper para obtener la fecha actual en zona horaria de Ecuador (America/Guayaquil)
const getCurrentDateInEcuador = (): Date => {
  const now = new Date();
  // Obtener la fecha actual en zona horaria de Ecuador (UTC-5)
  const ecuadorTime = new Date(now.toLocaleString("en-US", { timeZone: "America/Guayaquil" }));
  // Resetear la hora a medianoche para evitar confusiones con UTC
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

export function TransactionDialog({ children, defaultTab }: TransactionDialogProps) {
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
  const [activeTab, setActiveTab] = useState<string>(isAdmin ? "income" : "expense");

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
      date: getCurrentDateInEcuador(),
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
            // Pre-seleccionar a Paty y Stuart en el formulario de gastos
            const patyAndStuart = usersResult.data
              .filter((user) => 
                user.name?.toLowerCase().includes("paty") || 
                user.name?.toLowerCase().includes("stuart")
              )
              .map((user) => user.id);
            
            if (patyAndStuart.length > 0) {
              expenseForm.setValue("paidByUserIds", patyAndStuart);
            }
          }
        })
        .finally(() => {
          setLoadingClients(false);
          setLoadingUsers(false);
        });
    }
  }, [open, expenseForm]);

  // Resetear formularios cuando se cierra el dialog
  useEffect(() => {
    if (!open) {
      incomeForm.reset();
      expenseForm.reset();
      honorariosForm.reset();
    }
  }, [open, incomeForm, expenseForm, honorariosForm]);

  // Handler para auto-detectar categoría cuando se sale del campo de descripción
  const handleExpenseDescriptionBlur = (descriptionValue: string) => {
    if (descriptionValue && descriptionValue.trim()) {
      const detectedCategory = detectCategory(descriptionValue);
      console.log("Detected category:", detectedCategory, "from description:", descriptionValue);
      expenseForm.setValue("category", detectedCategory);
    }
  };

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

  const resolvedDefaultTab = !isAdmin && defaultTab === "honorarios"
    ? "expense"
    : defaultTab ?? (isAdmin ? "income" : "expense");

  const triggerContent = children ?? (
    <Button variant="outline" className="gap-2">
      <Plus className="h-4 w-4" />
      Nueva Transacción
    </Button>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {triggerContent}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nueva Transacción</DialogTitle>
          <DialogDescription>
            Registra un ingreso o un gasto en el sistema
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue={resolvedDefaultTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className={`grid w-full h-12 items-center rounded-full bg-muted px-3 py-1 text-muted-foreground ${isAdmin ? "grid-cols-3" : "grid-cols-1"}`}>
            {isAdmin && <TabsTrigger value="income" className="rounded-full">Ingreso</TabsTrigger>}
            <TabsTrigger value="expense" className="rounded-full">Gasto</TabsTrigger>
            {isAdmin && <TabsTrigger value="honorarios" className="rounded-full">Honorarios</TabsTrigger>}
          </TabsList>

          {/* Tab de Ingreso - Solo visible para ADMIN */}
          {isAdmin && (
          <TabsContent value="income" className={activeTab === "income" ? "fade-in" : "fade-out"}>
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
                          value={formatDateValue(field.value as Date | string | undefined)}
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
          <TabsContent value="expense" className={activeTab === "expense" ? "fade-in" : "fade-out"}>
            <Form {...expenseForm}>
              <form
                onSubmit={expenseForm.handleSubmit(onExpenseSubmit)}
                className="space-y-4"
              >
                {/* Descripción - Primer campo */}
                <FormField
                  control={expenseForm.control}
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
                            handleExpenseDescriptionBlur(e.currentTarget.value);
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
                    control={expenseForm.control}
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
                    control={expenseForm.control}
                    name="date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Fecha</FormLabel>
                        <FormControl>
                          <Input
                            type="date"
                            className="text-2xl font-bold"
                            value={formatDateValue(field.value as Date | string | undefined) || formatDateValue(getCurrentDateInEcuador())}
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
                  control={expenseForm.control}
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
                      <p className="text-sm text-muted-foreground">
                        Vincula este gasto a un proyecto específico para análisis de rentabilidad
                      </p>
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
                                  className="flex items-center gap-2 cursor-pointer flex-1"
                                >
                                  <Avatar className="h-8 w-8">
                                    <AvatarImage src={user.image || undefined} alt={firstName} />
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
            <TabsContent value="honorarios" className={activeTab === "honorarios" ? "fade-in" : "fade-out"}>
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



