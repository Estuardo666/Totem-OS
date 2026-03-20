"use client";

import { useRef, useState } from "react";
import { ImagePlus, Loader2, Paperclip, Send, Video } from "lucide-react";
import { useUploadThing } from "@/lib/uploadthing";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { TaskReviewMediaRecorder } from "@/components/features/content/task-review-media-recorder";
import type { TaskReviewAttachment } from "@/lib/content-review";

interface TaskReviewComposerProps {
  disabled?: boolean;
  submitLabel?: string;
  placeholder?: string;
  compact?: boolean;
  onSubmit: (payload: { message: string; attachments: TaskReviewAttachment[] }) => void;
}

type UploadedFileInfo = {
  url?: string;
  ufsUrl?: string;
  name?: string;
};

const isImageFile = (file: File) => file.type.startsWith("image/");
const isAudioFile = (file: File) => file.type.startsWith("audio/");
const isVideoFile = (file: File) => file.type.startsWith("video/");

const mapAttachment = (file: UploadedFileInfo, sourceFile?: File): TaskReviewAttachment | null => {
  const url = file.ufsUrl || file.url;
  if (!url) return null;

  const type = sourceFile && isImageFile(sourceFile)
    ? "image"
    : sourceFile && isAudioFile(sourceFile)
    ? "audio"
    : sourceFile && isVideoFile(sourceFile)
    ? "video"
    : "document";

  return {
    id: crypto.randomUUID(),
    type,
    url,
    label: file.name || sourceFile?.name || url.split("/").pop() || "Adjunto",
  };
};

export function TaskReviewComposer({
  disabled = false,
  submitLabel = "Comentar",
  placeholder = "Escribe un comentario...",
  compact = false,
  onSubmit,
}: TaskReviewComposerProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [message, setMessage] = useState("");
  const [attachments, setAttachments] = useState<TaskReviewAttachment[]>([]);
  const [pendingUploads, setPendingUploads] = useState(0);

  const appendAttachments = (uploaded: UploadedFileInfo[], originalFiles: File[]) => {
    const nextAttachments = uploaded
      .map((item, index) => mapAttachment(item, originalFiles[index]))
      .filter((value): value is TaskReviewAttachment => value !== null);
    setAttachments((current) => [...current, ...nextAttachments]);
  };

  const { startUpload: startMediaUpload, isUploading: isUploadingMedia } = useUploadThing("reviewMedia", {
    onClientUploadComplete: (response) => {
      setPendingUploads((current) => Math.max(0, current - 1));
      if (!response) return;
    },
    onUploadError: (error: Error) => {
      setPendingUploads((current) => Math.max(0, current - 1));
      toast({ variant: "destructive", title: "Error al subir archivo", description: error.message });
    },
  });

  const { startUpload: startAudioUpload, isUploading: isUploadingAudio } = useUploadThing("audioUploader", {
    onClientUploadComplete: () => {
      setPendingUploads((current) => Math.max(0, current - 1));
    },
    onUploadError: (error: Error) => {
      setPendingUploads((current) => Math.max(0, current - 1));
      toast({ variant: "destructive", title: "Error al subir audio", description: error.message });
    },
  });

  const uploadFiles = async (files: File[]) => {
    const audioFiles = files.filter(isAudioFile);
    const mediaFiles = files.filter((file) => !isAudioFile(file));

    if (mediaFiles.length > 0) {
      setPendingUploads((current) => current + 1);
      const response = await startMediaUpload(mediaFiles);
      appendAttachments((response || []) as UploadedFileInfo[], mediaFiles);
    }

    if (audioFiles.length > 0) {
      setPendingUploads((current) => current + 1);
      const response = await startAudioUpload(audioFiles);
      appendAttachments((response || []) as UploadedFileInfo[], audioFiles);
    }
  };

  const handleSubmit = () => {
    if (!message.trim() && attachments.length === 0) {
      toast({ variant: "destructive", title: "Comentario vacío", description: "Escribe algo o adjunta evidencia antes de comentar." });
      return;
    }

    onSubmit({
      message: message.trim() || "Adjunto de revisión",
      attachments,
    });

    setMessage("");
    setAttachments([]);
  };

  const handlePaste: React.ClipboardEventHandler<HTMLTextAreaElement> = async (event) => {
    const pastedFiles = Array.from(event.clipboardData.items)
      .map((item) => item.getAsFile())
      .filter((file): file is File => file !== null);

    if (pastedFiles.length === 0) return;

    event.preventDefault();
    await uploadFiles(pastedFiles);
    toast({ title: "Adjunto pegado", description: "La imagen o archivo quedó agregado al comentario." });
  };

  const isBusy = disabled || isUploadingMedia || isUploadingAudio || pendingUploads > 0;

  return (
    <div className={`space-y-2.5 rounded-xl border border-border/60 bg-background ${compact ? "p-2.5" : "p-3 sm:p-4"}`}>
      <Textarea
        value={message}
        onChange={(event) => setMessage(event.target.value)}
        onPaste={handlePaste}
        placeholder={placeholder}
        disabled={disabled}
        className={`${compact ? "min-h-[74px] text-sm" : "min-h-[88px] sm:min-h-[104px] text-sm"} resize-y rounded-lg border-border/60 px-3 py-2.5 leading-5`}
      />
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*,video/*,.pdf,.doc,.docx,.txt,audio/*"
        className="hidden"
        onChange={async (event) => {
          const nextFiles = Array.from(event.target.files || []);
          if (nextFiles.length > 0) {
            await uploadFiles(nextFiles);
          }
          event.target.value = "";
        }}
      />
      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
        <Button type="button" variant="outline" size="sm" className="h-8 rounded-full px-3 text-xs" onClick={() => fileInputRef.current?.click()} disabled={disabled}>
          <Paperclip className="mr-1.5 h-3.5 w-3.5" />Adjuntar
        </Button>
        <TaskReviewMediaRecorder mode="video" compact={compact} disabled={disabled} onFileReady={async (file) => uploadFiles([file])} />
        <TaskReviewMediaRecorder mode="audio" compact={compact} disabled={disabled} onFileReady={async (file) => uploadFiles([file])} />
        <div className="rounded-full border border-dashed border-border/60 px-2.5 py-1.5 text-[11px] text-muted-foreground">
          Pegar imagen o archivo
        </div>
      </div>
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {attachments.map((attachment) => (
            <button
              key={attachment.id}
              type="button"
              onClick={() => setAttachments((current) => current.filter((item) => item.id !== attachment.id))}
              className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-[11px] hover:bg-muted"
            >
              {attachment.type === "image" ? <ImagePlus className="h-3 w-3" /> : attachment.type === "video" ? <Video className="h-3 w-3" /> : <Paperclip className="h-3 w-3" />}
              <span className="max-w-32 truncate sm:max-w-40">{attachment.label}</span>
            </button>
          ))}
        </div>
      )}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-[11px] text-muted-foreground sm:text-xs">
          {isBusy ? <span className="inline-flex items-center gap-1.5"><Loader2 className="h-3.5 w-3.5 animate-spin" />Subiendo adjuntos...</span> : "Texto, imagen, video, documento o voz en un mismo comentario."}
        </div>
        <Button type="button" size="sm" className="h-8 rounded-full px-4 self-end text-xs sm:self-auto" onClick={handleSubmit} disabled={isBusy}>
          <Send className="mr-1.5 h-3.5 w-3.5" />{submitLabel}
        </Button>
      </div>
    </div>
  );
}