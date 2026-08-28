-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "email" TEXT NOT NULL,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "password" TEXT,
    "role" TEXT NOT NULL DEFAULT 'EDITOR',
    "specialty" TEXT,
    "salaryType" TEXT NOT NULL DEFAULT 'MONTHLY',
    "baseSalary" DOUBLE PRECISION,
    "profitSharePercent" DOUBLE PRECISION,
    "emergencyFundEligible" BOOLEAN NOT NULL DEFAULT true,
    "bankAccountInfo" TEXT,
    "hourlyRate" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "soundNotifications" BOOLEAN NOT NULL DEFAULT true,
    "primaryColor" TEXT NOT NULL DEFAULT '#3b82f6',
    "darkMode" BOOLEAN NOT NULL DEFAULT false,
    "themeId" TEXT NOT NULL DEFAULT 'default',
    "catppuccinAccent" TEXT NOT NULL DEFAULT 'mauve',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Specialty" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Specialty_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "contactEmails" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "color" TEXT NOT NULL DEFAULT '#000000',
    "brandKit" TEXT,
    "vault" TEXT,
    "planConfig" TEXT,
    "brandDNA" TEXT,
    "metricsConfig" TEXT,
    "monthlyReels" INTEGER NOT NULL DEFAULT 0,
    "monthlyFlyers" INTEGER NOT NULL DEFAULT 0,
    "monthlyShoots" INTEGER NOT NULL DEFAULT 0,
    "monthlyRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "paymentDay" INTEGER,
    "billingStartDate" TIMESTAMP(3),
    "logo" TEXT,
    "editorId" TEXT,
    "communityId" TEXT,
    "lastPostDate" TIMESTAMP(3),
    "shareToken" TEXT,
    "reportLastViewed" TIMESTAMP(3),
    "hasPendingFeedback" BOOLEAN NOT NULL DEFAULT false,
    "lastAiOverview" TEXT,
    "lastAiOverviewDate" TIMESTAMP(3),
    "facebookPageId" TEXT,
    "instagramBusinessId" TEXT,
    "pageAccessToken" TEXT,
    "adAccountId" TEXT,
    "tipoIdentificacion" TEXT,
    "numeroIdentificacion" TEXT,
    "razonSocial" TEXT,
    "direccionFiscal" TEXT,
    "emailFacturacion" TEXT,
    "aplicaRetencion" BOOLEAN NOT NULL DEFAULT false,
    "porcentajeRetIva" DOUBLE PRECISION DEFAULT 0,
    "porcentajeRetRenta" DOUBLE PRECISION DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Credential" (
    "id" TEXT NOT NULL,
    "service" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "url" TEXT,
    "clientId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Credential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentTask" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "dueDate" TIMESTAMP(3),
    "scheduledAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "reviewToken" TEXT,
    "clientFeedback" TEXT,
    "postCopy" TEXT,
    "coverImageUrl" TEXT,
    "audioBriefUrl" TEXT,
    "scriptUrl" TEXT,
    "clientId" TEXT NOT NULL,
    "assignedEditorId" TEXT,
    "assignedCommunityId" TEXT,
    "assignedAt" TIMESTAMP(3),
    "shootId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Shoot" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "address" TEXT,
    "mapLink" TEXT,
    "googleEventId" TEXT,
    "googleEventLink" TEXT,
    "scriptUrl" TEXT,
    "audioBriefUrl" TEXT,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "syncedFromCalendar" BOOLEAN NOT NULL DEFAULT false,
    "reminderSentMorning" BOOLEAN NOT NULL DEFAULT false,
    "reminderSent1h" BOOLEAN NOT NULL DEFAULT false,
    "clientId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Shoot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Expense" (
    "id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "category" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "receiptUrl" TEXT,
    "clientId" TEXT,
    "paidByUserId" TEXT,
    "reimbursed" BOOLEAN NOT NULL DEFAULT false,
    "payrollId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payroll" (
    "id" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "baseSalary" DOUBLE PRECISION NOT NULL,
    "reimbursements" DOUBLE PRECISION NOT NULL,
    "advances" DOUBLE PRECISION NOT NULL,
    "previousDebt" DOUBLE PRECISION NOT NULL,
    "totalToPay" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL,
    "amountPaid" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payroll_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3),
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "description" TEXT,
    "category" TEXT,
    "relatedClientId" TEXT,
    "clientId" TEXT,
    "assignedToId" TEXT,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrandAsset" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "fileKey" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "fileSize" INTEGER,
    "clientId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrandAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientFeedback" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "approved" BOOLEAN NOT NULL DEFAULT false,
    "approvedAt" TIMESTAMP(3),
    "comment" TEXT,
    "viewed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientBillingException" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "overrideAmount" DOUBLE PRECISION,
    "reason" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientBillingException_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientMonthlyStrategy" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "prepared" BOOLEAN NOT NULL DEFAULT false,
    "sentAt" TIMESTAMP(3),
    "approved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientMonthlyStrategy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InternalTransfer" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "description" TEXT,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InternalTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskMetrics" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "metaViews" INTEGER NOT NULL DEFAULT 0,
    "metaLikes" INTEGER NOT NULL DEFAULT 0,
    "metaShares" INTEGER NOT NULL DEFAULT 0,
    "metaComments" INTEGER NOT NULL DEFAULT 0,
    "metaSaves" INTEGER NOT NULL DEFAULT 0,
    "metaReach" INTEGER NOT NULL DEFAULT 0,
    "ttViews" INTEGER NOT NULL DEFAULT 0,
    "ttLikes" INTEGER NOT NULL DEFAULT 0,
    "ttShares" INTEGER NOT NULL DEFAULT 0,
    "ttComments" INTEGER NOT NULL DEFAULT 0,
    "ttSaves" INTEGER NOT NULL DEFAULT 0,
    "totalBudgetSpent" DOUBLE PRECISION,
    "notes" TEXT,
    "conversions" INTEGER NOT NULL DEFAULT 0,
    "salesCount" INTEGER NOT NULL DEFAULT 0,
    "revenue" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "conversionSource" TEXT,
    "erMeta" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "erTikTok" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "totalBrandAwareness" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "globalSocialProof" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "viralityIndex" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "efficiencyScore" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "cpa" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "roas" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "conversionRate" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaskMetrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VoiceNote" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "audioUrl" TEXT NOT NULL,
    "title" TEXT DEFAULT 'Nota de voz',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VoiceNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "clientLogo" TEXT,
    "clientName" TEXT,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceAlert" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "metadata" TEXT,
    "assignedToId" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinanceAlert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceAlertRule" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "severity" TEXT NOT NULL DEFAULT 'MEDIUM',
    "config" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinanceAlertRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "global_config" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "global_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgencyMetaAccount" (
    "id" TEXT NOT NULL,
    "facebookUserId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "tokenExpiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgencyMetaAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientMetric" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "metricName" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientMetric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientMonthlyClosure" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "accrualStatus" TEXT NOT NULL,
    "accruedAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "recommendation" TEXT,
    "recommendationReason" TEXT,
    "evidenceSummary" TEXT,
    "notes" TEXT,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientMonthlyClosure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProfitDistribution" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "totalProfit" DOUBLE PRECISION NOT NULL,
    "fundContribution" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "distributableAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "notes" TEXT,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProfitDistribution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProfitDistributionItem" (
    "id" TEXT NOT NULL,
    "distributionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "percent" DOUBLE PRECISION NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "paidTransactionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProfitDistributionItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmergencyFundMovement" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "balanceAfter" DOUBLE PRECISION NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "reason" TEXT,
    "authorizedByUserId" TEXT,
    "relatedTransactionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmergencyFundMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimeEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "taskId" TEXT,
    "clientId" TEXT,
    "startTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endTime" TIMESTAMP(3),
    "duration" INTEGER,
    "hourlyRate" DOUBLE PRECISION NOT NULL,
    "earnings" DOUBLE PRECISION,
    "description" TEXT,
    "aiSummary" TEXT,
    "status" TEXT NOT NULL DEFAULT 'RUNNING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TimeEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoogleCalendarToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "scope" TEXT NOT NULL,
    "lastSyncToken" TEXT,
    "lastSyncAt" TIMESTAMP(3),
    "channelId" TEXT,
    "channelResourceId" TEXT,
    "channelExpiration" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GoogleCalendarToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OneSignalPlayer" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "playerId" TEXT NOT NULL,
    "device" TEXT,
    "browser" TEXT,
    "subscribed" BOOLEAN NOT NULL DEFAULT true,
    "lastSeen" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OneSignalPlayer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PushSubscription" (
    "id" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "userId" TEXT,
    "role" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApnsDeviceInstallation" (
    "id" TEXT NOT NULL,
    "installationId" TEXT NOT NULL,
    "deviceToken" TEXT NOT NULL,
    "environment" TEXT NOT NULL,
    "bundleId" TEXT NOT NULL,
    "appVersion" TEXT NOT NULL,
    "appBuild" TEXT,
    "deviceModel" TEXT,
    "osVersion" TEXT,
    "locale" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "userId" TEXT NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "invalidatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApnsDeviceInstallation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyConfig" (
    "id" TEXT NOT NULL,
    "ruc" TEXT NOT NULL,
    "razonSocial" TEXT NOT NULL,
    "nombreComercial" TEXT,
    "direccionMatriz" TEXT NOT NULL,
    "establecimiento" TEXT NOT NULL DEFAULT '001',
    "puntoEmision" TEXT NOT NULL DEFAULT '001',
    "obligadoContabilidad" BOOLEAN NOT NULL DEFAULT true,
    "agenteRetencion" BOOLEAN NOT NULL DEFAULT false,
    "contribuyenteRimpe" BOOLEAN NOT NULL DEFAULT false,
    "sriAmbiente" TEXT NOT NULL DEFAULT '1',
    "modoFirma" TEXT NOT NULL DEFAULT 'LOCAL',
    "p12LocalCifrado" BYTEA,
    "p12LocalIv" BYTEA,
    "p12LocalAuthTag" BYTEA,
    "p12LocalNombre" TEXT,
    "p12LocalSubidoAt" TIMESTAMP(3),
    "p12Huella" TEXT,
    "p12Vence" TIMESTAMP(3),
    "p12Titular" TEXT,
    "workerModo" TEXT,
    "workerUltimoLatido" TIMESTAMP(3),
    "workerVersion" TEXT,
    "workerHostname" TEXT,
    "emailProveedor" TEXT NOT NULL DEFAULT 'RESEND',
    "emailFrom" TEXT,
    "emailReplyTo" TEXT,
    "emailBccAdmin" BOOLEAN NOT NULL DEFAULT true,
    "emailAsuntoTemplate" TEXT,
    "emailCuerpoTemplate" TEXT,
    "emailLogoUrl" TEXT,
    "siguienteFactura" INTEGER NOT NULL DEFAULT 1,
    "siguienteNotaCredito" INTEGER NOT NULL DEFAULT 1,
    "siguienteRetencion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SecuencialComprobante" (
    "id" TEXT NOT NULL,
    "tipoComprobante" TEXT NOT NULL,
    "establecimiento" TEXT NOT NULL,
    "puntoEmision" TEXT NOT NULL,
    "ultimoSecuencial" INTEGER NOT NULL DEFAULT 0,
    "siguiente" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SecuencialComprobante_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductoFacturacion" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "precioUnitario" DOUBLE PRECISION NOT NULL,
    "tipoIva" TEXT NOT NULL DEFAULT '4',
    "unidad" TEXT NOT NULL DEFAULT 'SERVICIO',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "aplicaIce" BOOLEAN NOT NULL DEFAULT false,
    "aplicaRetencion" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductoFacturacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ElectronicInvoice" (
    "id" TEXT NOT NULL,
    "claveAcceso" TEXT,
    "numeroAutorizacion" TEXT,
    "secuencial" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "tipoIdentificacion" TEXT NOT NULL,
    "numeroIdentificacion" TEXT NOT NULL,
    "razonSocial" TEXT NOT NULL,
    "direccionCliente" TEXT,
    "emailCliente" TEXT,
    "subtotalSinImpuestos" DOUBLE PRECISION NOT NULL,
    "subtotal0" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "subtotal2" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "subtotal4" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "subtotal12" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "subtotal15" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "valorIva" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalDescuento" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "propina" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "importeTotal" DOUBLE PRECISION NOT NULL,
    "moneda" TEXT NOT NULL DEFAULT 'DOLAR',
    "formaPagoCodigo" TEXT NOT NULL DEFAULT '20',
    "formaPagoPlazo" TEXT,
    "formaPagoUnidad" TEXT,
    "pagos" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'PENDIENTE_FIRMA',
    "rideUrl" TEXT,
    "xmlUrl" TEXT,
    "xmlSriResponse" TEXT,
    "invoiceId" TEXT,
    "fechaEmision" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaAutorizacion" TIMESTAMP(3),
    "fechaAnulacion" TIMESTAMP(3),
    "intentosSri" INTEGER NOT NULL DEFAULT 0,
    "ultimoErrorSri" TEXT,
    "codigoErrorSri" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ElectronicInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ElectronicInvoiceItem" (
    "id" TEXT NOT NULL,
    "facturaId" TEXT NOT NULL,
    "codigoPrincipal" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "cantidad" DOUBLE PRECISION NOT NULL,
    "precioUnitario" DOUBLE PRECISION NOT NULL,
    "descuento" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "precioTotalSinImpuesto" DOUBLE PRECISION NOT NULL,
    "codigoImpuesto" TEXT NOT NULL,
    "codigoPorcentaje" TEXT NOT NULL,
    "tarifa" DOUBLE PRECISION NOT NULL,
    "baseImponible" DOUBLE PRECISION NOT NULL,
    "valorImpuesto" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ElectronicInvoiceItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditNote" (
    "id" TEXT NOT NULL,
    "claveAcceso" TEXT,
    "numeroAutorizacion" TEXT,
    "secuencial" TEXT NOT NULL,
    "facturaOriginalId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "tipoIdentificacion" TEXT NOT NULL,
    "numeroIdentificacion" TEXT NOT NULL,
    "razonSocial" TEXT NOT NULL,
    "subtotalSinImpuestos" DOUBLE PRECISION NOT NULL,
    "valorIva" DOUBLE PRECISION NOT NULL,
    "importeTotal" DOUBLE PRECISION NOT NULL,
    "moneda" TEXT NOT NULL DEFAULT 'DOLAR',
    "motivo" TEXT NOT NULL,
    "tipoModificacion" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'PENDIENTE_FIRMA',
    "rideUrl" TEXT,
    "xmlUrl" TEXT,
    "fechaEmision" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaAutorizacion" TIMESTAMP(3),
    "intentosSri" INTEGER NOT NULL DEFAULT 0,
    "ultimoErrorSri" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreditNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditNoteItem" (
    "id" TEXT NOT NULL,
    "notaCreditoId" TEXT NOT NULL,
    "codigoPrincipal" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "cantidad" DOUBLE PRECISION NOT NULL,
    "precioUnitario" DOUBLE PRECISION NOT NULL,
    "descuento" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "precioTotalSinImpuesto" DOUBLE PRECISION NOT NULL,
    "codigoImpuesto" TEXT NOT NULL,
    "codigoPorcentaje" TEXT NOT NULL,
    "tarifa" DOUBLE PRECISION NOT NULL,
    "baseImponible" DOUBLE PRECISION NOT NULL,
    "valorImpuesto" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreditNoteItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ElectronicRetention" (
    "id" TEXT NOT NULL,
    "claveAcceso" TEXT,
    "numeroAutorizacion" TEXT,
    "secuencial" TEXT NOT NULL,
    "userId" TEXT,
    "proveedorRuc" TEXT,
    "proveedorNombre" TEXT,
    "tipoSujeto" TEXT NOT NULL,
    "tipoIdentificacion" TEXT NOT NULL,
    "numeroIdentificacion" TEXT NOT NULL,
    "razonSocial" TEXT NOT NULL,
    "facturaElectronicaId" TEXT,
    "periodoFiscal" TEXT NOT NULL,
    "retenciones" TEXT NOT NULL,
    "totalRetenido" DOUBLE PRECISION NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'PENDIENTE_FIRMA',
    "rideUrl" TEXT,
    "xmlUrl" TEXT,
    "transactionId" TEXT,
    "fechaEmision" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaAutorizacion" TIMESTAMP(3),
    "intentosSri" INTEGER NOT NULL DEFAULT 0,
    "ultimoErrorSri" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ElectronicRetention_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SriJob" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "facturaId" TEXT,
    "notaCreditoId" TEXT,
    "retencionId" TEXT,
    "payload" TEXT,
    "resultado" TEXT,
    "error" TEXT,
    "intentos" INTEGER NOT NULL DEFAULT 0,
    "maxIntentos" INTEGER NOT NULL DEFAULT 3,
    "procesadoAt" TIMESTAMP(3),
    "disponibleAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SriJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailEnviado" (
    "id" TEXT NOT NULL,
    "facturaId" TEXT,
    "notaCreditoId" TEXT,
    "email" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "providerId" TEXT,
    "intentos" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "enviadoAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailEnviado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkerLatido" (
    "id" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "modo" TEXT NOT NULL,
    "hostname" TEXT NOT NULL,
    "version" TEXT,
    "sriAmbiente" TEXT NOT NULL,
    "sriAlcanzable" BOOLEAN NOT NULL DEFAULT false,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkerLatido_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_ShootCrew" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE UNIQUE INDEX "Role_name_key" ON "Role"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Specialty_name_key" ON "Specialty"("name");

-- CreateIndex
CREATE INDEX "Account_userId_idx" ON "Account"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "Client_shareToken_key" ON "Client"("shareToken");

-- CreateIndex
CREATE INDEX "Client_status_idx" ON "Client"("status");

-- CreateIndex
CREATE INDEX "Client_name_idx" ON "Client"("name");

-- CreateIndex
CREATE INDEX "Client_editorId_idx" ON "Client"("editorId");

-- CreateIndex
CREATE INDEX "Client_communityId_idx" ON "Client"("communityId");

-- CreateIndex
CREATE INDEX "Credential_clientId_idx" ON "Credential"("clientId");

-- CreateIndex
CREATE INDEX "Credential_service_idx" ON "Credential"("service");

-- CreateIndex
CREATE UNIQUE INDEX "ContentTask_reviewToken_key" ON "ContentTask"("reviewToken");

-- CreateIndex
CREATE INDEX "ContentTask_clientId_idx" ON "ContentTask"("clientId");

-- CreateIndex
CREATE INDEX "ContentTask_assignedEditorId_idx" ON "ContentTask"("assignedEditorId");

-- CreateIndex
CREATE INDEX "ContentTask_assignedCommunityId_idx" ON "ContentTask"("assignedCommunityId");

-- CreateIndex
CREATE INDEX "ContentTask_status_idx" ON "ContentTask"("status");

-- CreateIndex
CREATE INDEX "ContentTask_type_idx" ON "ContentTask"("type");

-- CreateIndex
CREATE INDEX "ContentTask_priority_idx" ON "ContentTask"("priority");

-- CreateIndex
CREATE INDEX "Shoot_clientId_idx" ON "Shoot"("clientId");

-- CreateIndex
CREATE INDEX "Shoot_startTime_idx" ON "Shoot"("startTime");

-- CreateIndex
CREATE INDEX "Shoot_endTime_idx" ON "Shoot"("endTime");

-- CreateIndex
CREATE INDEX "Shoot_status_idx" ON "Shoot"("status");

-- CreateIndex
CREATE INDEX "Expense_clientId_idx" ON "Expense"("clientId");

-- CreateIndex
CREATE INDEX "Expense_paidByUserId_idx" ON "Expense"("paidByUserId");

-- CreateIndex
CREATE INDEX "Expense_payrollId_idx" ON "Expense"("payrollId");

-- CreateIndex
CREATE INDEX "Expense_reimbursed_idx" ON "Expense"("reimbursed");

-- CreateIndex
CREATE INDEX "Expense_date_idx" ON "Expense"("date");

-- CreateIndex
CREATE INDEX "Payroll_userId_idx" ON "Payroll"("userId");

-- CreateIndex
CREATE INDEX "Payroll_status_idx" ON "Payroll"("status");

-- CreateIndex
CREATE INDEX "Payroll_year_month_idx" ON "Payroll"("year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "Payroll_userId_month_year_key" ON "Payroll"("userId", "month", "year");

-- CreateIndex
CREATE INDEX "Invoice_clientId_idx" ON "Invoice"("clientId");

-- CreateIndex
CREATE INDEX "Invoice_status_idx" ON "Invoice"("status");

-- CreateIndex
CREATE INDEX "Invoice_generatedAt_idx" ON "Invoice"("generatedAt");

-- CreateIndex
CREATE INDEX "Transaction_relatedClientId_idx" ON "Transaction"("relatedClientId");

-- CreateIndex
CREATE INDEX "Transaction_clientId_idx" ON "Transaction"("clientId");

-- CreateIndex
CREATE INDEX "Transaction_assignedToId_idx" ON "Transaction"("assignedToId");

-- CreateIndex
CREATE INDEX "Transaction_userId_idx" ON "Transaction"("userId");

-- CreateIndex
CREATE INDEX "Transaction_status_idx" ON "Transaction"("status");

-- CreateIndex
CREATE INDEX "Transaction_type_idx" ON "Transaction"("type");

-- CreateIndex
CREATE INDEX "Transaction_category_idx" ON "Transaction"("category");

-- CreateIndex
CREATE INDEX "Transaction_createdAt_idx" ON "Transaction"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "BrandAsset_fileKey_key" ON "BrandAsset"("fileKey");

-- CreateIndex
CREATE INDEX "BrandAsset_clientId_idx" ON "BrandAsset"("clientId");

-- CreateIndex
CREATE INDEX "BrandAsset_fileType_idx" ON "BrandAsset"("fileType");

-- CreateIndex
CREATE INDEX "BrandAsset_fileSize_idx" ON "BrandAsset"("fileSize");

-- CreateIndex
CREATE INDEX "ClientFeedback_clientId_idx" ON "ClientFeedback"("clientId");

-- CreateIndex
CREATE INDEX "ClientFeedback_month_year_idx" ON "ClientFeedback"("month", "year");

-- CreateIndex
CREATE UNIQUE INDEX "ClientFeedback_clientId_month_year_key" ON "ClientFeedback"("clientId", "month", "year");

-- CreateIndex
CREATE INDEX "ClientBillingException_clientId_idx" ON "ClientBillingException"("clientId");

-- CreateIndex
CREATE INDEX "ClientBillingException_year_month_idx" ON "ClientBillingException"("year", "month");

-- CreateIndex
CREATE INDEX "ClientBillingException_type_idx" ON "ClientBillingException"("type");

-- CreateIndex
CREATE UNIQUE INDEX "ClientBillingException_clientId_year_month_key" ON "ClientBillingException"("clientId", "year", "month");

-- CreateIndex
CREATE INDEX "ClientMonthlyStrategy_clientId_idx" ON "ClientMonthlyStrategy"("clientId");

-- CreateIndex
CREATE INDEX "ClientMonthlyStrategy_month_year_idx" ON "ClientMonthlyStrategy"("month", "year");

-- CreateIndex
CREATE UNIQUE INDEX "ClientMonthlyStrategy_clientId_month_year_key" ON "ClientMonthlyStrategy"("clientId", "month", "year");

-- CreateIndex
CREATE INDEX "InternalTransfer_userId_idx" ON "InternalTransfer"("userId");

-- CreateIndex
CREATE INDEX "InternalTransfer_status_idx" ON "InternalTransfer"("status");

-- CreateIndex
CREATE INDEX "InternalTransfer_year_month_idx" ON "InternalTransfer"("year", "month");

-- CreateIndex
CREATE INDEX "InternalTransfer_type_idx" ON "InternalTransfer"("type");

-- CreateIndex
CREATE UNIQUE INDEX "InternalTransfer_userId_month_year_type_key" ON "InternalTransfer"("userId", "month", "year", "type");

-- CreateIndex
CREATE UNIQUE INDEX "TaskMetrics_taskId_key" ON "TaskMetrics"("taskId");

-- CreateIndex
CREATE INDEX "TaskMetrics_taskId_idx" ON "TaskMetrics"("taskId");

-- CreateIndex
CREATE INDEX "VoiceNote_userId_idx" ON "VoiceNote"("userId");

-- CreateIndex
CREATE INDEX "VoiceNote_createdAt_idx" ON "VoiceNote"("createdAt");

-- CreateIndex
CREATE INDEX "Notification_userId_idx" ON "Notification"("userId");

-- CreateIndex
CREATE INDEX "Notification_read_idx" ON "Notification"("read");

-- CreateIndex
CREATE INDEX "Notification_createdAt_idx" ON "Notification"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceAlert_fingerprint_key" ON "FinanceAlert"("fingerprint");

-- CreateIndex
CREATE INDEX "FinanceAlert_type_idx" ON "FinanceAlert"("type");

-- CreateIndex
CREATE INDEX "FinanceAlert_severity_idx" ON "FinanceAlert"("severity");

-- CreateIndex
CREATE INDEX "FinanceAlert_status_idx" ON "FinanceAlert"("status");

-- CreateIndex
CREATE INDEX "FinanceAlert_createdAt_idx" ON "FinanceAlert"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceAlertRule_key_key" ON "FinanceAlertRule"("key");

-- CreateIndex
CREATE INDEX "FinanceAlertRule_enabled_idx" ON "FinanceAlertRule"("enabled");

-- CreateIndex
CREATE UNIQUE INDEX "global_config_key_key" ON "global_config"("key");

-- CreateIndex
CREATE UNIQUE INDEX "AgencyMetaAccount_facebookUserId_key" ON "AgencyMetaAccount"("facebookUserId");

-- CreateIndex
CREATE INDEX "ClientMetric_clientId_date_idx" ON "ClientMetric"("clientId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "ClientMetric_clientId_platform_metricName_date_key" ON "ClientMetric"("clientId", "platform", "metricName", "date");

-- CreateIndex
CREATE INDEX "ClientMonthlyClosure_year_month_idx" ON "ClientMonthlyClosure"("year", "month");

-- CreateIndex
CREATE INDEX "ClientMonthlyClosure_clientId_idx" ON "ClientMonthlyClosure"("clientId");

-- CreateIndex
CREATE INDEX "ClientMonthlyClosure_accrualStatus_idx" ON "ClientMonthlyClosure"("accrualStatus");

-- CreateIndex
CREATE INDEX "ClientMonthlyClosure_approvedById_idx" ON "ClientMonthlyClosure"("approvedById");

-- CreateIndex
CREATE UNIQUE INDEX "ClientMonthlyClosure_clientId_year_month_key" ON "ClientMonthlyClosure"("clientId", "year", "month");

-- CreateIndex
CREATE INDEX "ProfitDistribution_status_idx" ON "ProfitDistribution"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ProfitDistribution_year_month_key" ON "ProfitDistribution"("year", "month");

-- CreateIndex
CREATE INDEX "ProfitDistributionItem_distributionId_idx" ON "ProfitDistributionItem"("distributionId");

-- CreateIndex
CREATE INDEX "ProfitDistributionItem_userId_idx" ON "ProfitDistributionItem"("userId");

-- CreateIndex
CREATE INDEX "EmergencyFundMovement_type_idx" ON "EmergencyFundMovement"("type");

-- CreateIndex
CREATE INDEX "EmergencyFundMovement_year_month_idx" ON "EmergencyFundMovement"("year", "month");

-- CreateIndex
CREATE INDEX "EmergencyFundMovement_authorizedByUserId_idx" ON "EmergencyFundMovement"("authorizedByUserId");

-- CreateIndex
CREATE INDEX "TimeEntry_userId_startTime_idx" ON "TimeEntry"("userId", "startTime");

-- CreateIndex
CREATE INDEX "TimeEntry_status_idx" ON "TimeEntry"("status");

-- CreateIndex
CREATE INDEX "TimeEntry_clientId_idx" ON "TimeEntry"("clientId");

-- CreateIndex
CREATE INDEX "TimeEntry_taskId_idx" ON "TimeEntry"("taskId");

-- CreateIndex
CREATE UNIQUE INDEX "GoogleCalendarToken_userId_key" ON "GoogleCalendarToken"("userId");

-- CreateIndex
CREATE INDEX "GoogleCalendarToken_userId_idx" ON "GoogleCalendarToken"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "OneSignalPlayer_playerId_key" ON "OneSignalPlayer"("playerId");

-- CreateIndex
CREATE INDEX "OneSignalPlayer_userId_idx" ON "OneSignalPlayer"("userId");

-- CreateIndex
CREATE INDEX "OneSignalPlayer_playerId_idx" ON "OneSignalPlayer"("playerId");

-- CreateIndex
CREATE UNIQUE INDEX "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");

-- CreateIndex
CREATE INDEX "PushSubscription_userId_idx" ON "PushSubscription"("userId");

-- CreateIndex
CREATE INDEX "PushSubscription_role_idx" ON "PushSubscription"("role");

-- CreateIndex
CREATE INDEX "ApnsDeviceInstallation_userId_status_idx" ON "ApnsDeviceInstallation"("userId", "status");

-- CreateIndex
CREATE INDEX "ApnsDeviceInstallation_environment_status_idx" ON "ApnsDeviceInstallation"("environment", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ApnsDeviceInstallation_installationId_environment_key" ON "ApnsDeviceInstallation"("installationId", "environment");

-- CreateIndex
CREATE UNIQUE INDEX "ApnsDeviceInstallation_deviceToken_environment_key" ON "ApnsDeviceInstallation"("deviceToken", "environment");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyConfig_ruc_key" ON "CompanyConfig"("ruc");

-- CreateIndex
CREATE INDEX "SecuencialComprobante_tipoComprobante_idx" ON "SecuencialComprobante"("tipoComprobante");

-- CreateIndex
CREATE UNIQUE INDEX "SecuencialComprobante_tipoComprobante_establecimiento_punto_key" ON "SecuencialComprobante"("tipoComprobante", "establecimiento", "puntoEmision");

-- CreateIndex
CREATE UNIQUE INDEX "ProductoFacturacion_codigo_key" ON "ProductoFacturacion"("codigo");

-- CreateIndex
CREATE INDEX "ProductoFacturacion_activo_idx" ON "ProductoFacturacion"("activo");

-- CreateIndex
CREATE INDEX "ProductoFacturacion_codigo_idx" ON "ProductoFacturacion"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "ElectronicInvoice_claveAcceso_key" ON "ElectronicInvoice"("claveAcceso");

-- CreateIndex
CREATE UNIQUE INDEX "ElectronicInvoice_invoiceId_key" ON "ElectronicInvoice"("invoiceId");

-- CreateIndex
CREATE INDEX "ElectronicInvoice_clientId_idx" ON "ElectronicInvoice"("clientId");

-- CreateIndex
CREATE INDEX "ElectronicInvoice_estado_idx" ON "ElectronicInvoice"("estado");

-- CreateIndex
CREATE INDEX "ElectronicInvoice_fechaEmision_idx" ON "ElectronicInvoice"("fechaEmision");

-- CreateIndex
CREATE INDEX "ElectronicInvoice_secuencial_idx" ON "ElectronicInvoice"("secuencial");

-- CreateIndex
CREATE INDEX "ElectronicInvoiceItem_facturaId_idx" ON "ElectronicInvoiceItem"("facturaId");

-- CreateIndex
CREATE UNIQUE INDEX "CreditNote_claveAcceso_key" ON "CreditNote"("claveAcceso");

-- CreateIndex
CREATE INDEX "CreditNote_facturaOriginalId_idx" ON "CreditNote"("facturaOriginalId");

-- CreateIndex
CREATE INDEX "CreditNote_clientId_idx" ON "CreditNote"("clientId");

-- CreateIndex
CREATE INDEX "CreditNote_estado_idx" ON "CreditNote"("estado");

-- CreateIndex
CREATE INDEX "CreditNoteItem_notaCreditoId_idx" ON "CreditNoteItem"("notaCreditoId");

-- CreateIndex
CREATE UNIQUE INDEX "ElectronicRetention_claveAcceso_key" ON "ElectronicRetention"("claveAcceso");

-- CreateIndex
CREATE UNIQUE INDEX "ElectronicRetention_transactionId_key" ON "ElectronicRetention"("transactionId");

-- CreateIndex
CREATE INDEX "ElectronicRetention_userId_idx" ON "ElectronicRetention"("userId");

-- CreateIndex
CREATE INDEX "ElectronicRetention_estado_idx" ON "ElectronicRetention"("estado");

-- CreateIndex
CREATE INDEX "ElectronicRetention_fechaEmision_idx" ON "ElectronicRetention"("fechaEmision");

-- CreateIndex
CREATE INDEX "ElectronicRetention_periodoFiscal_idx" ON "ElectronicRetention"("periodoFiscal");

-- CreateIndex
CREATE INDEX "SriJob_status_idx" ON "SriJob"("status");

-- CreateIndex
CREATE INDEX "SriJob_type_idx" ON "SriJob"("type");

-- CreateIndex
CREATE INDEX "SriJob_createdAt_idx" ON "SriJob"("createdAt");

-- CreateIndex
CREATE INDEX "SriJob_disponibleAt_idx" ON "SriJob"("disponibleAt");

-- CreateIndex
CREATE INDEX "EmailEnviado_facturaId_idx" ON "EmailEnviado"("facturaId");

-- CreateIndex
CREATE INDEX "EmailEnviado_status_idx" ON "EmailEnviado"("status");

-- CreateIndex
CREATE INDEX "WorkerLatido_workerId_idx" ON "WorkerLatido"("workerId");

-- CreateIndex
CREATE INDEX "WorkerLatido_timestamp_idx" ON "WorkerLatido"("timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "_ShootCrew_AB_unique" ON "_ShootCrew"("A", "B");

-- CreateIndex
CREATE INDEX "_ShootCrew_B_index" ON "_ShootCrew"("B");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_editorId_fkey" FOREIGN KEY ("editorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Credential" ADD CONSTRAINT "Credential_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentTask" ADD CONSTRAINT "ContentTask_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentTask" ADD CONSTRAINT "ContentTask_assignedEditorId_fkey" FOREIGN KEY ("assignedEditorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentTask" ADD CONSTRAINT "ContentTask_assignedCommunityId_fkey" FOREIGN KEY ("assignedCommunityId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentTask" ADD CONSTRAINT "ContentTask_shootId_fkey" FOREIGN KEY ("shootId") REFERENCES "Shoot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shoot" ADD CONSTRAINT "Shoot_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_paidByUserId_fkey" FOREIGN KEY ("paidByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_payrollId_fkey" FOREIGN KEY ("payrollId") REFERENCES "Payroll"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payroll" ADD CONSTRAINT "Payroll_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_relatedClientId_fkey" FOREIGN KEY ("relatedClientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandAsset" ADD CONSTRAINT "BrandAsset_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientFeedback" ADD CONSTRAINT "ClientFeedback_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientBillingException" ADD CONSTRAINT "ClientBillingException_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientMonthlyStrategy" ADD CONSTRAINT "ClientMonthlyStrategy_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InternalTransfer" ADD CONSTRAINT "InternalTransfer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskMetrics" ADD CONSTRAINT "TaskMetrics_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "ContentTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoiceNote" ADD CONSTRAINT "VoiceNote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceAlert" ADD CONSTRAINT "FinanceAlert_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientMetric" ADD CONSTRAINT "ClientMetric_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientMonthlyClosure" ADD CONSTRAINT "ClientMonthlyClosure_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientMonthlyClosure" ADD CONSTRAINT "ClientMonthlyClosure_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfitDistributionItem" ADD CONSTRAINT "ProfitDistributionItem_distributionId_fkey" FOREIGN KEY ("distributionId") REFERENCES "ProfitDistribution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfitDistributionItem" ADD CONSTRAINT "ProfitDistributionItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmergencyFundMovement" ADD CONSTRAINT "EmergencyFundMovement_authorizedByUserId_fkey" FOREIGN KEY ("authorizedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeEntry" ADD CONSTRAINT "TimeEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoogleCalendarToken" ADD CONSTRAINT "GoogleCalendarToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApnsDeviceInstallation" ADD CONSTRAINT "ApnsDeviceInstallation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ElectronicInvoice" ADD CONSTRAINT "ElectronicInvoice_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ElectronicInvoice" ADD CONSTRAINT "ElectronicInvoice_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ElectronicInvoiceItem" ADD CONSTRAINT "ElectronicInvoiceItem_facturaId_fkey" FOREIGN KEY ("facturaId") REFERENCES "ElectronicInvoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditNote" ADD CONSTRAINT "CreditNote_facturaOriginalId_fkey" FOREIGN KEY ("facturaOriginalId") REFERENCES "ElectronicInvoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditNoteItem" ADD CONSTRAINT "CreditNoteItem_notaCreditoId_fkey" FOREIGN KEY ("notaCreditoId") REFERENCES "CreditNote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ElectronicRetention" ADD CONSTRAINT "ElectronicRetention_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ElectronicRetention" ADD CONSTRAINT "ElectronicRetention_facturaElectronicaId_fkey" FOREIGN KEY ("facturaElectronicaId") REFERENCES "ElectronicInvoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SriJob" ADD CONSTRAINT "SriJob_facturaId_fkey" FOREIGN KEY ("facturaId") REFERENCES "ElectronicInvoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SriJob" ADD CONSTRAINT "SriJob_notaCreditoId_fkey" FOREIGN KEY ("notaCreditoId") REFERENCES "CreditNote"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SriJob" ADD CONSTRAINT "SriJob_retencionId_fkey" FOREIGN KEY ("retencionId") REFERENCES "ElectronicRetention"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailEnviado" ADD CONSTRAINT "EmailEnviado_facturaId_fkey" FOREIGN KEY ("facturaId") REFERENCES "ElectronicInvoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ShootCrew" ADD CONSTRAINT "_ShootCrew_A_fkey" FOREIGN KEY ("A") REFERENCES "Shoot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ShootCrew" ADD CONSTRAINT "_ShootCrew_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

