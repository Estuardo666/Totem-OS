// Tipos globales para Totem OS
// Estos tipos se derivan de los modelos de Prisma y schemas de Zod

export type UserRole = "ADMIN" | "EDITOR";

export type ClientStatus = "ACTIVE" | "PAUSED" | "DEBT" | "INACTIVE";

export type ContentTaskType = "REEL" | "FLYER" | "STORY";

export type ContentTaskStatus =
  | "IDEA"
  | "SCRIPT"
  | "RECORDED"
  | "EDITING"
  | "REVIEW_INTERNAL"
  | "REVIEW_CLIENT"
  | "CLIENT_APPROVED"
  | "APPROVED"
  | "PUBLISHED";

export type ExpenseStatus = "PENDING" | "REIMBURSED";

export type PayrollStatus = "PENDING" | "PAID";

export type InvoiceStatus = "PENDING" | "SENT" | "PAID" | "OVERDUE";

export interface BrandKit {
  colors: string[];
  fonts: string[];
  driveLink?: string;
}

export interface Vault {
  instagram?: {
    user: string;
    pass: string;
  };
  [key: string]: unknown;
}

export interface PlanConfig {
  quota: {
    reels?: number;
    flyers?: number;
    stories?: number;
  };
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export type ActionResponse<T> = {
  success: boolean;
  data?: T;
  error?: string;
};

export * from "./finance-settings";




