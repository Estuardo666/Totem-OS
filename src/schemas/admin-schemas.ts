import { z } from "zod";

// ============================================================================
// SCHEMAS DE ADMINISTRACIÓN - GESTIÓN SIMPLIFICADA
// ============================================================================

// Schema para Roles (Catálogo)
export const roleSchema = z.object({
  name: z.string().min(2, "El nombre del rol debe tener al menos 2 caracteres"),
  description: z.string().optional().nullable(),
});

export type RoleInput = z.infer<typeof roleSchema>;

// Schema para Especialidades (Catálogo)
export const specialtySchema = z.object({
  name: z.string().min(2, "El nombre de la especialidad debe tener al menos 2 caracteres"),
});

export type SpecialtyInput = z.infer<typeof specialtySchema>;

// Schema para crear usuarios (admin)
export const userCreateSchema = z.object({
  name: z.string().min(1, "El nombre es requerido"),
  email: z.string().email("Email inválido"),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
  
  // Campos Legacy (Únicos campos relevantes)
  roleLegacy: z.enum(["ADMIN", "EDITOR"]).default("EDITOR"),
  specialty: z.string().optional().nullable(), // Nombre de la especialidad (texto)
  
  image: z.string().url("URL de imagen inválida").optional().nullable(),
});

export type UserCreateInput = z.infer<typeof userCreateSchema>;

// Schema para actualizar usuarios (admin)
export const userUpdateSchema = z.object({
  name: z.string().min(1, "El nombre es requerido").optional(),
  email: z.string().email("Email inválido").optional(),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres").optional(),
  
  // Campos Legacy
  roleLegacy: z.enum(["ADMIN", "EDITOR"]).optional(),
  specialty: z.string().optional().nullable(), // Nombre de la especialidad (texto)
  
  image: z.string().url("URL de imagen inválida").optional().nullable(),
});

export type UserUpdateInput = z.infer<typeof userUpdateSchema>;
