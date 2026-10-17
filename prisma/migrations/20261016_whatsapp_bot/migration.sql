-- AlterTable
ALTER TABLE "User" ADD COLUMN     "activeSchedule" JSONB,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "whatsappOptIn" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "approvalReminderHours" INTEGER,
ADD COLUMN     "paymentReminderTarget" TEXT NOT NULL DEFAULT 'GROUP',
ADD COLUMN     "whatsappPhone" TEXT;

-- CreateTable
CREATE TABLE "WhatsAppAuth" (
    "id" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsAppAuth_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsAppLock" (
    "id" TEXT NOT NULL,
    "holder" TEXT NOT NULL,
    "heartbeat" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsAppLock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsAppContact" (
    "id" TEXT NOT NULL,
    "lid" TEXT,
    "pnJid" TEXT,
    "pushName" TEXT,
    "userId" TEXT,
    "clientId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsAppContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsAppGroup" (
    "id" TEXT NOT NULL,
    "jid" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "clientId" TEXT,
    "matchScore" DOUBLE PRECISION,
    "purposes" TEXT[] DEFAULT ARRAY['SHOOT', 'PAYMENT', 'APPROVAL', 'AI_QA']::TEXT[],
    "aiMode" TEXT NOT NULL DEFAULT 'DRAFT',
    "approvalMode" TEXT NOT NULL DEFAULT 'DRAFT',
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "participants" JSONB,
    "lastSeenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsAppGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsAppInbound" (
    "id" TEXT NOT NULL,
    "chatJid" TEXT NOT NULL,
    "senderJid" TEXT NOT NULL,
    "isTeam" BOOLEAN NOT NULL,
    "type" TEXT NOT NULL,
    "text" TEXT,
    "fileName" TEXT,
    "quotedId" TEXT,
    "rawKey" JSONB NOT NULL,
    "ts" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsAppInbound_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsAppMessage" (
    "id" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "quotedId" TEXT,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "dedupeKey" TEXT,
    "scheduledFor" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "waMessageId" TEXT,
    "createdById" TEXT,
    "approvedById" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WhatsAppMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsAppApprovalRequest" (
    "id" TEXT NOT NULL,
    "groupJid" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "fileName" TEXT,
    "senderJid" TEXT NOT NULL,
    "taskId" TEXT,
    "candidates" JSONB,
    "matchScore" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "sentAt" TIMESTAMP(3) NOT NULL,
    "remindersSent" INTEGER NOT NULL DEFAULT 0,
    "lastReminderAt" TIMESTAMP(3),
    "resolvedByJid" TEXT,
    "resolvedText" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "previousTaskStatus" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WhatsAppApprovalRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsAppOwnerPrompt" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "options" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "answer" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WhatsAppOwnerPrompt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsAppEvent" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "groupJid" TEXT,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WhatsAppEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppContact_lid_key" ON "WhatsAppContact"("lid");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppContact_pnJid_key" ON "WhatsAppContact"("pnJid");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppGroup_jid_key" ON "WhatsAppGroup"("jid");

-- CreateIndex
CREATE INDEX "WhatsAppGroup_clientId_idx" ON "WhatsAppGroup"("clientId");

-- CreateIndex
CREATE INDEX "WhatsAppInbound_chatJid_ts_idx" ON "WhatsAppInbound"("chatJid", "ts");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppMessage_dedupeKey_key" ON "WhatsAppMessage"("dedupeKey");

-- CreateIndex
CREATE INDEX "WhatsAppMessage_status_scheduledFor_idx" ON "WhatsAppMessage"("status", "scheduledFor");

-- CreateIndex
CREATE INDEX "WhatsAppApprovalRequest_groupJid_status_idx" ON "WhatsAppApprovalRequest"("groupJid", "status");

-- CreateIndex
CREATE INDEX "WhatsAppApprovalRequest_taskId_idx" ON "WhatsAppApprovalRequest"("taskId");

-- CreateIndex
CREATE INDEX "WhatsAppEvent_type_createdAt_idx" ON "WhatsAppEvent"("type", "createdAt");

-- AddForeignKey
ALTER TABLE "WhatsAppGroup" ADD CONSTRAINT "WhatsAppGroup_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppApprovalRequest" ADD CONSTRAINT "WhatsAppApprovalRequest_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "ContentTask"("id") ON DELETE SET NULL ON UPDATE CASCADE;
