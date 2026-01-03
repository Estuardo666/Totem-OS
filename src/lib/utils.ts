import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Tipos para la fortaleza de la contraseña
export type PasswordStrength = {
  score: number; // 0 a 4
  label: string;
  color: string; // Clase de Tailwind
  width: string; // Porcentaje para la barra
};

/**
 * Evalúa la fortaleza de una contraseña basada en estándares comunes.
 * @param password - La contraseña a evaluar
 * @returns Objeto con score (0-4), label, color y width
 */
export function checkPasswordStrength(password: string): PasswordStrength {
  if (!password) {
    return { score: 0, label: "", color: "bg-gray-300", width: "0%" };
  }

  let score = 0;
  
  // Reglas
  if (password.length >= 8) score++;
  if (password.length >= 12) score++; // Bonus por longitud extra
  if (/[A-Z]/.test(password)) score++;
  if (/[a-z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  // Ajuste de puntuación (máximo 4)
  if (score > 4) score = 4;

  // Determinar etiqueta y color
  let label = "";
  let color = "";
  let width = "";

  switch (score) {
    case 0:
    case 1:
      label = "Débil";
      color = "bg-red-500";
      width = "25%";
      break;
    case 2:
      label = "Media";
      color = "bg-orange-500";
      width = "50%";
      break;
    case 3:
      label = "Fuerte";
      color = "bg-yellow-500";
      width = "75%";
      break;
    case 4:
      label = "Muy Fuerte";
      color = "bg-green-500";
      width = "100%";
      break;
    default:
      label = "Débil";
      color = "bg-red-500";
      width = "25%";
  }

  return { score, label, color, width };
}







