import { NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * POST /api/onesignal/register
 * Registra o actualiza un playerId de OneSignal vinculado a un usuario
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { playerId, userId, device, browser } = body;

    if (!playerId) {
      return NextResponse.json(
        { error: "playerId es requerido" },
        { status: 400 }
      );
    }

    // Upsert: crear o actualizar el registro
    const result = await db.oneSignalPlayer.upsert({
      where: { playerId },
      update: {
        userId: userId || null,
        device: device || null,
        browser: browser || null,
        subscribed: true,
        lastSeen: new Date(),
        updatedAt: new Date(),
      },
      create: {
        playerId,
        userId: userId || null,
        device: device || null,
        browser: browser || null,
        subscribed: true,
        lastSeen: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      data: { id: result.id, playerId: result.playerId },
    });
  } catch (error) {
    console.error("[OneSignal Register] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error al registrar" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/onesignal/register
 * Marca un playerId como no suscrito (opt-out)
 */
export async function DELETE(request: Request) {
  try {
    const body = await request.json();
    const { playerId } = body;

    if (!playerId) {
      return NextResponse.json(
        { error: "playerId es requerido" },
        { status: 400 }
      );
    }

    await db.oneSignalPlayer.update({
      where: { playerId },
      data: {
        subscribed: false,
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[OneSignal Unregister] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error al desuscribir" },
      { status: 500 }
    );
  }
}
