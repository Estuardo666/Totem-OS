"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import {
  updateTransactionSchema,
  type UpdateTransactionInput,
} from "@/schemas/finance";
import { updateTransaction } from "@/actions/finance-actions";
import { getUsers } from "@/actions/user.actions";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

// Tipo extendido para transacción con datos del usuario
interface TransactionWithUser {
  id: string;
  amount: number;
  type: string;
  status: string;
  description: string | null;
  userId: string | null;
  relatedClientId: string | null;
  user?: {
    id: string;
    name: string | null;
    image: string | null;
  } | null;
}

interface User {
  id: string;
  name: string | null;
  image: string | null;
}

interface EditHonorarioDialogProps {
  transaction: TransactionWithUser | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditHonorarioDialog({
  transaction,
  open,
  onOpenChange,
}: EditHonorarioDialogProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [amountInput, setAmountInput] = useState("");
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const form = useForm<UpdateTransactionInput>({
    resolver: zodResolver(updateTransactionSchema),
    defaultValues: {
      amount: 0,
      type: "HONORARIOS",
      status: "PENDING",
      description: "",
    },
  });

  // Cargar usuarios cuando se abre el dialog
  useEffect(() => {
    if (open) {
      getUsers()
        .then((result) => {
          if (result.success && result.data) {
            setUsers(result.data);
          }
        });
    }
  }, [open]);

  // Resetear formulario cuando cambia la transacción
  useEffect(() => {
    if (transaction && open) {
      console.log("📝 Precargando datos del honorario:", transaction);
      console.log("   - ID:", transaction.id);
      console.log("   - Amount:", transaction.amount, "Type:", typeof transaction.amount);
      console.log("   - UserId:", transaction.userId, "Type:", typeof transaction.userId);
      console.log("   - Status:", transaction.status);
      console.log("   - Description:", transaction.description);
      console.log("   - User object:", transaction.user);
      
      const status = (transaction.status === "PAID" 
        ? "PAID" 
        : transaction.status === "CANCELLED" 
        ? "CANCELLED" 
        : "PENDING") as "PENDING" | "PAID" | "CANCELLED";
      
      const amount = typeof transaction.amount === "number" ? transaction.amount : 0;
      
      form.reset({
        amount,
        type: "HONORARIOS",
        status,
        description: transaction.description || "",
      });
      
      setAmountInput(amount.toString());
      setSelectedUserId(transaction.userId || null);
      
      console.log("✅ Datos cargados - Monto:", amount, "Usuario:", transaction.userId, "Estado:", status);
    }
  }, [transaction, open, form]);

  const onSubmit = async (data: UpdateTransactionInput) => {
    if (!transaction) return;

    if (!selectedUserId) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Debes seleccionar un usuario",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await updateTransaction(transaction.id, {
        ...data,
        type: "HONORARIOS",
        userId: selectedUserId,
      });

      if (result.success) {
        toast({
          title: "Honorario actualizado",
          description: "Los cambios han sido guardados exitosamente.",
        });
        router.refresh();
        onOpenChange(false);
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: result.error || "No se pudo actualizar el honorario",
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Ocurrió un error inesperado",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Editar Honorario</DialogTitle>
        </DialogHeader>

        {transaction && (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {/* Usuarios */}
              <FormItem>
                <div className="space-y-3">
                  <FormLabel>Usuario</FormLabel>
                  <p className="text-sm text-muted-foreground">
                    Selecciona el usuario que recibe el honorario.
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    {users.map((user) => {
                      const firstName = user.name?.split(" ")[0] || user.name;
                      const initials = user.name
                        ?.split(" ")
                        .map((n) => n[0])
                        .join("")
                        .toUpperCase()
                        .slice(0, 2) || "??";

                      const checked = selectedUserId === user.id;

                      return (
                        <div key={user.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={`honorarios-user-${user.id}`}
                            checked={checked}
                            onCheckedChange={(value) => {
                              if (value) {
                                setSelectedUserId(user.id);
                              } else {
                                setSelectedUserId(null);
                              }
                            }}
                            disabled={isSubmitting}
                          />
                          <Label
                            htmlFor={`honorarios-user-${user.id}`}
                            className="flex items-center gap-2 cursor-pointer flex-1"
                          >
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={user.image || undefined} alt={firstName || "Usuario"} />
                              <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                            </Avatar>
                            <span className="text-sm font-normal truncate">{firstName}</span>
                          </Label>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </FormItem>

              {/* Monto */}
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
                        inputMode="decimal"
                        className="text-2xl font-bold"
                        value={amountInput}
                        onChange={(e) => {
                          setAmountInput(e.target.value);
                          field.onChange(parseFloat(e.target.value) || 0);
                        }}
                        onBlur={(e) => {
                          field.onBlur();
                          if (e.target.value === "") {
                            setAmountInput("0");
                            field.onChange(0);
                          } else {
                            const value = parseFloat(e.target.value) || 0;
                            field.onChange(value);
                          }
                        }}
                        onFocus={() => {
                          if (amountInput === "0") {
                            setAmountInput("");
                          }
                        }}
                        disabled={isSubmitting}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Descripción */}
              <FormField
                control={form.control}
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
        )}
      </DialogContent>
    </Dialog>
  );
}
