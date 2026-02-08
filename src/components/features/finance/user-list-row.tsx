/**
 * Componente optimizado de fila de usuario para formularios
 * Memoizado para evitar re-renders innecesarios
 */

"use client";

import React from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { OptimizedAvatar } from "@/components/ui/optimized-avatar";
import type { User } from "@prisma/client";

interface UserRowProps {
  user: User;
  isSelected: boolean;
  isDisabled: boolean;
  onCheckedChange: (checked: boolean | string) => void;
}

/**
 * Componente de fila memoizado
 * Solo re-renderiza si el usuario específico o su estado seleccionado cambia
 */
export const UserRow = React.memo(
  ({ user, isSelected, isDisabled, onCheckedChange }: UserRowProps) => {
    const firstName = user.name?.split(" ")[0] || user.name;
    const initials = user.name
      ?.split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "??";

    return (
      <div key={user.id} className="flex items-center space-x-2">
        <Checkbox
          id={`create-user-${user.id}`}
          checked={isSelected}
          onCheckedChange={onCheckedChange}
          disabled={isDisabled}
        />
        <Label
          htmlFor={`create-user-${user.id}`}
          className="flex items-center gap-2 cursor-pointer flex-1"
        >
          <OptimizedAvatar
            src={user.image}
            alt={firstName}
            fallback={initials}
            size="md"
          />
          <span className="text-sm font-normal truncate">{firstName}</span>
        </Label>
      </div>
    );
  },
  (prevProps, nextProps) => {
    // Retorna true si son iguales (no re-render)
    return (
      prevProps.user.id === nextProps.user.id &&
      prevProps.isSelected === nextProps.isSelected &&
      prevProps.isDisabled === nextProps.isDisabled
    );
  }
);

UserRow.displayName = "UserRow";

interface UserListProps {
  users: User[];
  selectedIds: string[];
  isLoading: boolean;
  onChange: (userId: string) => void;
}

/**
 * Lista de usuarios memoizada con virtualization ready
 */
export const UserList = React.memo(function UserList({
  users,
  selectedIds,
  isLoading,
  onChange,
}: UserListProps) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {users.map((user) => (
        <UserRow
          key={user.id}
          user={user}
          isSelected={selectedIds.includes(user.id)}
          isDisabled={isLoading}
          onCheckedChange={(checked) => {
            if (checked) {
              onChange(user.id);
            } else {
              onChange(user.id);
            }
          }}
        />
      ))}
    </div>
  );
});

UserList.displayName = "UserList";
