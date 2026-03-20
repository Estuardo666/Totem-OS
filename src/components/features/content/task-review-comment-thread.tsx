"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, CornerDownRight, MessageSquarePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { TaskReviewComposer } from "@/components/features/content/task-review-composer";
import type { TaskReviewAttachment, TaskReviewComment } from "@/lib/content-review";

interface TaskReviewCommentThreadProps {
  comments: TaskReviewComment[];
  disabled?: boolean;
  onToggleResolved: (commentId: string) => void;
  onToggleReplyResolved: (commentId: string, replyId: string) => void;
  onReply: (commentId: string, payload: { message: string; attachments: TaskReviewAttachment[] }) => void;
}

const formatTimestamp = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sin fecha";
  return new Intl.DateTimeFormat("es-EC", { dateStyle: "medium", timeStyle: "short" }).format(date);
};

const toBorderColor50 = (rawColor?: string) => {
  if (!rawColor) return undefined;
  const color = rawColor.trim();

  const hex6 = /^#([0-9a-fA-F]{6})$/;
  const hex3 = /^#([0-9a-fA-F]{3})$/;

  if (hex6.test(color)) {
    return `${color}80`;
  }

  const shortMatch = color.match(hex3);
  if (shortMatch) {
    const [r, g, b] = shortMatch[1].split("");
    return `#${r}${r}${g}${g}${b}${b}80`;
  }

  const rgbMatch = color.match(/^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/i);
  if (rgbMatch) {
    return `rgba(${rgbMatch[1]}, ${rgbMatch[2]}, ${rgbMatch[3]}, 0.5)`;
  }

  const rgbaMatch = color.match(/^rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*[\d.]+\s*\)$/i);
  if (rgbaMatch) {
    return `rgba(${rgbaMatch[1]}, ${rgbaMatch[2]}, ${rgbaMatch[3]}, 0.5)`;
  }

  return undefined;
};

function AttachmentList({ attachments }: { attachments: TaskReviewAttachment[] }) {
  const [previewImage, setPreviewImage] = useState<TaskReviewAttachment | null>(null);

  if (attachments.length === 0) return null;

  const imageAttachments = attachments.filter((attachment) => attachment.type === "image");
  const otherAttachments = attachments.filter((attachment) => attachment.type !== "image");

  return (
    <div className="space-y-2">
      {imageAttachments.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {imageAttachments.map((attachment) => (
            <button
              key={attachment.id}
              type="button"
              onClick={() => setPreviewImage(attachment)}
              className="block h-20 w-20 overflow-hidden rounded-xl border border-border/70 bg-muted/20 sm:h-24 sm:w-24"
              title={attachment.label}
            >
              <img src={attachment.url} alt={attachment.label} className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      ) : null}

      {otherAttachments.map((attachment) => {
        if (attachment.type === "video") {
          return <video key={attachment.id} controls src={attachment.url} className="max-h-52 w-full rounded-lg border sm:max-h-64" playsInline />;
        }
        if (attachment.type === "audio") {
          return <audio key={attachment.id} controls src={attachment.url} className="w-full" />;
        }

        return (
          <Link key={attachment.id} href={attachment.url} target="_blank" rel="noreferrer" className="inline-flex rounded-full border border-border px-2.5 py-1 text-[11px] hover:bg-muted">
            {attachment.label}
          </Link>
        );
      })}

      <Dialog open={Boolean(previewImage)} onOpenChange={(isOpen) => (!isOpen ? setPreviewImage(null) : undefined)}>
        <DialogContent className="w-[94vw] max-w-4xl rounded-2xl border border-border/60 bg-background p-2 sm:p-3">
          <DialogHeader className="sr-only">
            <DialogTitle>{previewImage?.label || "Vista previa de imagen"}</DialogTitle>
          </DialogHeader>
          {previewImage ? (
            <div className="overflow-hidden rounded-xl bg-muted/20">
              <img src={previewImage.url} alt={previewImage.label} className="max-h-[78vh] w-full object-contain" />
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function TaskReviewCommentThread({ comments, disabled = false, onToggleResolved, onToggleReplyResolved, onReply }: TaskReviewCommentThreadProps) {
  const [replyingToId, setReplyingToId] = useState<string | null>(null);

  if (comments.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border/60 px-4 py-8 text-center text-sm text-muted-foreground">
        Aún no hay comentarios. Usa este espacio para dejar cambios, voz, video o capturas.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {[...comments].reverse().map((comment) => {
        const isReplying = replyingToId === comment.id;
        const commentBorderColor = toBorderColor50(comment.authorColor) || "hsl(var(--primary) / 0.5)";
        return (
          <div
            key={comment.id}
            className="space-y-2.5 rounded-xl border border-border/70 bg-card p-2.5 sm:p-3"
            style={{
              borderColor: commentBorderColor,
              borderLeftColor: commentBorderColor,
              borderLeftWidth: commentBorderColor ? 3 : undefined,
            }}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2 overflow-x-auto whitespace-nowrap text-sm">
                  <p className="text-sm font-medium">{comment.authorName}</p>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] uppercase tracking-wide text-muted-foreground">{comment.authorRole}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${comment.resolved ? "bg-emerald-100 text-emerald-700" : "bg-orange-100 text-orange-700"}`}>{comment.resolved ? "Solucionado" : "Pendiente"}</span>
                  <span className="text-xs text-muted-foreground">{formatTimestamp(comment.createdAt)}</span>
                </div>
              </div>
              <Button type="button" variant="ghost" size="sm" className="h-8 self-start rounded-full px-3 text-xs" onClick={() => onToggleResolved(comment.id)} disabled={disabled}>
                <CheckCircle2 className={`mr-1.5 h-3.5 w-3.5 ${comment.resolved ? "text-emerald-600" : "text-muted-foreground"}`} />
                {comment.resolved ? "Reabrir" : "Listo"}
              </Button>
            </div>

            <div className="rounded-lg border border-border/40 bg-muted/[0.08] p-2 sm:p-2.5">
              <p className="whitespace-pre-wrap text-sm leading-5">{comment.message}</p>
            </div>
            <AttachmentList attachments={comment.attachments} />

            <div className="relative space-y-2 pl-4 before:absolute before:bottom-0 before:left-[5px] before:top-1 before:w-px before:bg-border/70">
              {comment.replies.map((reply) => (
                <div
                  key={reply.id}
                  className="relative space-y-1.5 rounded-lg border border-border/60 bg-muted/[0.12] p-2 sm:p-2.5"
                >
                  <span className="absolute -left-[11px] top-3 h-1.5 w-1.5 rounded-full bg-primary/70" />
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 overflow-x-auto whitespace-nowrap text-[11px] text-muted-foreground sm:text-xs">
                      <CornerDownRight className="h-3.5 w-3.5" />
                      <span className="font-medium text-foreground">{reply.authorName}</span>
                      <span>{reply.authorRole}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${reply.resolved ? "bg-emerald-100 text-emerald-700" : "bg-orange-100 text-orange-700"}`}>{reply.resolved ? "Solucionado" : "Pendiente"}</span>
                      <span>{formatTimestamp(reply.createdAt)}</span>
                    </div>
                    <Button type="button" variant="ghost" size="sm" className="h-7 self-start rounded-full px-2.5 text-[11px] sm:self-auto sm:text-xs" onClick={() => onToggleReplyResolved(comment.id, reply.id)} disabled={disabled}>
                      <CheckCircle2 className={`mr-1.5 h-3.5 w-3.5 ${reply.resolved ? "text-emerald-600" : "text-muted-foreground"}`} />
                      {reply.resolved ? "Reabrir" : "Listo"}
                    </Button>
                  </div>
                  <div className="rounded-md border border-border/40 bg-background/80 p-2">
                    <p className="whitespace-pre-wrap text-sm leading-5">{reply.message}</p>
                  </div>
                  <AttachmentList attachments={reply.attachments} />
                </div>
              ))}

              {isReplying ? (
                <TaskReviewComposer
                  compact
                  disabled={disabled}
                  submitLabel="Responder"
                  placeholder="Responder comentario..."
                  onSubmit={(payload) => {
                    onReply(comment.id, payload);
                    setReplyingToId(null);
                  }}
                />
              ) : (
                <Button type="button" variant="outline" size="sm" className="h-8 self-start rounded-full border-dashed px-3 text-xs" onClick={() => setReplyingToId(comment.id)} disabled={disabled}>
                  <MessageSquarePlus className="mr-1.5 h-3.5 w-3.5" />Responder
                </Button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}