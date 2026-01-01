"use client";

import { useCallback, useRef } from "react";

/**
 * Hook personalizado para manejar el audio de notificaciones
 * Respetando el flag soundNotifications del usuario
 */
export function useNotificationAudio(enabled: boolean) {
  const audioContextRef = useRef<AudioContext | null>(null);

  const playNotificationSound = useCallback(() => {
    // No reproducir si está deshabilitado
    if (!enabled) {
      return;
    }

    // Solo ejecutar en el cliente
    if (typeof window === "undefined") {
      return;
    }

    try {
      // Crear AudioContext si no existe
      if (!audioContextRef.current) {
        const AudioContextClass =
          window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        audioContextRef.current = new AudioContextClass();
      }

      const audioContext = audioContextRef.current;

      // Si el contexto está suspendido, reanudarlo
      if (audioContext.state === "suspended") {
        audioContext.resume();
      }

      // Crear oscilador para el sonido
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      // Configurar el sonido (beep suave)
      oscillator.frequency.value = 800;
      oscillator.type = "sine";

      // Configurar volumen con fade out
      const now = audioContext.currentTime;
      gainNode.gain.setValueAtTime(0.1, now);
      gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.1);

      // Reproducir el sonido
      oscillator.start(now);
      oscillator.stop(now + 0.1);
    } catch (error) {
      // Ignorar errores de audio silenciosamente
      console.warn("No se pudo reproducir el sonido de notificación:", error);
    }
  }, [enabled]);

  return { playNotificationSound };
}

