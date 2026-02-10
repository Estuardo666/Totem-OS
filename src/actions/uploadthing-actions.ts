"use server";

import { UTApi } from "uploadthing/server";
import { auth } from "@/auth";
import { ActionResponse } from "@/types";

export interface UploadThingFile {
  id: string;
  key: string;
  name: string;
  status: string;
  url: string;
  size: number;
  uploadedAt: string;
  customId: string | null;
}

export interface FilesListResponse {
  files: UploadThingFile[];
  hasMore: boolean;
}

/**
 * Lista todos los archivos subidos a UploadThing
 */
export async function listUploadThingFilesAction(
  offset?: number,
  limit?: number
): Promise<ActionResponse<FilesListResponse>> {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "ADMIN") {
      return { success: false, error: "Acceso denegado. Solo administradores." };
    }

    const utapi = new UTApi();
    
    // Listar archivos con paginación
    const response = await utapi.listFiles({
      offset: offset || 0,
      limit: limit || 100,
    });

    return {
      success: true,
      data: {
        files: response.files.map((file) => ({
          id: file.id,
          key: file.key,
          name: file.name,
          status: file.status,
          url: file.url,
          size: file.size,
          uploadedAt: file.uploadedAt,
          customId: file.customId,
        })),
        hasMore: response.hasMore,
      },
    };
  } catch (error) {
    console.error("Error al listar archivos de UploadThing:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error al listar archivos",
    };
  }
}

/**
 * Elimina uno o más archivos de UploadThing por sus fileKeys
 */
export async function deleteUploadThingFilesAction(
  fileKeys: string[]
): Promise<ActionResponse<{ deletedCount: number }>> {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "ADMIN") {
      return { success: false, error: "Acceso denegado. Solo administradores." };
    }

    if (!fileKeys || fileKeys.length === 0) {
      return { success: false, error: "Debes proporcionar al menos un fileKey" };
    }

    const utapi = new UTApi();
    await utapi.deleteFiles(fileKeys);

    return {
      success: true,
      data: { deletedCount: fileKeys.length },
    };
  } catch (error) {
    console.error("Error al eliminar archivos de UploadThing:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error al eliminar archivos",
    };
  }
}

/**
 * Obtiene información detallada de archivos específicos
 */
export async function getUploadThingFileInfoAction(
  fileKeys: string[]
): Promise<ActionResponse<UploadThingFile[]>> {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "ADMIN") {
      return { success: false, error: "Acceso denegado. Solo administradores." };
    }

    const utapi = new UTApi();
    const fileData = await utapi.getFileUrls(fileKeys);

    return {
      success: true,
      data: fileData.map((file) => ({
        id: file.key,
        key: file.key,
        name: file.key.split("_").pop() || file.key,
        status: "uploaded",
        url: file.url,
        size: 0, // getFileUrls no proporciona size
        uploadedAt: new Date().toISOString(),
        customId: null,
      })),
    };
  } catch (error) {
    console.error("Error al obtener información de archivos:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error al obtener información",
    };
  }
}
