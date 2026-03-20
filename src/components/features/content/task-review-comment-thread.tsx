"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, CornerDownRight, MessageSquarePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
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

function AttachmentList({ attachments }: { attachments: TaskReviewAttachment[] }) {
  if (attachments.length === 0) return null;

  return (
    <div className="space-y-2">
      {attachments.map((attachment) => {
        if (attachment.type === "image") {
          return <img key={attachment.id} src={attachment.url} alt={attachment.label} className="max-h-52 w-full rounded-lg border object-cover sm:max-h-64" />;
        }
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
        return (
          <div key={comment.id} className="space-y-3 rounded-xl border border-border/60 bg-background p-3 sm:p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium">{comment.authorName}</p>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] uppercase tracking-wide text-muted-foreground">{comment.authorRole}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${comment.resolved ? "bg-emerald-100 text-emerald-700" : "bg-orange-100 text-orange-700"}`}>{comment.resolved ? "Solucionado" : "Pendiente"}</span>
                </div>
                <p className="text-xs text-muted-foreground">{formatTimestamp(comment.createdAt)}</p>
              </div>
              <Button type="button" variant="ghost" size="sm" className="h-8 self-start rounded-full px-3 text-xs" onClick={() => onToggleResolved(comment.id)} disabled={disabled}>
                <CheckCircle2 className={`mr-1.5 h-3.5 w-3.5 ${comment.resolved ? "text-emerald-600" : "text-muted-foreground"}`} />
                {comment.resolved ? "Reabrir" : "Listo"}
              </Button>
            </div>

            <p className="whitespace-pre-wrap text-sm leading-5">{comment.message}</p>
            <AttachmentList attachments={comment.attachments} />

            <div className="space-y-2.5 border-l border-border/50 pl-3 sm:pl-4">
              {comment.replies.map((reply) => (
                <div key={reply.id} className="space-y-2 rounded-lg border border-border/50 bg-muted/20 p-2.5 sm:p-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground sm:text-xs">
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
                  <p className="whitespace-pre-wrap text-sm leading-5">{reply.message}</p>
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
                <Button type="button" variant="ghost" size="sm" className="h-8 self-start rounded-full px-3 text-xs" onClick={() => setReplyingToId(comment.id)} disabled={disabled}>
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