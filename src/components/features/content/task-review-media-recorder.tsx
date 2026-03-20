"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, Check, Loader2, Mic, Square, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";

interface TaskReviewMediaRecorderProps {
  mode: "audio" | "video";
  disabled?: boolean;
  compact?: boolean;
  onFileReady: (file: File) => Promise<void> | void;
}

type RecorderState = "idle" | "recording" | "review" | "uploading";

export function TaskReviewMediaRecorder({ mode, disabled = false, compact = false, onFileReady }: TaskReviewMediaRecorderProps) {
  const { toast } = useToast();
  const [state, setState] = useState<RecorderState>("idle");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [blob, setBlob] = useState<Blob | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
  }, [previewUrl]);

  useEffect(() => {
    if (state !== "recording") return;
    const interval = setInterval(() => setRecordingTime((current) => current + 1), 1000);
    return () => clearInterval(interval);
  }, [state]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const cleanupStream = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia(
        mode === "video"
          ? { video: { facingMode: "user" }, audio: true }
          : { audio: true }
      );
      streamRef.current = stream;

      const chunks: Blob[] = [];
      const recorder = new MediaRecorder(stream, {
        mimeType: mode === "video" ? "video/webm" : "audio/webm",
      });

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      recorder.onstop = () => {
        const nextBlob = new Blob(chunks, { type: mode === "video" ? "video/webm" : "audio/webm" });
        setBlob(nextBlob);
        if (previewUrl) {
          URL.revokeObjectURL(previewUrl);
        }
        setPreviewUrl(URL.createObjectURL(nextBlob));
        setState("review");
        cleanupStream();
      };

      mediaRecorderRef.current = recorder;
      setRecordingTime(0);
      setState("recording");
      recorder.start();
    } catch {
      toast({
        variant: "destructive",
        title: mode === "video" ? "No se pudo grabar video" : "No se pudo grabar audio",
        description: "Revisa los permisos de cámara y micrófono del navegador.",
      });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
  };

  const discardRecording = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(null);
    setBlob(null);
    setRecordingTime(0);
    setState("idle");
    cleanupStream();
  };

  const useRecording = async () => {
    if (!blob) return;
    setState("uploading");

    try {
      const file = new File([blob], `${mode}-${Date.now()}.webm`, {
        type: mode === "video" ? "video/webm" : "audio/webm",
      });
      await onFileReady(file);
      discardRecording();
    } catch {
      setState("review");
      toast({
        variant: "destructive",
        title: "No se pudo adjuntar la grabación",
        description: "Intenta de nuevo en unos segundos.",
      });
    }
  };

  if (state === "recording") {
    return (
      <div className="flex items-center gap-2 rounded-full border border-destructive/30 bg-destructive/5 px-2.5 py-1.5 text-xs sm:text-sm">
        <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-destructive" />
        <span>{mode === "video" ? "Grabando video" : "Grabando voz"} {formatTime(recordingTime)}</span>
        <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={stopRecording} disabled={disabled}>
          <Square className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  if (state === "review" && previewUrl) {
    return (
      <div className="space-y-2 rounded-xl border border-border/60 p-2.5 sm:p-3">
        {mode === "video" ? (
          <video controls src={previewUrl} className="w-full rounded-lg" playsInline />
        ) : (
          <audio controls src={previewUrl} className="w-full" />
        )}
        <div className="flex items-center justify-end gap-2">
          <Button type="button" variant="ghost" size="sm" className="h-8 rounded-full px-3 text-xs" onClick={discardRecording}><Trash2 className="mr-1.5 h-3.5 w-3.5" />Descartar</Button>
          <Button type="button" size="sm" className="h-8 rounded-full px-3 text-xs" onClick={useRecording}><Check className="mr-1.5 h-3.5 w-3.5" />Usar</Button>
        </div>
      </div>
    );
  }

  if (state === "uploading") {
    return (
      <div className="flex items-center gap-2 rounded-full border border-border/60 px-2.5 py-1.5 text-xs text-muted-foreground sm:text-sm">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Subiendo grabación...
      </div>
    );
  }

  return (
    <Button type="button" variant="outline" size="sm" className="h-8 rounded-full px-3 text-xs" onClick={startRecording} disabled={disabled}>
      {mode === "video" ? <Camera className="mr-1.5 h-3.5 w-3.5" /> : <Mic className="mr-1.5 h-3.5 w-3.5" />}
      {compact ? (mode === "video" ? "Video" : "Voz") : mode === "video" ? "Grabar video" : "Mensaje de voz"}
    </Button>
  );
}