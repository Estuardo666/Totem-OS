"use client";

import { useMemo, useTransition } from "react";
import { useSession } from "next-auth/react";
import { Loader2, MessageSquare } from "lucide-react";
import { updateTask, type ContentTaskWithClient } from "@/actions/content-actions";
import { useToast } from "@/components/ui/use-toast";
import { TaskReviewComposer } from "@/components/features/content/task-review-composer";
import { TaskReviewCommentThread } from "@/components/features/content/task-review-comment-thread";
import { parseTaskReviewData, serializeTaskReviewData, type TaskReviewAttachment, type TaskReviewData } from "@/lib/content-review";

interface TaskReviewTabProps {
  task: ContentTaskWithClient | null;
  disabled: boolean;
  feedbackValue?: string;
  onFeedbackChange: (value?: string) => void;
}

export function TaskReviewTab({
  task,
  disabled,
  feedbackValue,
  onFeedbackChange,
}: TaskReviewTabProps) {
  const { toast } = useToast();
  const { data: session } = useSession();
  const [isPersistingReview, startPersistingReview] = useTransition();
  const reviewData = useMemo(() => parseTaskReviewData(feedbackValue), [feedbackValue]);
  const pendingComments = reviewData.comments.filter((comment) => !comment.resolved).length;
  const totalItems = reviewData.comments.reduce((count, comment) => count + 1 + comment.replies.length, 0);

  const persistReviewData = (nextReviewData: TaskReviewData) => {
    const serialized = serializeTaskReviewData(nextReviewData);
    onFeedbackChange(serialized);

    if (!task?.id) {
      return;
    }

    startPersistingReview(async () => {
      const result = await updateTask(task.id, { clientFeedback: serialized });
      if (!result.success) {
        toast({
          variant: "destructive",
          title: "No se pudo guardar la revisión",
          description: result.error || "La observación quedó en el formulario. Guarda la tarea para conservarla.",
        });
      }
    });
  };

  const addComment = (payload: { message: string; attachments: TaskReviewAttachment[] }) => {
    const nextReviewData: TaskReviewData = {
      version: 2,
      comments: [
        ...reviewData.comments,
        {
          id: crypto.randomUUID(),
          authorName: session?.user?.name || "Equipo",
          authorRole: session?.user?.roleLegacy || session?.user?.role || "EDITOR",
          authorColor: session?.user?.primaryColor || undefined,
          createdAt: new Date().toISOString(),
          resolved: false,
          message: payload.message,
          attachments: payload.attachments,
          replies: [],
        },
      ],
    };
    persistReviewData(nextReviewData);
  };

  const replyToComment = (commentId: string, payload: { message: string; attachments: TaskReviewAttachment[] }) => {
    const nextReviewData: TaskReviewData = {
      version: 2,
      comments: reviewData.comments.map((comment) =>
        comment.id === commentId
          ? {
              ...comment,
              replies: [
                ...comment.replies,
                {
                  id: crypto.randomUUID(),
                  authorName: session?.user?.name || "Equipo",
                  authorRole: session?.user?.roleLegacy || session?.user?.role || "EDITOR",
                  authorColor: session?.user?.primaryColor || undefined,
                  createdAt: new Date().toISOString(),
                  resolved: false,
                  message: payload.message,
                  attachments: payload.attachments,
                },
              ],
            }
          : comment
      ),
    };
    persistReviewData(nextReviewData);
  };

  const toggleResolved = (commentId: string) => {
    const nextReviewData: TaskReviewData = {
      version: 2,
      comments: reviewData.comments.map((comment) =>
        comment.id === commentId ? { ...comment, resolved: !comment.resolved } : comment
      ),
    };
    persistReviewData(nextReviewData);
  };

  const toggleReplyResolved = (commentId: string, replyId: string) => {
    const nextReviewData: TaskReviewData = {
      version: 2,
      comments: reviewData.comments.map((comment) =>
        comment.id === commentId
          ? {
              ...comment,
              replies: comment.replies.map((reply) =>
                reply.id === replyId ? { ...reply, resolved: !reply.resolved } : reply
              ),
            }
          : comment
      ),
    };
    persistReviewData(nextReviewData);
  };

  return (
    <div className="mt-3 space-y-4">
      <div className="flex items-center gap-2 overflow-x-auto rounded-xl border border-border/50 bg-muted/20 px-3 py-2 whitespace-nowrap">
        <div className="flex min-w-0 items-center gap-2 text-sm font-semibold shrink-0 sm:text-base">
          <MessageSquare className="h-4 w-4 shrink-0" />
          <span>Comentarios</span>
        </div>
        <span className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground sm:hidden">Imagen, video, voz y respuestas.</span>
        <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground max-sm:hidden">Comentarios con imagen, video, voz y respuesta en el mismo hilo.</span>
        <div className="ml-auto flex shrink-0 items-center gap-1.5 text-[11px] text-muted-foreground">
          <span className="rounded-full border border-border/60 bg-background px-2.5 py-1">{totalItems} item(s)</span>
          <span className="rounded-full border border-orange-200 bg-orange-50 px-2.5 py-1 text-orange-700">{pendingComments} pendiente(s)</span>
          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-emerald-700">
            {isPersistingReview ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            {isPersistingReview ? "Guardando" : "Guardado local"}
          </span>
        </div>
      </div>

      <TaskReviewComposer
        disabled={disabled}
        placeholder="Escribe un comentario y adjunta lo necesario..."
        submitLabel="Comentar"
        onSubmit={addComment}
      />

      <TaskReviewCommentThread
        comments={reviewData.comments}
        disabled={disabled}
        onToggleResolved={toggleResolved}
        onToggleReplyResolved={toggleReplyResolved}
        onReply={replyToComment}
      />
    </div>
  );
}