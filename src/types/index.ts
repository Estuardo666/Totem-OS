// Tipos globales para Totem OS
// Estos tipos se derivan de los modelos de Prisma y schemas de Zod

export type UserRole = "ADMIN" | "EDITOR";

export type ClientStatus = "ACTIVE" | "PAUSED" | "DEBT";

export type ContentTaskType = "REEL" | "FLYER" | "STORY";

export type ContentTaskStatus =
  | "IDEA"
  | "RECORDED"
  | "EDITING"
  | "REVIEW_INTERNAL"
  | "REVIEW_CLIENT"
  | "CLIENT_APPROVED"
  | "APPROVED"
  | "PUBLISHED";

export type ExpenseStatus = "PENDING" | "REIMBURSED";

export type PayrollStatus = "PENDING" | "PAID";

export type InvoiceStatus = "PENDING" | "SENT" | "PAID";

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




