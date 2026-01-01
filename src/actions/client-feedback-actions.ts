"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import type { ApiResponse } from "@/types";
import { z } from "zod";

const approveReportSchema = z.object({
  clientId: z.string().cuid(),
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2000),
});

const submitFeedbackSchema = z.object({
  clientId: z.string().cuid(),
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2000),
  comment: z.string().min(1, "El comentario no puede estar vacío").max(1000),
});

/**
 * Server Action para marcar el reporte como visto
 */
export async function markReportAsViewed(
  clientId: string
): Promise<ApiResponse<{ viewedAt: Date }>> {
  try {
    const client = await db.client.update({
      where: { id: clientId },
      data: { reportLastViewed: new Date() },
    });

    return {
      success: true,
      data: { viewedAt: client.reportLastViewed! },
    };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Error al marcar reporte como visto",
    };
  }
}

/**
 * Server Action para aprobar el reporte del mes
 */
export async function approveReport(
  input: unknown
): Promise<ApiResponse<{ id: string }>> {
  try {
    const validatedData = approveReportSchema.parse(input);

    // Buscar si ya existe un feedback para este mes/año
    const existingFeedback = await db.clientFeedback.findUnique({
      where: {
        clientId_month_year: {
          clientId: validatedData.clientId,
          month: validatedData.month,
          year: validatedData.year,
        },
      },
    });

    let feedback;
    if (existingFeedback) {
      // Actualizar feedback existente
      feedback = await db.clientFeedback.update({
        where: { id: existingFeedback.id },
        data: {
          approved: true,
          approvedAt: new Date(),
        },
      });
    } else {
      // Crear nuevo feedback
      feedback = await db.clientFeedback.create({
        data: {
          clientId: validatedData.clientId,
          month: validatedData.month,
          year: validatedData.year,
          approved: true,
          approvedAt: new Date(),
        },
      });
    }

    revalidatePath("/");
    revalidatePath(`/clients/${validatedData.clientId}`);

    return {
      success: true,
      data: { id: feedback.id },
    };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Error al aprobar el reporte",
    };
  }
}

/**
 * Server Action para enviar feedback/comentario
 */
export async function submitFeedback(
  input: unknown
): Promise<ApiResponse<{ id: string }>> {
  try {
    const validatedData = submitFeedbackSchema.parse(input);

    // Buscar si ya existe un feedback para este mes/año
    const existingFeedback = await db.clientFeedback.findUnique({
      where: {
        clientId_month_year: {
          clientId: validatedData.clientId,
          month: validatedData.month,
          year: validatedData.year,
        },
      },
    });

    let feedback;
    if (existingFeedback) {
      // Actualizar feedback existente
      feedback = await db.clientFeedback.update({
        where: { id: existingFeedback.id },
        data: {
          comment: validatedData.comment,
          viewed: false, // Marcar como no visto para que aparezca en el Dashboard
        },
      });
    } else {
      // Crear nuevo feedback
      feedback = await db.clientFeedback.create({
        data: {
          clientId: validatedData.clientId,
          month: validatedData.month,
          year: validatedData.year,
          comment: validatedData.comment,
          viewed: false,
        },
      });
    }

    revalidatePath("/");
    revalidatePath(`/clients/${validatedData.clientId}`);

    return {
      success: true,
      data: { id: feedback.id },
    };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Error al enviar el feedback",
    };
  }
}

/**
 * Server Action para obtener feedbacks pendientes de revisar
 */
export async function getPendingFeedbacks(): Promise<
  ApiResponse<
    Array<{
      id: string;
      clientName: string;
      clientId: string;
      month: number;
      year: number;
      approved: boolean;
      comment: string | null;
      createdAt: Date;
    }>
  >
> {
  try {
    const feedbacks = await db.clientFeedback.findMany({
      where: {
        viewed: false,
      },
      include: {
        client: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return {
      success: true,
      data: feedbacks.map((f) => ({
        id: f.id,
        clientName: f.client.name,
        clientId: f.clientId,
        month: f.month,
        year: f.year,
        approved: f.approved,
        comment: f.comment,
        createdAt: f.createdAt,
      })),
    };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Error al obtener feedbacks pendientes",
    };
  }
}

/**
 * Server Action para marcar feedback como visto
 */
export async function markFeedbackAsViewed(
  feedbackId: string
): Promise<ApiResponse<{ id: string }>> {
  try {
    const feedback = await db.clientFeedback.update({
      where: { id: feedbackId },
      data: { viewed: true },
    });

    revalidatePath("/");
    revalidatePath(`/clients/${feedback.clientId}`);

    return {
      success: true,
      data: { id: feedback.id },
    };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Error al marcar feedback como visto",
    };
  }
}

/**
 * Server Action para obtener feedbacks de un cliente
 */
export async function getClientFeedbacks(
  clientId: string
): Promise<
  ApiResponse<
    Array<{
      id: string;
      month: number;
      year: number;
      approved: boolean;
      comment: string | null;
      viewed: boolean;
      createdAt: Date;
    }>
  >
> {
  try {
    const feedbacks = await db.clientFeedback.findMany({
      where: { clientId },
      orderBy: {
        createdAt: "desc",
      },
    });

    return {
      success: true,
      data: feedbacks.map((f) => ({
        id: f.id,
        month: f.month,
        year: f.year,
        approved: f.approved,
        comment: f.comment,
        viewed: f.viewed,
        createdAt: f.createdAt,
      })),
    };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Error al obtener feedbacks del cliente",
    };
  }
}

