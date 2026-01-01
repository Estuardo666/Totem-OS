"use client";

import { useState, useRef, useEffect } from "react";
import { Mic, Square, Trash2, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUploadThing } from "@/lib/uploadthing";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";

interface AudioRecorderProps {
  onUploadComplete: (url: string) => void;
  disabled?: boolean;
}

type RecordingState = "idle" | "recording" | "review" | "uploading";

export function AudioRecorder({ onUploadComplete, disabled = false }: AudioRecorderProps) {
  const [state, setState] = useState<RecordingState>("idle");
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const { toast } = useToast();

  const { startUpload, isUploading } = useUploadThing("audioUploader", {
    onClientUploadComplete: (res) => {
      if (res && res[0]) {
        const url = res[0].ufsUrl || res[0].url;
        onUploadComplete(url);
        setState("idle");
        setAudioBlob(null);
        setAudioUrl(null);
        setRecordingTime(0);
        toast({
          title: "Nota de voz subida",
          description: "La nota de voz se ha guardado correctamente",
        });
      }
    },
    onUploadError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error al subir",
        description: error.message || "No se pudo subir la nota de voz",
      });
      setState("review");
    },
  });

  // Limpiar URL del objeto cuando el componente se desmonte
  useEffect(() => {
    return () => {
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [audioUrl]);

  // Actualizar el tiempo de grabación
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (state === "recording") {
      interval = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [state]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: "audio/webm" });
        setAudioBlob(blob);
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        setState("review");
        // Detener todos los tracks del stream
        stream.getTracks().forEach((track) => track.stop());
      };

      recorder.start();
      setMediaRecorder(recorder);
      setState("recording");
      setRecordingTime(0);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error de permisos",
        description: "No se pudo acceder al micrófono. Por favor, permite el acceso.",
      });
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && mediaRecorder.state !== "inactive") {
      mediaRecorder.stop();
      setMediaRecorder(null);
    }
  };

  const discardRecording = () => {
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }
    setState("idle");
    setAudioBlob(null);
    setAudioUrl(null);
    setRecordingTime(0);
    if (mediaRecorder) {
      mediaRecorder.stop();
      setMediaRecorder(null);
    }
  };

  const uploadRecording = () => {
    if (!audioBlob) return;

    setState("uploading");
    const file = new File([audioBlob], `audio-${Date.now()}.webm`, {
      type: "audio/webm",
    });
    startUpload([file]);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="space-y-3">
      {state === "idle" && (
        <Button
          type="button"
          variant="outline"
          onClick={startRecording}
          disabled={disabled}
          className="w-full"
        >
          <Mic className="mr-2 h-4 w-4" />
          Grabar Nota
        </Button>
      )}

      {state === "recording" && (
        <div className="flex items-center justify-between rounded-lg border border-destructive bg-destructive/10 p-4">
          <div className="flex items-center gap-3">
            <div className="h-3 w-3 rounded-full bg-destructive animate-pulse" />
            <span className="text-sm font-medium">
              Grabando... {formatTime(recordingTime)}
            </span>
          </div>
          <Button
            type="button"
            variant="destructive"
            size="icon"
            onClick={stopRecording}
            disabled={disabled}
          >
            <Square className="h-4 w-4" />
          </Button>
        </div>
      )}

      {state === "review" && audioUrl && (
        <div className="space-y-3 rounded-lg border border-input bg-background p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Revisar grabación</span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={discardRecording}
              disabled={disabled}
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
          <audio controls src={audioUrl} className="w-full" />
          <Button
            type="button"
            variant="default"
            onClick={uploadRecording}
            disabled={disabled}
            className="w-full"
          >
            <Check className="mr-2 h-4 w-4" />
            Subir
          </Button>
        </div>
      )}

      {state === "uploading" && (
        <div className="flex items-center justify-center rounded-lg border border-input bg-background p-4">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          <span className="text-sm">Subiendo nota de voz...</span>
        </div>
      )}
    </div>
  );
}

