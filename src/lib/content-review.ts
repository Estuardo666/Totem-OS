export type TaskReviewAttachmentType = "image" | "audio" | "video" | "document";

export interface TaskReviewAttachment {
  id: string;
  type: TaskReviewAttachmentType;
  url: string;
  label: string;
}

export interface TaskReviewReply {
  id: string;
  authorName: string;
  authorRole: string;
  createdAt: string;
  resolved: boolean;
  message: string;
  attachments: TaskReviewAttachment[];
}

export interface TaskReviewComment extends TaskReviewReply {
  replies: TaskReviewReply[];
}

export interface TaskReviewData {
  version: 2;
  comments: TaskReviewComment[];
}

type LegacyTaskReviewEntry = {
  id?: string;
  authorName?: string;
  authorRole?: string;
  createdAt?: string;
  status?: "pending" | "resolved";
  message?: string;
  attachments?: unknown[];
};

const REVIEW_VERSION = 2 as const;

const createEmptyReviewData = (): TaskReviewData => ({
  version: REVIEW_VERSION,
  comments: [],
});

const isAttachmentType = (value: unknown): value is TaskReviewAttachmentType =>
  value === "image" || value === "audio" || value === "video" || value === "document";

const sanitizeAttachment = (attachment: unknown): TaskReviewAttachment | null => {
  if (!attachment || typeof attachment !== "object") return null;

  const candidate = attachment as Partial<TaskReviewAttachment>;
  if (!candidate.id || !candidate.url || !candidate.label || !isAttachmentType(candidate.type)) {
    return null;
  }

  return {
    id: candidate.id,
    type: candidate.type,
    url: candidate.url,
    label: candidate.label,
  };
};

const sanitizeReply = (entry: unknown): TaskReviewReply | null => {
  if (!entry || typeof entry !== "object") return null;

  const candidate = entry as Partial<TaskReviewReply>;
  if (
    !candidate.id ||
    !candidate.authorName ||
    !candidate.authorRole ||
    !candidate.createdAt ||
    typeof candidate.resolved !== "boolean" ||
    !candidate.message
  ) {
    return null;
  }

  const attachments = Array.isArray(candidate.attachments)
    ? candidate.attachments.map(sanitizeAttachment).filter((value): value is TaskReviewAttachment => value !== null)
    : [];

  return {
    id: candidate.id,
    authorName: candidate.authorName,
    authorRole: candidate.authorRole,
    createdAt: candidate.createdAt,
    resolved: candidate.resolved,
    message: candidate.message,
    attachments,
  };
};

const sanitizeComment = (entry: unknown): TaskReviewComment | null => {
  if (!entry || typeof entry !== "object") return null;

  const candidate = entry as Partial<TaskReviewComment>;
  const baseReply = sanitizeReply(candidate);
  if (!baseReply) {
    return null;
  }

  const replies = Array.isArray(candidate.replies)
    ? candidate.replies.map(sanitizeReply).filter((value): value is TaskReviewReply => value !== null)
    : [];

  return {
    ...baseReply,
    resolved: candidate.resolved,
    replies,
  };
};

const createLegacyComment = (raw: string): TaskReviewComment => ({
  id: "legacy-review-comment",
  authorName: "Historial previo",
  authorRole: "Migrado",
  createdAt: new Date(0).toISOString(),
  resolved: false,
  message: raw,
  attachments: [],
  replies: [],
});

const convertLegacyEntries = (entries: LegacyTaskReviewEntry[]): TaskReviewComment[] => {
  const comments: TaskReviewComment[] = [];

  for (const entry of entries) {
    const reply = sanitizeReply({
      id: entry.id,
      authorName: entry.authorName,
      authorRole: entry.authorRole,
      createdAt: entry.createdAt,
      resolved: entry.status === "resolved",
      message: entry.message,
      attachments: entry.attachments,
    });

    if (!reply) {
      continue;
    }

    comments.push({
      ...reply,
      replies: [],
    });
  }

  return comments;
};

export const parseTaskReviewData = (raw?: string | null): TaskReviewData => {
  if (!raw || !raw.trim()) {
    return createEmptyReviewData();
  }

  try {
    const parsed = JSON.parse(raw) as Partial<TaskReviewData>;
    if (parsed?.version === REVIEW_VERSION && Array.isArray(parsed.comments)) {
      const comments = parsed.comments.map(sanitizeComment).filter((value): value is TaskReviewComment => value !== null);
      return { version: REVIEW_VERSION, comments };
    }

    if ((parsed as { version?: number; entries?: LegacyTaskReviewEntry[] }).version === 1 && Array.isArray((parsed as { entries?: LegacyTaskReviewEntry[] }).entries)) {
      return {
        version: REVIEW_VERSION,
        comments: convertLegacyEntries((parsed as { entries: LegacyTaskReviewEntry[] }).entries),
      };
    }

    return { version: REVIEW_VERSION, comments: [createLegacyComment(raw)] };
  } catch {
    return { version: REVIEW_VERSION, comments: [createLegacyComment(raw)] };
  }
};

export const serializeTaskReviewData = (reviewData: TaskReviewData): string | undefined => {
  if (!reviewData.comments.length) {
    return undefined;
  }

  return JSON.stringify({
    version: REVIEW_VERSION,
    comments: reviewData.comments,
  });
};

export const appendSystemReviewNote = (raw: string | null | undefined, message: string): string => {
  const reviewData = parseTaskReviewData(raw);
  reviewData.comments.push({
    id: `system-${Date.now()}`,
    authorName: "Sistema",
    authorRole: "Automático",
    createdAt: new Date().toISOString(),
    resolved: true,
    message,
    attachments: [],
    replies: [],
  });

  return JSON.stringify(reviewData);
};

export const countPendingReviewEntries = (raw?: string | null): number =>
  parseTaskReviewData(raw).comments.reduce(
    (count, comment) => count + (comment.resolved ? 0 : 1) + comment.replies.filter((reply) => !reply.resolved).length,
    0
  );

export const getLatestReviewEntry = (raw?: string | null): TaskReviewReply | null => {
  const comments = parseTaskReviewData(raw).comments;
  let latestEntry: TaskReviewReply | null = null;

  for (const comment of comments) {
    latestEntry = {
      id: comment.id,
      authorName: comment.authorName,
      authorRole: comment.authorRole,
      createdAt: comment.createdAt,
      resolved: comment.resolved,
      message: comment.message,
      attachments: comment.attachments,
    };

    if (comment.replies.length > 0) {
      latestEntry = comment.replies[comment.replies.length - 1];
    }
  }

  return latestEntry;
};