"use client";

import { useEffect, useState, type ReactNode } from "react";
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

/**
 * Campos comunes de los tres formularios de gasto: "Registrar gasto",
 * "Editar gasto" y la pestaña Gasto de "Nuevo movimiento".
 */
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
export function toExpenseDateInputValue(value: Date | string | undefined | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const shown = isUtcMidnight(date) ? date : new Date(date.getTime() - ECUADOR_OFFSET_MS);
  return shown.toISOString().slice(0, 10);
}

/** Hoy en Ecuador, guardado como fecha de calendario (medianoche UTC). */
export function todayExpenseDate() {
  return new Date(`${new Date(Date.now() - ECUADOR_OFFSET_MS).toISOString().slice(0, 10)}T00:00:00Z`);
}

/** "AAAA-MM-DD" → fecha de calendario (medianoche UTC). */
export function fromExpenseDateInputValue(value: string) {
  return value ? new Date(`${value}T00:00:00Z`) : todayExpenseDate();
}

/** Acepta coma o punto como decimal (teclados en español). */
export function normalizeExpenseAmountText(value: string) {
  return value.replace(/,/g, ".").replace(/[^\d.]/g, "").replace(/\.(?=.*\.)/g, "");
}

function parseExpenseAmountText(text: string): number | undefined {
  if (text === "") return undefined;
  const parsed = parseFloat(text);
  return Number.isFinite(parsed) ? parsed : 0;
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

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  COMIDA: ["almuerzo", "cena", "desayuno", "comida", "meal", "restaurant", "comedor", "pizza", "hamburguesa", "sushi", "café", "coffee", "lunch", "dinner", "breakfast", "food", "restaurante"],
  TRANSPORTE: ["taxi", "uber", "bus", "colectivo", "gasolina", "combustible", "parking", "estacionamiento", "viaje", "transporte", "flight", "vuelo", "aeropuerto", "aereo", "tren", "train"],
  INVITACIONES: ["invitación", "evento", "fiesta", "boda", "cumpleaños", "regalo", "gift", "entrada", "ticket", "show", "concierto", "teatro"],
  SOFTWARE: ["software", "license", "licencia", "suscripción", "subscription", "adobe", "microsoft", "google", "app", "aplicación", "plugin", "extension", "saas", "cloud", "api"],
  OFICINA: ["oficina", "office", "supplies", "papelería", "tinta", "printer", "impresora", "escritorio", "desk", "silla", "chair", "estantería", "mueble"],
  EQUIPOS: ["equipo", "equipment", "cámara", "camera", "micrófono", "mic", "monitor", "pantalla", "computadora", "laptop", "teclado", "keyboard", "mouse", "disco", "drone", "luz", "light"],
};

export type ExpenseCategory = (typeof CATEGORY_OPTIONS)[number][0];

/** Sugiere la categoría a partir de la descripción ("Uber al rodaje" → Transporte). */
export function detectExpenseCategory(description: string): ExpenseCategory {
  const text = description.toLowerCase().trim();
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some((keyword) => text.includes(keyword))) return category as ExpenseCategory;
  }
  return "OTROS";
}

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

/** Campo de monto: texto libre con coma o punto, sincronizado con el formulario. */
function AmountInput({
  value,
  onChange,
  onBlur,
  disabled,
  id,
  ...aria
}: {
  value: number | undefined;
  onChange: (value: number | undefined) => void;
  onBlur: () => void;
  disabled: boolean;
  id?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
}) {
  const [text, setText] = useState(value ? String(value) : "");

  // Si el formulario cambia el monto desde fuera (abrir un gasto para editar,
  // limpiar al cerrar), el texto lo sigue.
  useEffect(() => {
    setText((current) => {
      if (parseExpenseAmountText(current) === value) return current;
      return value ? String(value) : "";
    });
  }, [value]);

  return (
    <Input
      id={id}
      {...aria}
      type="text"
      placeholder="0.00"
      className="pl-8 text-2xl font-bold"
      inputMode="decimal"
      autoComplete="off"
      value={text}
      onChange={(e) => {
        const next = normalizeExpenseAmountText(e.target.value);
        setText(next);
        onChange(parseExpenseAmountText(next));
      }}
      onBlur={onBlur}
      disabled={disabled}
    />
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
  /**
   * En lugar de la lista de quién pagó (solo al registrar), un aviso fijo.
   * Al editar no se puede cambiar quién pagó.
   */
  payerNotice?: ReactNode;
}

export function ExpenseFormFields({
  control,
  users,
  clients,
  disabled,
  loadingUsers,
  loadingClients,
  onDescriptionBlur,
  payerNotice,
}: ExpenseFormFieldsProps) {
  const [clientQuery, setClientQuery] = useState("");
  const query = clientQuery.trim().toLowerCase();
  const filteredClients = query
    ? clients.filter((client) => client.name?.toLowerCase().includes(query))
    : clients;

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
                  <AmountInput
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
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
                  value={toExpenseDateInputValue(field.value ?? todayExpenseDate())}
                  onChange={(e) => field.onChange(fromExpenseDateInputValue(e.target.value))}
                  disabled={disabled}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <div className="flex w-full flex-row gap-3 sm:gap-4">
        <FormField
          control={control}
          name="category"
          render={({ field }) => (
            <FormItem className="min-w-0 flex-1">
              <FormLabel>Categoría</FormLabel>
              <Select onValueChange={field.onChange} value={field.value} disabled={disabled}>
                <FormControl>
                  <SelectTrigger className="min-w-0 gap-2 px-3 sm:px-4">
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
            <FormItem className="min-w-0 flex-1">
              <FormLabel>Cliente (Opcional)</FormLabel>
              <Select
                // Al cerrar se limpia la búsqueda, para que el cliente elegido
                // siga visible en el campo.
                onOpenChange={(isOpen) => {
                  if (!isOpen) setClientQuery("");
                }}
                onValueChange={(value) => field.onChange(value === "none" ? undefined : value)}
                value={field.value || "none"}
                disabled={disabled || loadingClients}
              >
                <FormControl>
                  <SelectTrigger className="min-w-0 gap-2 px-3 sm:px-4">
                    <SelectValue placeholder="Selecciona un cliente (opcional)" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {clients.length > 6 && (
                    <div className="p-2">
                      <Input
                        placeholder="Buscar cliente..."
                        aria-label="Buscar cliente"
                        value={clientQuery}
                        onChange={(event) => setClientQuery(event.target.value)}
                        onKeyDown={(event) => event.stopPropagation()}
                      />
                    </div>
                  )}
                  <SelectItem value="none">Sin cliente</SelectItem>
                  {filteredClients.length === 0 && query ? (
                    <div className="px-2 pb-2 text-sm text-muted-foreground">Sin resultados</div>
                  ) : (
                    filteredClients.map((client) => (
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
                    ))
                  )}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
      <p className="-mt-2 text-xs text-muted-foreground">
        Vincular un cliente permite medir la rentabilidad de su proyecto.
      </p>

      {payerNotice ?? (
        <FormField
          control={control}
          name="paidByUserIds"
          render={({ field }) => (
            <FormItem>
              <div className="space-y-3">
                <div className="space-y-1">
                  <FormLabel>Asignar a Usuarios (Para Reembolso)</FormLabel>
                  <p className="text-sm text-muted-foreground">
                    Selecciona uno o más usuarios. Si seleccionas múltiples, el monto se dividirá equitativamente.
                  </p>
                </div>
                <UserList
                  users={users}
                  selectedIds={field.value || []}
                  isLoading={disabled || loadingUsers}
                  onChange={(userId) => {
                    const current = field.value || [];
                    field.onChange(
                      current.includes(userId) ? current.filter((id) => id !== userId) : [...current, userId]
                    );
                  }}
                />
              </div>
              <FormMessage />
            </FormItem>
          )}
        />
      )}
    </>
  );
}
