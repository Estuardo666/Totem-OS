import { NextResponse } from "next/server";
import { updateTaskStatus } from "@/actions/content-actions";

import { auth } from "@/auth";
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as {
      taskId?: string;
      newStatus?: string;
    };

    if (!body.taskId || !body.newStatus) {
      return NextResponse.json(
        {
          success: false,
          error: "taskId y newStatus son requeridos",
        },
        { status: 400 }
      );
    }

    const result = await updateTaskStatus(body.taskId, body.newStatus);

    return NextResponse.json(result, {
      status: result.success ? 200 : 400,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Error al actualizar el estado de la tarea",
      },
      { status: 500 }
    );
  }
}