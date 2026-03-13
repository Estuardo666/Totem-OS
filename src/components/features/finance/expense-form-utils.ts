import type { Client, User } from "@prisma/client";
import type { ExpenseAllocationInput, ExpenseSplitMode } from "@/schemas/finance";

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  COMIDA: ["almuerzo", "cena", "desayuno", "comida", "meal", "restaurant", "comedor", "pizza", "hamburguesa", "sushi", "café", "coffee", "lunch", "dinner", "breakfast", "food", "restaurante"],
  TRANSPORTE: ["taxi", "uber", "bus", "colectivo", "gasolina", "combustible", "parking", "estacionamiento", "viaje", "transporte", "flight", "vuelo", "aeropuerto", "aereo", "tren", "train"],
  INVITACIONES: ["invitación", "evento", "fiesta", "boda", "cumpleaños", "regalo", "gift", "invitación", "entrada", "ticket", "show", "concierto", "teatro"],
  SOFTWARE: ["software", "license", "licencia", "suscripción", "subscription", "adobe", "microsoft", "google", "app", "aplicación", "plugin", "extension", "saas", "cloud", "api"],
  OFICINA: ["oficina", "office", "supplies", "papelería", "tinta", "printer", "impresora", "escritorio", "desk", "silla", "chair", "estantería", "mueble"],
  EQUIPOS: ["equipo", "equipment", "cámara", "camera", "micrófono", "mic", "monitor", "pantalla", "computadora", "laptop", "teclado", "keyboard", "mouse", "disco", "drone", "luz", "light"],
};

export const EXPENSE_SPLIT_OPTIONS: Array<{ label: string; value: ExpenseSplitMode }> = [
  { label: "Equitativamente", value: "EQUALLY" },
  { label: "Por montos", value: "AS_AMOUNTS" },
];

export const detectCategory = (description: string): string => {
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

export const detectClientByDescription = (
  description: string,
  clients: Client[]
): Client | undefined => {
  const normalizedDescription = normalizeText(description);

  if (!normalizedDescription) {
    return undefined;
  }

  return clients.find((client) => {
    const normalizedClientName = normalizeText(client.name ?? "");
    if (!normalizedClientName) {
      return false;
    }

    return normalizedDescription.includes(normalizedClientName);
  });
};

export const buildDefaultAllocationValues = (
  userIds: string[]
): Record<string, string> => {
  return userIds.reduce<Record<string, string>>((accumulator, userId) => {
    accumulator[userId] = "";
    return accumulator;
  }, {});
};

export const buildEqualAmountAllocationValues = ({
  totalAmount,
  selectedUserIds,
}: {
  totalAmount: number;
  selectedUserIds: string[];
}): Record<string, string> => {
  if (selectedUserIds.length === 0) {
    return {};
  }

  const roundedAmount = roundCurrency(totalAmount / selectedUserIds.length);

  return selectedUserIds.reduce<Record<string, string>>((accumulator, userId, index) => {
    const amount = index === selectedUserIds.length - 1
      ? roundCurrency(totalAmount - roundedAmount * (selectedUserIds.length - 1))
      : roundedAmount;
    accumulator[userId] = amount === 0 ? "" : amount.toFixed(2);
    return accumulator;
  }, {});
};

export const calculateExpenseAllocations = ({
  splitMode,
  totalAmount,
  selectedUserIds,
  allocationValues,
}: {
  splitMode: ExpenseSplitMode;
  totalAmount: number;
  selectedUserIds: string[];
  allocationValues: Record<string, string>;
}): { allocations: ExpenseAllocationInput[]; error?: string } => {
  if (selectedUserIds.length === 0) {
    return { allocations: [] };
  }

  if (splitMode === "EQUALLY") {
    const roundedAmount = roundCurrency(totalAmount / selectedUserIds.length);
    const allocations = selectedUserIds.map((userId, index) => ({
      userId,
      amount:
        index === selectedUserIds.length - 1
          ? roundCurrency(totalAmount - roundedAmount * (selectedUserIds.length - 1))
          : roundedAmount,
    }));

    return { allocations };
  }

  if (splitMode === "AS_AMOUNTS") {
    const allocations = selectedUserIds.map((userId) => ({
      userId,
      amount: roundCurrency(parseNumericInput(allocationValues[userId])),
    }));
    const allocationsTotal = roundCurrency(
      allocations.reduce((sum, allocation) => sum + allocation.amount, 0)
    );

    if (Math.abs(allocationsTotal - roundCurrency(totalAmount)) > 0.01) {
      return {
        allocations,
        error: "La suma de los montos asignados debe coincidir con el monto total.",
      };
    }

    return { allocations };
  }

  const parts = selectedUserIds.map((userId) => ({
    userId,
    parts: parseNumericInput(allocationValues[userId]),
  }));
  const totalParts = parts.reduce((sum, item) => sum + item.parts, 0);

  if (totalParts <= 0) {
    return {
      allocations: [],
      error: "Debes ingresar partes mayores a 0 para al menos un usuario.",
    };
  }

  let allocatedSoFar = 0;
  const allocations = parts.map((item, index) => {
    if (index === parts.length - 1) {
      const amount = roundCurrency(totalAmount - allocatedSoFar);
      return {
        userId: item.userId,
        amount,
        parts: item.parts,
      };
    }

    const amount = roundCurrency((totalAmount * item.parts) / totalParts);
    allocatedSoFar += amount;

    return {
      userId: item.userId,
      amount,
      parts: item.parts,
    };
  });

  return { allocations };
};

export const getAllocationDisplayValue = ({
  splitMode,
  userId,
  allocations,
  fallbackAmount,
}: {
  splitMode: ExpenseSplitMode;
  userId: string;
  allocations: ExpenseAllocationInput[];
  fallbackAmount: number;
}): string => {
  const allocation = allocations.find((item) => item.userId === userId);

  if (!allocation) {
    return formatCurrency(0);
  }

  if (splitMode === "AS_PARTS") {
    return `${formatNumber(allocation.parts ?? 0)} partes · ${formatCurrency(allocation.amount)}`;
  }

  if (splitMode === "AS_AMOUNTS") {
    return formatCurrency(allocation.amount);
  }

  return formatCurrency(allocation.amount || fallbackAmount);
};

export const getUserDisplayName = (user: User): string => {
  return user.name ?? "Usuario";
};

export const formatCurrency = (value: number): string => {
  return `$${roundCurrency(value).toFixed(2)}`;
};

export const normalizeText = (value: string): string => {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
};

const parseNumericInput = (value?: string): number => {
  const parsed = Number.parseFloat(value ?? "0");
  return Number.isFinite(parsed) ? parsed : 0;
};

const roundCurrency = (value: number): number => {
  return Math.round(value * 100) / 100;
};

const formatNumber = (value: number): string => {
  if (Number.isInteger(value)) {
    return String(value);
  }

  return value.toFixed(2);
};
