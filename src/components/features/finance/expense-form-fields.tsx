"use client";

import type { Control } from "react-hook-form";
import { Input } from "@/components/ui/input";
import {
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
import { OptimizedAvatar } from "@/components/ui/optimized-avatar";
import { UserList } from "./user-list-row";

/** Campos comunes de "Registrar gasto" y "Editar gasto". */
export interface ExpenseFieldValues {
  description: string;
  amount: number;
  category: string;
  date: Date;
  clientId?: string;
  paidByUserIds?: string[];
}

export interface ExpenseFormUser {
  id: string;
  name: string;
  image: string | null;
}

export interface ExpenseFormClient {
  id: string;
  name: string;
  logo?: string | null;
}

const ECUADOR_OFFSET_MS = 5 * 60 * 60 * 1000;

function isUtcMidnight(date: Date) {
  return (
    date.getUTCHours() === 0 &&
    date.getUTCMinutes() === 0 &&
    date.getUTCSeconds() === 0 &&
    date.getUTCMilliseconds() === 0
  );
}

/**
 * Valor "AAAA-MM-DD" para el campo de fecha. Una fecha de calendario
 * (medianoche UTC) se muestra tal cual; un momento real, en hora de Ecuador.
 * Así el día no "retrocede" uno al verlo desde Ecuador.
 */
export function toExpenseDateInputValue(
  value: Date | string | undefined | null,
) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const shown = isUtcMidnight(date)
    ? date
    : new Date(date.getTime() - ECUADOR_OFFSET_MS);
  return shown.toISOString().slice(0, 10);
}

/** Hoy en Ecuador, guardado como fecha de calendario (medianoche UTC). */
export function todayExpenseDate() {
  return new Date(
    `${new Date(Date.now() - ECUADOR_OFFSET_MS).toISOString().slice(0, 10)}T00:00:00Z`,
  );
}

/** "AAAA-MM-DD" → fecha de calendario (medianoche UTC). */
export function fromExpenseDateInputValue(value: string) {
  return value ? new Date(`${value}T00:00:00Z`) : todayExpenseDate();
}

const CATEGORY_OPTIONS = [
  ["COMIDA", "Comida"],
  ["TRANSPORTE", "Transporte"],
  ["INVITACIONES", "Invitaciones"],
  ["SOFTWARE", "Software"],
  ["OFICINA", "Oficina"],
  ["EQUIPOS", "Equipos"],
  ["OTROS", "Otros"],
] as const;

function initialsOf(name: string | null | undefined) {
  return (
    name
      ?.split(" ")
      .map((part) => part[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "??"
  );
}

interface ExpenseFormFieldsProps {
  control: Control<ExpenseFieldValues>;
  users: ExpenseFormUser[];
  clients: ExpenseFormClient[];
  disabled: boolean;
  loadingUsers: boolean;
  loadingClients: boolean;
  /** Se llama al salir de la descripción (p. ej. para sugerir la categoría). */
  onDescriptionBlur?: (description: string) => void;
}

export function ExpenseFormFields({
  control,
  users,
  clients,
  disabled,
  loadingUsers,
  loadingClients,
  onDescriptionBlur,
}: ExpenseFormFieldsProps) {
  return (
    <>
      <FormField
        control={control}
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
                  onDescriptionBlur?.(e.currentTarget.value);
                }}
                disabled={disabled}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <div className="grid grid-cols-2 gap-4">
        <FormField
          control={control}
          name="amount"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Monto</FormLabel>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-2xl font-bold text-muted-foreground dark:text-gray-400">
                  $
                </span>
                <FormControl>
                  <Input
                    type="number"
                    step="0.01"
                    min="0.01"
                    placeholder="0.00"
                    className="pl-8 text-2xl font-bold"
                    inputMode="decimal"
                    value={field.value === 0 ? "" : (field.value ?? "")}
                    onChange={(e) => {
                      field.onChange(
                        e.target.value === ""
                          ? undefined
                          : parseFloat(e.target.value) || 0,
                      );
                    }}
                    onFocus={(e) => {
                      if (field.value === 0) {
                        field.onChange(undefined);
                        e.currentTarget.value = "";
                      }
                    }}
                    disabled={disabled}
                  />
                </FormControl>
              </div>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={control}
          name="date"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Fecha</FormLabel>
              <FormControl>
                <Input
                  type="date"
                  className="text-2xl font-bold"
                  value={toExpenseDateInputValue(
                    field.value ?? todayExpenseDate(),
                  )}
                  onChange={(e) =>
                    field.onChange(fromExpenseDateInputValue(e.target.value))
                  }
                  disabled={disabled}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <FormField
        control={control}
        name="category"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Categoría</FormLabel>
            <Select
              onValueChange={field.onChange}
              value={field.value}
              disabled={disabled}
            >
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona la categoría" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {CATEGORY_OPTIONS.map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={control}
        name="clientId"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Cliente (Opcional)</FormLabel>
            <Select
              onValueChange={(value) =>
                field.onChange(value === "none" ? undefined : value)
              }
              value={field.value || "none"}
              disabled={disabled || loadingClients}
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
                      <OptimizedAvatar
                        src={client.logo ?? null}
                        alt={client.name}
                        fallback={initialsOf(client.name)}
                        size="sm"
                      />
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
        control={control}
        name="paidByUserIds"
        render={({ field }) => (
          <FormItem>
            <div className="space-y-3">
              <FormLabel>Asignar a Usuarios (Para Reembolso)</FormLabel>
              <p className="text-sm text-muted-foreground">
                Selecciona uno o más usuarios. Si seleccionas múltiples, el
                monto se dividirá equitativamente.
              </p>
              <UserList
                users={users}
                selectedIds={field.value || []}
                isLoading={disabled || loadingUsers}
                onChange={(userId) => {
                  const current = field.value || [];
                  field.onChange(
                    current.includes(userId)
                      ? current.filter((id) => id !== userId)
                      : [...current, userId],
                  );
                }}
              />
            </div>
            <FormMessage />
          </FormItem>
        )}
      />
    </>
  );
}
