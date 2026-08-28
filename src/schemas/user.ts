import { z } from "zod";
import { CATPPUCCIN_ACCENTS, THEME_IDS } from "@/lib/theme";

export const userSchema = z.object({
  id: z.string().cuid().optional(),
  name: z.string().min(1, "El nombre es requerido"),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  email: z.string().email("Email inválido"),
  password: z.string().optional(),
  // roleCode es canónico; roleLegacy se conserva para compatibilidad.
  roleLegacy: z.enum(["ADMIN", "EDITOR", "USER"]).optional(),
  roleCode: z.enum(["ADMIN", "EDITOR", "USER"]).optional(),
  specialty: z.string().optional().nullable(), // String libre para nombre de especialidad
  baseSalary: z.number().min(0, "El salario base debe ser mayor o igual a 0").optional(),
});

export const createUserSchema = userSchema.omit({ id: true });
export const updateUserSchema = userSchema.partial();

// Schema para registro de usuarios (público)
export const registerSchema = z.object({
  firstName: z.string().min(1, "El nombre es requerido"),
  lastName: z.string().min(1, "El apellido es requerido"),
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
});

// Schema para configuración de usuario
export const userSettingsSchema = z.object({
  soundNotifications: z.boolean().optional(),
  primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "El color debe ser un hex válido (ej: #2563eb)").optional(),
  darkMode: z.boolean().optional(),
  themeId: z.enum(THEME_IDS).optional(),
  catppuccinAccent: z.enum(CATPPUCCIN_ACCENTS).optional(),
});

export type User = z.infer<typeof userSchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type UserSettings = z.infer<typeof userSettingsSchema>;
