"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import { Wallet, Loader2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { getAvailableExpenseMonths, liquidateReimbursements } from "@/actions/finance-actions";
import { useToast } from "@/components/ui/use-toast";

interface ExpensesFiltersProps {
  users: Array<{ id: string; name: string }>;
  clients: Array<{ id: string; name: string }>;
  expenses: Array<{
    id: string;
    assignedToId?: string;
    status: string;
    reimbursed: boolean;
    date: Date | string;
  }>;
  onFilterChange: (filters: {
    month: string;
    userId: string;
    clientId: string;
    category: string;
  }) => void;
  onLiquidate?: () => void;
}

export function ExpensesFilters({
  users,
  clients,
  expenses,
  onFilterChange,
  onLiquidate,
}: ExpensesFiltersProps) {
  const { toast } = useToast();
  const [selectedMonth, setSelectedMonth] = useState<string>(
    format(new Date(), "yyyy-MM")
  );
  const [selectedUserId, setSelectedUserId] = useState<string>("all");
  const [selectedClientId, setSelectedClientId] = useState<string>("all");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [isLiquidating, setIsLiquidating] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [monthOptions, setMonthOptions] = useState<
    { value: string; label: string }[]
  >([]);

  // Cargar meses disponibles desde el backend
  useEffect(() => {
    getAvailableExpenseMonths()
      .then((result) => {
        if (result.success && result.data) {
          setMonthOptions(result.data);
        }
      })
      .catch(() => {
        // Fallback silencioso: dejar el mes actual
      });
  }, []);

  useEffect(() => {
    onFilterChange({
      month: selectedMonth === "all" ? "" : selectedMonth,
      userId: selectedUserId,
      clientId: selectedClientId,
      category: selectedCategory,
    });
  }, [selectedMonth, selectedUserId, selectedClientId, selectedCategory, onFilterChange]);

  // Verificar si hay gastos pendientes para el usuario seleccionado
  const selectedUser = users.find((u) => u.id === selectedUserId);
  const hasPendingExpenses = selectedUserId !== "all" && expenses.some(
    (exp) => exp.assignedToId === selectedUserId && 
    (exp.status === "PENDING" || !exp.reimbursed)
  );

  const handleLiquidate = async () => {
    if (!selectedUserId || selectedUserId === "all") return;

    setIsLiquidating(true);
    try {
      const result = await liquidateReimbursements([selectedUserId]);
      
      if (result.success) {
        toast({
          title: "Reembolsos liquidados",
          description: `Se han marcado ${result.data?.count || 0} gasto(s) como reembolsados.`,
        });
        setIsDialogOpen(false);
        if (onLiquidate) {
          onLiquidate();
        }
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: result.error || "No se pudieron liquidar los reembolsos",
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Ocurrió un error inesperado",
      });
    } finally {
      setIsLiquidating(false);
    }
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <div className="space-y-2">
            <Label>Mes</Label>
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger>
                <SelectValue placeholder="Todos los meses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los meses</SelectItem>
                {monthOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Usuario</Label>
            <div className="flex items-center gap-2">
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos los usuarios" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los usuarios</SelectItem>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedUserId !== "all" && hasPendingExpenses && (
                <AlertDialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="default"
                      size="sm"
                      className="bg-blue-600 hover:bg-blue-700 text-white whitespace-nowrap"
                      disabled={isLiquidating}
                    >
                      {isLiquidating ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <Wallet className="h-4 w-4 mr-1" />
                          Liquidar
                        </>
                      )}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>¿Liquidar todos los reembolsos?</AlertDialogTitle>
                      <AlertDialogDescription>
                        ¿Estás seguro de marcar todos los gastos de <strong>{selectedUser?.name}</strong> como reembolsados? Esta acción no se puede deshacer.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel disabled={isLiquidating}>Cancelar</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleLiquidate}
                        disabled={isLiquidating}
                        className="bg-blue-600 hover:bg-blue-700"
                      >
                        {isLiquidating ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Liquidando...
                          </>
                        ) : (
                          "Sí, liquidar"
                        )}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Cliente</Label>
            <Select value={selectedClientId} onValueChange={setSelectedClientId}>
              <SelectTrigger>
                <SelectValue placeholder="Todos los clientes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los clientes</SelectItem>
                {clients.map((client) => (
                  <SelectItem key={client.id} value={client.id}>
                    {client.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Categoría</Label>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger>
                <SelectValue placeholder="Todas las categorías" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las categorías</SelectItem>
                <SelectItem value="COMIDA">Comida</SelectItem>
                <SelectItem value="TRANSPORTE">Transporte</SelectItem>
                <SelectItem value="INVITACIONES">Invitaciones</SelectItem>
                <SelectItem value="SOFTWARE">Software</SelectItem>
                <SelectItem value="OFICINA">Oficina</SelectItem>
                <SelectItem value="EQUIPOS">Equipos</SelectItem>
                <SelectItem value="OTROS">Otros</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

