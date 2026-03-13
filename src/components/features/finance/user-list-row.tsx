/**
 * Componente optimizado de fila de usuario para formularios
 * Memoizado para evitar re-renders innecesarios
 */

"use client";

import React from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { OptimizedAvatar } from "@/components/ui/optimized-avatar";
import type { User } from "@prisma/client";

interface UserRowProps {
  user: User;
  isSelected: boolean;
  isDisabled: boolean;
  onCheckedChange: (checked: boolean | string) => void;
  showAmountInput?: boolean;
  amountValue?: string;
  amountLabel?: string;
  onAmountChange?: (value: string) => void;
}

/**
 * Componente de fila memoizado
 * Solo re-renderiza si el usuario específico o su estado seleccionado cambia
 */
export const UserRow = React.memo(
  ({ user, isSelected, isDisabled, onCheckedChange, showAmountInput, amountValue, amountLabel, onAmountChange }: UserRowProps) => {
    const firstName = user.name?.split(" ")[0] || user.name;
    const initials = user.name
      ?.split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "??";

    return (
      <div key={user.id} className="rounded-md border p-2.5">
        <div className="flex items-center gap-2">
          <Checkbox
            id={`create-user-${user.id}`}
            checked={isSelected}
            onCheckedChange={onCheckedChange}
            disabled={isDisabled}
          />
          <Label
            htmlFor={`create-user-${user.id}`}
            className="flex min-w-0 items-center gap-2 cursor-pointer flex-1"
          >
            <OptimizedAvatar
              src={user.image}
              alt={firstName}
              fallback={initials}
              size="sm"
            />
            <span className="text-sm font-normal truncate">{firstName}</span>
          </Label>
          {isSelected && showAmountInput && onAmountChange ? (
            <div className="flex items-center gap-2">
              <Input
                type="number"
                step="0.01"
                min="0"
                inputMode="decimal"
                placeholder="0.00"
                className="h-8 w-20 text-right"
                value={amountValue ?? ""}
                onChange={(e) => onAmountChange(e.target.value)}
                disabled={isDisabled}
              />
            </div>
          ) : isSelected && amountLabel ? (
            <div className="text-right text-xs text-muted-foreground">{amountLabel}</div>
          ) : null}
        </div>
      </div>
    );
  },
  (prevProps, nextProps) => {
    return (
      prevProps.user.id === nextProps.user.id &&
      prevProps.isSelected === nextProps.isSelected &&
      prevProps.isDisabled === nextProps.isDisabled &&
      prevProps.showAmountInput === nextProps.showAmountInput &&
      prevProps.amountValue === nextProps.amountValue &&
      prevProps.amountLabel === nextProps.amountLabel
    );
  }
);

UserRow.displayName = "UserRow";

interface UserListProps {
  users: User[];
  selectedIds: string[];
  isLoading: boolean;
  onChange: (userId: string) => void;
  splitMode?: "EQUALLY" | "AS_AMOUNTS" | "AS_PARTS";
  allocationValues?: Record<string, string>;
  allocationLabels?: Record<string, string>;
  onAllocationChange?: (userId: string, value: string) => void;
}

/**
 * Lista de usuarios memoizada con virtualization ready
 */
export const UserList = React.memo(function UserList({
  users,
  selectedIds,
  isLoading,
  onChange,
  splitMode = "EQUALLY",
  allocationValues = {},
  allocationLabels = {},
  onAllocationChange,
}: UserListProps) {
  const showAmountInput = splitMode === "AS_AMOUNTS" || splitMode === "AS_PARTS";

  return (
    <div className="grid grid-cols-2 gap-3">
      {users.map((user) => (
        <UserRow
          key={user.id}
          user={user}
          isSelected={selectedIds.includes(user.id)}
          isDisabled={isLoading}
          onCheckedChange={() => onChange(user.id)}
          showAmountInput={showAmountInput}
          amountValue={allocationValues[user.id]}
          amountLabel={allocationLabels[user.id]}
          onAmountChange={onAllocationChange ? (value) => onAllocationChange(user.id, value) : undefined}
        />
      ))}
    </div>
  );
});

UserList.displayName = "UserList";
