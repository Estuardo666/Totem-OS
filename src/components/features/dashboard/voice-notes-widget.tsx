"use client";

import { useState, useEffect } from "react";
import { Mic, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AudioRecorder } from "@/components/ui/audio-recorder";
import {
  createVoiceNote,
  getUserVoiceNotes,
  deleteVoiceNote,
} from "@/actions/voice-actions";
import { useToast } from "@/components/ui/use-toast";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import type { VoiceNote } from "@prisma/client";

export function VoiceNotesWidget() {
  const { toast } = useToast();
  const [voiceNotes, setVoiceNotes] = useState<VoiceNote[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Cargar notas de voz al montar el componente
  useEffect(() => {
    loadVoiceNotes();
  }, []);

  const loadVoiceNotes = async () => {
    try {
      setIsLoading(true);
      const result = await getUserVoiceNotes();
      if (result.success && result.data) {
        setVoiceNotes(result.data.slice(0, 5)); // Mostrar solo las últimas 5
      }
    } catch (error) {
      console.error("Error al cargar notas de voz:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUploadComplete = async (url: string) => {
    try {
      const result = await createVoiceNote(url);
      if (result.success) {
        toast({
          title: "Nota guardada",
          description: "Tu nota de voz se ha guardado correctamente",
        });
        // Recargar la lista
        await loadVoiceNotes();
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: result.error || "No se pudo guardar la nota",
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Ocurrió un error inesperado",
      });
    }
  };

  const handleDelete = async (noteId: string) => {
    try {
      const result = await deleteVoiceNote(noteId);
      if (result.success) {
        toast({
          title: "Nota eliminada",
          description: "La nota de voz se ha eliminado",
        });
        // Recargar la lista
        await loadVoiceNotes();
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: result.error || "No se pudo eliminar la nota",
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Ocurrió un error inesperado",
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mic className="h-5 w-5" />
          Mis Ideas
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Grabadora */}
        <div className="border rounded-lg p-3 bg-muted/30">
          <AudioRecorder
            onUploadComplete={handleUploadComplete}
            disabled={isLoading}
          />
        </div>

        {/* Lista de notas */}
        <div className="space-y-2">
          {isLoading ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Cargando...
            </p>
          ) : voiceNotes.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No tienes notas de voz aún
            </p>
          ) : (
            voiceNotes.map((note) => (
              <div
                key={note.id}
                className="flex items-center gap-3 p-3 rounded-lg border bg-background hover:bg-accent/50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(note.createdAt), {
                        addSuffix: true,
                        locale: es,
                      })}
                    </p>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-destructive hover:text-destructive"
                      onClick={() => handleDelete(note.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                  <audio
                    controls
                    src={note.audioUrl}
                    className="h-8 w-full"
                  />
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}

