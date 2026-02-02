import { z } from "zod";

export const contentTaskSchema = z.object({
  id: z.string().cuid().optional(),
  title: z.string().min(1, "El título es requerido"),
  type: z.enum(["REEL", "FLYER", "STORY"]),
  status: z.enum([
    "IDEA",
    "RECORDED",
    "EDITING",
    "REVIEW_INTERNAL",
    "REVIEW_CLIENT",
    "CLIENT_APPROVED",
    "APPROVED",
    "PUBLISHED",
  ]),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).default("MEDIUM"),
  dueDate: z.union([z.date(), z.string()]).optional().transform((val) => {
    if (!val) return undefined;
    return typeof val === "string" ? new Date(val) : val;
  }),
  scheduledAt: z.union([z.date(), z.string()]).optional().transform((val) => {
    if (!val) return undefined;
    return typeof val === "string" ? new Date(val) : val;
  }),
  publishedAt: z.date().optional(),
  reviewToken: z.string().optional(),
  clientFeedback: z.string().optional(),
  postCopy: z.string().optional().nullable(),
  coverImageUrl: z.string().optional().nullable(),
  audioBriefUrl: z.string().optional().nullable(),
  clientId: z.string().cuid(),
  assignedEditorId: z.string().cuid().optional(),
  assignedCommunityId: z.string().cuid().optional(),
  shootId: z.string().cuid().optional(),
});

export const createContentTaskSchema = contentTaskSchema
  .omit({ id: true })
  .extend({
    status: z
      .enum([
        "IDEA",
        "RECORDED",
        "EDITING",
        "REVIEW_INTERNAL",
        "REVIEW_CLIENT",
        "CLIENT_APPROVED",
        "APPROVED",
        "PUBLISHED",
      ])
      .default("IDEA"),
    priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).default("MEDIUM"),
  });
export const updateContentTaskSchema = contentTaskSchema.partial();

const batchTaskItemSchema = createContentTaskSchema.pick({
  title: true,
  type: true,
  clientId: true,
  scheduledAt: true,
  dueDate: true,
  assignedEditorId: true,
  assignedCommunityId: true,
  priority: true,
  status: true,
});

export const batchCreateContentTasksSchema = z.object({
  tasks: z
    .array(batchTaskItemSchema)
    .min(1, "Debes incluir al menos una tarea para crear en lote"),
});

export const shootSchema = z.object({
  id: z.string().cuid().optional(),
  startTime: z.union([z.date(), z.string()]).transform((val) => {
    return typeof val === "string" ? new Date(val) : val;
  }),
  endTime: z.union([z.date(), z.string()]).transform((val) => {
    return typeof val === "string" ? new Date(val) : val;
  }),
  address: z.string().optional(),
  mapLink: z
    .union([z.string().url(), z.literal("")])
    .optional()
    .transform((val) => (val === "" ? undefined : val)),
  scriptUrl: z
    .union([z.string().url(), z.literal("")])
    .optional()
    .transform((val) => (val === "" ? undefined : val)),
  audioBriefUrl: z
    .union([z.string().url(), z.literal("")])
    .optional()
    .transform((val) => (val === "" ? undefined : val)),
  notes: z.string().optional(),
  clientId: z.string().cuid(),
  crew: z.array(z.string().cuid()),
  taskIds: z.array(z.string().cuid()).optional(),
});

export const createShootSchema = shootSchema
  .omit({ id: true })
  .refine((data) => new Date(data.endTime) > new Date(data.startTime), {
    message: "La hora de finalización debe ser posterior a la hora de inicio",
    path: ["endTime"],
  });

export const updateShootSchema = shootSchema
  .partial()
  .refine(
    (data) => {
      // Solo validar si ambos campos están presentes
      if (data.startTime && data.endTime) {
        return new Date(data.endTime) > new Date(data.startTime);
      }
      return true;
    },
    {
      message: "La hora de finalización debe ser posterior a la hora de inicio",
      path: ["endTime"],
    }
  );

export type ContentTask = z.infer<typeof contentTaskSchema>;
export type CreateContentTaskInput = z.infer<typeof createContentTaskSchema>;
export type UpdateContentTaskInput = z.infer<typeof updateContentTaskSchema>;
export type Shoot = z.infer<typeof shootSchema>;
export type CreateShootInput = z.infer<typeof createShootSchema>;
export type UpdateShootInput = z.infer<typeof updateShootSchema>;

// Schemas para TaskMetrics (Meta y TikTok separados)
export const taskMetricsSchema = z.object({
  taskId: z.string().cuid(),
  // Métricas Meta (Instagram/Facebook)
  metaViews: z.number().int().min(0).default(0),
  metaLikes: z.number().int().min(0).default(0),
  metaShares: z.number().int().min(0).default(0),
  metaComments: z.number().int().min(0).default(0),
  metaSaves: z.number().int().min(0).default(0),
  metaReach: z.number().int().min(0).default(0),
  // Métricas TikTok
  ttViews: z.number().int().min(0).default(0),
  ttLikes: z.number().int().min(0).default(0),
  ttShares: z.number().int().min(0).default(0),
  ttComments: z.number().int().min(0).default(0),
  ttSaves: z.number().int().min(0).default(0),
  // Métricas globales
  totalBudgetSpent: z.number().min(0).optional().nullable(),
  notes: z.string().optional().nullable(),
  // Métricas de conversión y ventas
  conversions: z.number().int().min(0).default(0),
  salesCount: z.number().int().min(0).default(0),
  revenue: z.number().min(0).default(0.0),
  conversionSource: z.enum(["WhatsApp", "Web", "DM", "Link en Bio", "Local Físico", "Otro"]).optional().nullable(),
});

export const updateTaskMetricsSchema = taskMetricsSchema
  .omit({ taskId: true })
  .partial()
  .extend({
    taskId: z.string().cuid(),
  })
  .transform((data) => {
    // Convertir valores vacíos/undefined a 0
    return {
      taskId: data.taskId,
      metaViews: data.metaViews ?? 0,
      metaLikes: data.metaLikes ?? 0,
      metaShares: data.metaShares ?? 0,
      metaComments: data.metaComments ?? 0,
      metaSaves: data.metaSaves ?? 0,
      metaReach: data.metaReach ?? 0,
      ttViews: data.ttViews ?? 0,
      ttLikes: data.ttLikes ?? 0,
      ttShares: data.ttShares ?? 0,
      ttComments: data.ttComments ?? 0,
      ttSaves: data.ttSaves ?? 0,
      totalBudgetSpent: data.totalBudgetSpent ?? null,
      notes: data.notes ?? null,
      conversions: data.conversions ?? 0,
      salesCount: data.salesCount ?? 0,
      revenue: data.revenue ?? 0.0,
      conversionSource: data.conversionSource ?? null,
    };
  });

// Schema para métricas dinámicas (enviadas desde el formulario)
export const dynamicTaskMetricsSchema = z.object({
  taskId: z.string().cuid(),
  metrics: z.record(z.union([
    z.number().int().min(0).default(0),
    z.number().min(0).default(0),
    z.string().optional().nullable(),
    z.enum(["WhatsApp", "Web", "DM", "Link en Bio", "Local Físico", "Otro"]).optional().nullable()
  ]))
});

export type DynamicTaskMetricsInput = z.infer<typeof dynamicTaskMetricsSchema>;

export type TaskMetrics = z.infer<typeof taskMetricsSchema>;
export type UpdateTaskMetricsInput = z.infer<typeof updateTaskMetricsSchema>;

