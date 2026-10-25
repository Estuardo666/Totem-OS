"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Activity,
  Bot,
  Check,
  CheckCircle2,
  ChevronDown,
  CirclePause,
  CirclePlay,
  Clock3,
  History,
  Inbox,
  MessageCircle,
  QrCode,
  RefreshCw,
  RotateCcw,
  Send,
  Settings2,
  ShieldCheck,
  Trash2,
  UserRound,
  Users,
  UsersRound,
  Video,
  X,
} from "lucide-react";
import { decideOwnerPromptAction, discardWhatsAppDraftAction, pauseWhatsAppAction, saveWhatsAppDraftAction, saveWhatsAppGeneralConfigAction, undoWhatsAppApprovalAction, updateWhatsAppClientAction, updateWhatsAppGroupAction, updateWhatsAppTeamMemberAction } from "./actions";

type Props = {
  config: { paused: boolean; clientsEnabled: boolean; ownerPhone: string | null; approvalReminderHours: number; maxApprovalReminders: number; skipWeekends: boolean; teamDailyHour: string; amountsInGroups: boolean; queue?: { pending?: number; draft?: number; failed?: number }; openPrompts?: number };
  health: { configured: boolean; online: boolean | null; connected: boolean; pairingOnly: boolean; qrAvailable: boolean; details: string | null };
  groups: Array<{ id: string; jid: string; name: string; clientId: string | null; purposes: string[]; aiMode: string; approvalMode: string; enabled: boolean; client: { id: string; name: string } | null }>;
  clients: Array<{ id: string; name: string; whatsappPhone: string | null; paymentReminderTarget: string; approvalReminderHours: number | null }>;
  team: Array<{ id: string; name: string | null; email: string | null; roleLegacy: string; phone: string | null; whatsappOptIn: boolean; activeSchedule: unknown }>;
  prompts: Array<{ id: string; type: string; payload: unknown; options: unknown; expiresAt: Date; createdAt: Date }>;
  drafts: Array<{ id: string; to: string; body: string; kind: string; createdAt: Date }>;
  approvals: Array<{ id: string; groupJid: string; fileName: string | null; status: string; sentAt: Date; previousTaskStatus: string | null; task: { id: string; title: string; status: string; client: { name: string } } | null }>;
  history: Array<{ id: string; to: string; body: string; kind: string; status: string; createdAt: Date; sentAt: Date | null; error: string | null }>;
  events: Array<{ id: string; type: string; groupJid: string | null; payload: unknown; createdAt: Date }>;
};

type Section = "inbox" | "approvals" | "groups" | "team" | "clients" | "history" | "config";

const PURPOSES = ["SHOOT", "PAYMENT", "APPROVAL", "AI_QA"] as const;
const purposeLabels: Record<string, string> = { SHOOT: "Rodajes", PAYMENT: "Cobros", APPROVAL: "Aprobaciones", AI_QA: "Preguntas" };
const promptTypeLabels: Record<string, string> = { APPROVAL_DRAFT: "Aprobación de cliente", AI_DRAFT: "Respuesta sugerida", TASK_PICK: "Elegir tarea", GROUP_MATCH: "Asignar grupo", ENABLE_CLIENTS: "Activar mensajes a clientes", PROMOTE_AUTO: "Proponer modo automático", ALERT: "Aviso" };
const modeLabels: Record<string, string> = { OFF: "Apagado", DRAFT: "Borrador", AUTO: "Automático" };
const statusLabels: Record<string, string> = { PENDING: "Pendiente", APPROVED: "Aprobado", REJECTED: "Rechazado", UNMATCHED: "Sin match", CHANGES_REQUESTED: "Cambios pedidos", EXPIRED: "Vencido", SENT: "Enviado", FAILED: "Fallido", DRAFT: "Borrador", QUEUED: "En cola", DISCARDED: "Descartado", CANCELLED: "Cancelado" };
const EASE = [0.23, 1, 0.32, 1] as const;

const statusTone = (status: string) =>
  ["APPROVED", "SENT"].includes(status) ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 ring-emerald-500/20"
  : ["FAILED", "REJECTED"].includes(status) ? "bg-red-500/10 text-red-600 dark:text-red-400 ring-red-500/20"
  : ["PENDING", "QUEUED", "DRAFT", "CHANGES_REQUESTED"].includes(status) ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 ring-amber-500/20"
  : "bg-muted text-muted-foreground ring-border";

const fmt = (d: Date | string, opts: Intl.DateTimeFormatOptions = { dateStyle: "medium", timeStyle: "short" }) => new Date(d).toLocaleString("es-EC", opts);
const initials = (name: string) => name.split(/\s+/).filter(Boolean).map((p) => p[0]).join("").slice(0, 2).toUpperCase();
const selectCls = "h-10 w-full appearance-none rounded-lg border bg-background pl-3 pr-8 text-sm transition-colors hover:border-foreground/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function StatusPill({ status }: { status: string }) {
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${statusTone(status)}`}>{statusLabels[status] ?? status}</span>;
}

function Select({ value, onChange, children, label }: { value: string; onChange: (v: string) => void; children: React.ReactNode; label?: string }) {
  return <span className="relative block"><select aria-label={label} className={selectCls} value={value} onChange={(e) => onChange(e.target.value)}>{children}</select><ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /></span>;
}

function Field({ label, hint, children }: { label: string; hint?: React.ReactNode; children: React.ReactNode }) {
  return <label className="grid content-start gap-1.5"><span className="text-xs font-medium text-muted-foreground">{label}</span>{children}{hint && <span className="text-xs leading-snug text-muted-foreground">{hint}</span>}</label>;
}

function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return <button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)} className={`relative inline-flex h-6 w-10 shrink-0 items-center rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${checked ? "bg-emerald-500" : "bg-muted-foreground/30"}`}><span className={`inline-block size-5 rounded-full bg-white shadow-sm transition-transform duration-200 ease-out ${checked ? "translate-x-[18px]" : "translate-x-0.5"}`} /></button>;
}

function ToggleRow({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return <div className="flex items-center justify-between gap-4 rounded-xl border border-border/70 bg-background/40 p-4"><div className="min-w-0"><p className="text-sm font-medium">{label}</p>{hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}</div><Switch checked={checked} onChange={onChange} label={label} /></div>;
}

function Empty({ icon: Icon, title, hint }: { icon: typeof Inbox; title: string; hint?: string }) {
  return <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border/80 px-6 py-14 text-center"><span className="flex size-12 items-center justify-center rounded-lg bg-muted text-muted-foreground"><Icon className="size-5" /></span><p className="mt-4 text-sm font-medium">{title}</p>{hint && <p className="mt-1 max-w-sm text-xs leading-relaxed text-muted-foreground">{hint}</p>}</div>;
}

function Panel({ title, description, action, children }: { title: string; description?: string; action?: React.ReactNode; children: React.ReactNode }) {
  return <section className="rounded-2xl border border-border/70 bg-card"><header className="flex flex-wrap items-start justify-between gap-3 border-b border-border/70 px-5 py-4 sm:px-6"><div><h2 className="text-base font-semibold tracking-[-0.01em]">{title}</h2>{description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}</div>{action}</header><div className="p-5 sm:p-6">{children}</div></section>;
}

/** Burbuja estilo WhatsApp para mostrar mensajes salientes. */
function Bubble({ children, meta }: { children: React.ReactNode; meta?: React.ReactNode }) {
  return <div className="relative max-w-full rounded-lg rounded-tr-md bg-emerald-500/[0.09] px-3.5 py-2.5 ring-1 ring-inset ring-emerald-500/15"><div className="whitespace-pre-wrap break-words text-sm leading-relaxed">{children}</div>{meta && <div className="mt-1 flex items-center justify-end gap-1.5 text-xs text-muted-foreground">{meta}</div>}</div>;
}

function GeneralSettings({ config, busy, onSave }: { config: Props["config"]; busy: boolean; onSave: (value: { ownerPhone: string; approvalReminderHours: number; maxApprovalReminders: number; skipWeekends: boolean; teamDailyHour: string; amountsInGroups: boolean }) => void }) {
  const [ownerPhone, setOwnerPhone] = useState(config.ownerPhone ?? "");
  const [hours, setHours] = useState(String(config.approvalReminderHours));
  const [maxReminders, setMaxReminders] = useState(String(config.maxApprovalReminders));
  const [skipWeekends, setSkipWeekends] = useState(config.skipWeekends);
  const [teamDailyHour, setTeamDailyHour] = useState(config.teamDailyHour);
  const [amountsInGroups, setAmountsInGroups] = useState(config.amountsInGroups);
  const dirty = ownerPhone !== (config.ownerPhone ?? "") || hours !== String(config.approvalReminderHours) || maxReminders !== String(config.maxApprovalReminders) || skipWeekends !== config.skipWeekends || teamDailyHour !== config.teamDailyHour || amountsInGroups !== config.amountsInGroups;
  return <div className="space-y-4">
    <Panel title="Dueño" description="Recibe decisiones y avisos en su chat privado. Su número debe ser distinto al vinculado al bot.">
      <div className="grid gap-4 sm:grid-cols-2"><Field label="Teléfono del dueño" hint="Formato internacional sin +, p. ej. 5939…"><Input value={ownerPhone} onChange={(e) => setOwnerPhone(e.target.value)} placeholder="5939…" autoComplete="tel" inputMode="tel" /></Field><Field label="Resumen diario del equipo" hint="Hora en que el equipo recibe su agenda."><Input type="time" value={teamDailyHour} onChange={(e) => setTeamDailyHour(e.target.value)} /></Field></div>
    </Panel>
    <Panel title="Recordatorios de aprobación" description="Cuándo y cuántas veces se recuerda a un cliente que tiene un video por aprobar.">
      <div className="grid gap-4 sm:grid-cols-2"><Field label="Horas antes del recordatorio" hint="Entre 1 y 168 horas."><Input type="number" min={1} max={168} value={hours} onChange={(e) => setHours(e.target.value)} inputMode="numeric" /></Field><Field label="Máximo de recordatorios" hint="0 los desactiva; máximo 2."><Input type="number" min={0} max={2} value={maxReminders} onChange={(e) => setMaxReminders(e.target.value)} inputMode="numeric" /></Field></div>
    </Panel>
    <Panel title="Comportamiento">
      <div className="grid gap-3 sm:grid-cols-2"><ToggleRow checked={skipWeekends} onChange={setSkipWeekends} label="Saltar fines de semana" hint="No envía recordatorios sábado ni domingo." /><ToggleRow checked={amountsInGroups} onChange={setAmountsInGroups} label="Montos de cobro en grupos" hint="Apagado: los grupos reciben avisos sin cifras." /></div>
    </Panel>
    <div className="sticky bottom-4 z-10 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/70 bg-card/90 px-5 py-3 shadow-lg backdrop-blur-xl">
      <p className="flex items-center gap-2 text-xs text-muted-foreground"><ShieldCheck className="size-4 shrink-0 text-emerald-500" />Mensajes a clientes: {config.clientsEnabled ? "habilitados por decisión del dueño" : "bloqueados hasta una decisión explícita del dueño"}.</p>
      <Button disabled={busy || !dirty} onClick={() => onSave({ ownerPhone, approvalReminderHours: Number(hours), maxApprovalReminders: Number(maxReminders), skipWeekends, teamDailyHour, amountsInGroups })}>{dirty ? "Guardar cambios" : "Sin cambios"}</Button>
    </div>
  </div>;
}

export default function WhatsAppAdmin(props: Props) {
  const router = useRouter();
  const reduce = useReducedMotion();
  const [busy, startTransition] = useTransition();
  const [notice, setNotice] = useState("");
  const [qrOpen, setQrOpen] = useState(false);
  const [qrRefresh, setQrRefresh] = useState(0);
  const [qrError, setQrError] = useState(false);
  const [historyKind, setHistoryKind] = useState("ALL");
  const [historyStatus, setHistoryStatus] = useState("ALL");
  const [activeTab, setActiveTab] = useState<Section>("inbox");
  useEffect(() => { if (!notice) return; const t = setTimeout(() => setNotice(""), 4000); return () => clearTimeout(t); }, [notice]);
  const filteredHistory = useMemo(() => props.history.filter((item) => (historyKind === "ALL" || item.kind === historyKind) && (historyStatus === "ALL" || item.status === historyStatus)), [props.history, historyKind, historyStatus]);
  const run = (work: () => Promise<unknown>, success = "Cambios guardados.") => startTransition(async () => { try { await work(); setNotice(success); router.refresh(); } catch (error) { setNotice(error instanceof Error ? error.message : "No se pudo completar la acción."); } });
  const pretty = (value: unknown) => JSON.stringify(value ?? {}, null, 2);
  const optionsOf = (value: unknown): Array<string | { label?: string; text?: string; title?: string }> => Array.isArray(value) ? value.filter((item): item is string | { label?: string; text?: string; title?: string } => typeof item === "string" || (typeof item === "object" && item !== null)) : [];
  const payloadOf = (value: unknown): Record<string, unknown> => typeof value === "object" && value !== null ? value as Record<string, unknown> : {};

  const pendingApprovals = props.approvals.filter((a) => a.status === "PENDING").length;
  const failed = props.config.queue?.failed ?? 0;
  const queued = props.config.queue?.pending ?? 0;
  const inboxCount = props.prompts.length + props.drafts.length;
  const workerLabel = props.health.online === null ? "Sin configurar" : props.health.connected ? props.health.pairingOnly ? "Vínculo local verificado" : "Conectado" : props.health.pairingOnly && props.health.qrAvailable ? "QR local disponible" : props.health.online ? "Disponible" : "Sin conexión";
  const live = props.health.connected && !props.config.paused;
  const enabledGroups = props.groups.filter((g) => g.enabled).length;
  const optedIn = props.team.filter((p) => p.whatsappOptIn).length;

  const nav: Array<{ key: Section; label: string; icon: typeof Inbox; count?: number; tone?: "danger" | "muted" }> = [
    { key: "inbox", label: "Bandeja", icon: Inbox, count: inboxCount },
    { key: "approvals", label: "Aprobaciones", icon: Video, count: pendingApprovals },
    { key: "groups", label: "Grupos", icon: UsersRound, count: props.groups.length, tone: "muted" },
    { key: "team", label: "Equipo", icon: Users },
    { key: "clients", label: "Clientes", icon: UserRound },
    { key: "history", label: "Historial", icon: History, count: failed, tone: "danger" },
    { key: "config", label: "Configuración", icon: Settings2 },
  ];

  return <div className="min-h-screen pb-16">
    <Dialog open={qrOpen} onOpenChange={setQrOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Vincular WhatsApp</DialogTitle>
          <DialogDescription>Escanea este código QR desde WhatsApp en el teléfono que usará Totem Bot.</DialogDescription>
        </DialogHeader>
        <div className="flex min-h-72 flex-col items-center justify-center gap-4 px-4 pb-4">
          {qrError ? <div role="alert" className="max-w-sm text-center text-sm text-muted-foreground">No se pudo cargar el QR. Puede que aún no haya un código pendiente o que el worker no responda. Actualiza para volver a consultar.</div> : qrRefresh > 0 && <Image key={qrRefresh} src={`/api/admin/whatsapp/qr?refresh=${qrRefresh}`} alt="Código QR para vincular Totem Bot con WhatsApp" width={320} height={320} unoptimized onError={() => setQrError(true)} className="h-auto w-full max-w-80 rounded-lg border bg-white p-2" />}
          <Button variant="outline" onClick={() => { setQrError(false); setQrRefresh(Date.now()); }}><RefreshCw className="mr-2 h-4 w-4" />Actualizar QR</Button>
        </div>
      </DialogContent>
    </Dialog>

    <AnimatePresence>
      {notice && <motion.div role="status" initial={{ opacity: 0, y: 12, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8 }} transition={{ duration: 0.2, ease: EASE }} className="fixed bottom-6 left-1/2 z-50 flex w-[min(92vw,420px)] -translate-x-1/2 items-center gap-3 rounded-2xl border bg-popover px-4 py-3 text-sm text-popover-foreground shadow-xl"><CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" /><span className="min-w-0 flex-1">{notice}</span><button className="rounded p-0.5 text-muted-foreground transition-colors hover:text-foreground" onClick={() => setNotice("")} aria-label="Cerrar aviso"><X className="h-4 w-4" /></button></motion.div>}
    </AnimatePresence>

    <div className="mx-auto max-w-7xl space-y-6 px-4 pt-6 sm:px-6">
      {/* Hero de estado */}
      <section className="relative overflow-hidden rounded-3xl border border-border/70 bg-card">
        <div aria-hidden className={`pointer-events-none absolute -right-24 -top-24 size-72 rounded-full blur-3xl ${live ? "bg-emerald-500/20" : props.config.paused ? "bg-amber-500/15" : "bg-muted-foreground/10"}`} />
        <div className="relative flex flex-col gap-6 p-6 sm:p-7 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="flex size-14 items-center justify-center rounded-lg bg-emerald-500/12 text-emerald-500 ring-1 ring-inset ring-emerald-500/20"><MessageCircle className="size-7" /></div>
              <span className="absolute -bottom-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full bg-card">
                {live && <span className="absolute inline-flex size-3 animate-ping rounded-full bg-emerald-500 opacity-50 motion-reduce:hidden" />}
                <span className={`relative inline-flex size-2.5 rounded-full ${live ? "bg-emerald-500" : props.config.paused ? "bg-amber-500" : "bg-muted-foreground/60"}`} />
              </span>
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-[-0.03em]">Totem Bot</h1>
              <p className="mt-0.5 text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{props.config.paused ? "En pausa" : "Activo"}</span> · WhatsApp {workerLabel.toLowerCase()} · clientes {props.config.clientsEnabled ? "habilitados" : "bloqueados"}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 sm:flex sm:items-center sm:gap-0 sm:divide-x sm:divide-border/70">
            <HeroStat label="Por enviar" value={queued} onClick={() => { setHistoryStatus("ALL"); setActiveTab("history"); }} />
            <HeroStat label="Decisiones" value={props.prompts.length} warn={props.prompts.length > 0} onClick={() => setActiveTab("inbox")} />
            <HeroStat label="Fallidos" value={failed} danger={failed > 0} onClick={() => { setHistoryStatus(failed ? "FAILED" : "ALL"); setActiveTab("history"); }} />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {props.health.configured && <Button variant="outline" className="rounded-xl" onClick={() => { setQrError(false); setQrRefresh(Date.now()); setQrOpen(true); }}><QrCode className="mr-2 h-4 w-4" />Ver QR</Button>}
            <Button className={`rounded-xl ${props.config.paused ? "bg-emerald-600 text-white hover:bg-emerald-600/90" : ""}`} variant={props.config.paused ? "default" : "outline"} disabled={busy} onClick={() => run(() => pauseWhatsAppAction(!props.config.paused), props.config.paused ? "Bot reanudado." : "Bot pausado.")}>
              {props.config.paused ? <><CirclePlay className="mr-2 h-4 w-4" />Reanudar bot</> : <><CirclePause className="mr-2 h-4 w-4" />Pausar bot</>}
            </Button>
          </div>
        </div>
        {props.health.details && <div className="relative flex items-center gap-2 border-t border-border/70 px-6 py-2.5 text-xs text-muted-foreground sm:px-7"><Activity className="size-3.5" />{props.health.details} · {enabledGroups}/{props.groups.length} grupos activos · {optedIn}/{props.team.length} del equipo con WhatsApp</div>}
      </section>

      <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
        {/* Navegación */}
        <nav aria-label="Secciones de WhatsApp" className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] lg:mx-0 lg:overflow-visible lg:px-0">
          <ul className="flex gap-1 lg:sticky lg:top-6 lg:flex-col">
            {nav.map((item) => {
              const active = activeTab === item.key;
              const Icon = item.icon;
              return <li key={item.key}>
                <button type="button" onClick={() => setActiveTab(item.key)} aria-current={active ? "page" : undefined} className={`relative flex w-full items-center gap-2.5 whitespace-nowrap rounded-xl px-3 py-2 text-sm transition-colors duration-150 ${active ? "text-foreground" : "text-muted-foreground hover:bg-primary/[0.1] hover:text-foreground"}`}>
                  {active && <motion.span layoutId="wa-nav" className="absolute inset-0 rounded-xl bg-muted" transition={reduce ? { duration: 0 } : { type: "spring", duration: 0.35, bounce: 0.15 }} />}
                  <Icon className="relative size-4" />
                  <span className="relative flex-1 text-left font-medium">{item.label}</span>
                  {!!item.count && <span className={`relative inline-flex min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-semibold tabular-nums ${item.tone === "danger" ? "bg-red-500/15 text-red-500" : item.tone === "muted" ? "bg-foreground/[0.07] text-muted-foreground" : "bg-emerald-500/15 text-emerald-500"}`}>{item.count}</span>}
                </button>
              </li>;
            })}
          </ul>
        </nav>

        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={activeTab} initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18, ease: EASE }} className="min-w-0 space-y-4">
            {activeTab === "inbox" && <>
              <Panel title="Decisiones del dueño" description="Las mismas opciones que recibes por WhatsApp. Vencen en 24 horas.">
                {props.prompts.length === 0 ? <Empty icon={CheckCircle2} title="Todo decidido" hint="Cuando Totem Bot necesite tu aprobación aparecerá aquí y en tu WhatsApp." /> : <div className="space-y-3">
                  {props.prompts.map((prompt) => {
                    const choices = optionsOf(prompt.options);
                    const payload = payloadOf(prompt.payload);
                    const summary = payload.summary ?? payload.question ?? payload.title ?? payload.message ?? payload.text ?? "Revisa la decisión propuesta por Totem Bot.";
                    const referenceText = typeof payload.text === "string" && payload.text !== summary ? payload.text : null;
                    return <article key={prompt.id} className="rounded-2xl border border-border/70 bg-background/40 p-4 sm:p-5">
                      <div className="flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-2"><span className="flex size-7 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500"><Bot className="size-3.5" /></span><span className="text-sm font-semibold">{promptTypeLabels[prompt.type] ?? prompt.type}</span><span className="text-xs text-muted-foreground">#{prompt.id.slice(-6)}</span></div><span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><Clock3 className="size-3" />Vence {fmt(prompt.expiresAt, { dateStyle: "short", timeStyle: "short" })}</span></div>
                      <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed">{String(summary)}</p>
                      {referenceText && <div className="mt-3"><p className="mb-1.5 text-xs font-medium uppercase tracking-[0.06em] text-muted-foreground">Texto de referencia</p><Bubble>{referenceText}</Bubble></div>}
                      {payload.proposedText !== undefined && <div className="mt-3"><p className="mb-1.5 text-xs font-medium uppercase tracking-[0.06em] text-muted-foreground">Respuesta propuesta</p><Bubble>{String(payload.proposedText)}</Bubble></div>}
                      <div className="mt-4 flex flex-wrap gap-2">{choices.map((choice, index) => { const label = typeof choice === "string" ? choice : choice.label ?? choice.text ?? choice.title ?? `Opción ${index + 1}`; return <Button key={index} size="sm" className="rounded-lg" variant={index === 0 ? "default" : "outline"} disabled={busy} onClick={() => { if (prompt.type === "APPROVAL_DRAFT" && index === 2) { setActiveTab("approvals"); return; } run(() => decideOwnerPromptAction(prompt.id, String(index + 1)), "Decisión registrada."); }}>{label}</Button>; })}</div>
                    </article>;
                  })}
                </div>}
              </Panel>
              <Panel title="Borradores de salida" description="Edita antes de aprobar; aprobar envía el mensaje a la cola.">
                {props.drafts.length === 0 ? <Empty icon={Inbox} title="No hay borradores" hint="Los mensajes que requieran revisión antes de enviarse se listarán aquí." /> : <div className="space-y-3">
                  {props.drafts.map((draft) => <DraftEditor key={draft.id} draft={draft} busy={busy} onSave={(body) => run(() => saveWhatsAppDraftAction(draft.id, body, false), "Edición guardada.")} onApprove={(body) => run(() => saveWhatsAppDraftAction(draft.id, body, true), "Borrador aprobado y encolado.")} onDiscard={() => run(() => discardWhatsAppDraftAction(draft.id), "Borrador descartado.")} />)}
                </div>}
              </Panel>
            </>}

            {activeTab === "approvals" && <Panel title="Aprobaciones de videos" description="Pendientes, sin match y resueltas. Deshacer restaura el estado anterior de la tarea.">
              {props.approvals.length === 0 ? <Empty icon={Video} title="No hay solicitudes de aprobación" hint="Cuando se envíe un video a un grupo de cliente aparecerá aquí." /> : <ul className="divide-y divide-border/60">
                {props.approvals.map((approval) => <li key={approval.id} className="flex flex-wrap items-center justify-between gap-3 py-3.5 first:pt-0 last:pb-0">
                  <div className="flex min-w-0 items-center gap-3"><span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground"><Video className="size-4" /></span><div className="min-w-0"><p className="truncate text-sm font-medium">{approval.task?.title ?? approval.fileName ?? "Sin tarea emparejada"}</p><p className="mt-0.5 truncate text-xs text-muted-foreground">{approval.task?.client.name ?? approval.groupJid} · {fmt(approval.sentAt)}{approval.task && ` · tarea: ${statusLabels[approval.task.status] ?? approval.task.status}`}</p></div></div>
                  <div className="flex items-center gap-2"><StatusPill status={approval.status} />{approval.status === "APPROVED" && approval.previousTaskStatus && <Button size="sm" variant="outline" className="rounded-lg" disabled={busy} onClick={() => run(() => undoWhatsAppApprovalAction(approval.id), "Aprobación deshecha; se restauró el estado anterior.")}><RotateCcw className="mr-1.5 h-3.5 w-3.5" />Deshacer</Button>}</div>
                </li>)}
              </ul>}
            </Panel>}

            {activeTab === "groups" && <Panel title="Grupos conectados" description="Asignación, funciones y modos por grupo. El modo automático requiere aprobación del dueño.">
              {props.groups.length === 0 ? <Empty icon={UsersRound} title="Aún no se han detectado grupos" hint="Agrega el número del bot a un grupo y aparecerá aquí." /> : <div className="space-y-3">
                {props.groups.map((group) => <GroupEditor key={group.id} group={group} clients={props.clients} busy={busy} onSave={(value) => run(() => updateWhatsAppGroupAction({ id: group.id, ...value }))} />)}
              </div>}
            </Panel>}

            {activeTab === "team" && <Panel title="Equipo" description="Teléfono, consentimiento de WhatsApp y horario de actividad.">
              <div className="space-y-3">{props.team.map((person) => <TeamEditor key={person.id} person={person} busy={busy} onSave={(value) => run(() => updateWhatsAppTeamMemberAction({ id: person.id, ...value }))} />)}</div>
            </Panel>}

            {activeTab === "clients" && <Panel title="Clientes y cobros" description="Los mensajes a clientes quedan sujetos al interruptor global y al grupo habilitado.">
              <div className="divide-y divide-border/60">{props.clients.map((client) => <ClientEditor key={client.id} client={client} reminderHours={client.approvalReminderHours ?? 48} busy={busy} onSave={(value) => run(() => updateWhatsAppClientAction({ id: client.id, ...value }))} />)}</div>
            </Panel>}

            {activeTab === "history" && <>
              <Panel title="Historial de mensajes" description="Últimos 100 mensajes encolados o enviados." action={<div className="flex gap-2"><div className="w-36"><Select label="Tipo" value={historyKind} onChange={setHistoryKind}><option value="ALL">Todos los tipos</option>{Array.from(new Set(props.history.map((x) => x.kind))).map((x) => <option key={x} value={x}>{x}</option>)}</Select></div><div className="w-36"><Select label="Estado" value={historyStatus} onChange={setHistoryStatus}><option value="ALL">Todos los estados</option>{Array.from(new Set(props.history.map((x) => x.status))).map((x) => <option key={x} value={x}>{statusLabels[x] ?? x}</option>)}</Select></div></div>}>
                {filteredHistory.length === 0 ? <Empty icon={Send} title="No hay mensajes con esos filtros" /> : <ul className="space-y-4">
                  {filteredHistory.map((item) => <li key={item.id} className="flex flex-col items-end gap-1.5">
                    <div className="flex w-full items-center justify-between gap-2 text-xs text-muted-foreground"><span className="truncate"><span className="font-medium text-foreground">{item.kind}</span> → {item.to}</span><StatusPill status={item.status} /></div>
                    <div className="w-full sm:w-[85%]"><Bubble meta={<>{fmt(item.createdAt, { dateStyle: "short", timeStyle: "short" })}{item.status === "SENT" && <Check className="size-3 text-emerald-500" />}</>}>{item.body}</Bubble></div>
                    {item.error && <p className="text-xs text-red-500">{item.error}</p>}
                  </li>)}
                </ul>}
              </Panel>
              <Panel title="Eventos recientes" description="Registro técnico del worker.">
                {props.events.length === 0 ? <Empty icon={Activity} title="Sin eventos registrados" /> : <ul className="space-y-2">{props.events.map((event) => <li key={event.id}><details className="group rounded-xl border border-border/70 bg-background/40 px-4 py-3"><summary className="flex cursor-pointer list-none items-center justify-between gap-3"><span className="flex items-center gap-2"><span className="size-1.5 rounded-full bg-muted-foreground/60" /><span className="font-mono text-xs">{event.type}</span></span><span className="flex items-center gap-2 text-xs text-muted-foreground"><time>{fmt(event.createdAt, { dateStyle: "short", timeStyle: "short" })}</time><ChevronDown className="size-3.5 transition-transform group-open:rotate-180" /></span></summary><pre className="mt-3 whitespace-pre-wrap break-words rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">{pretty(event.payload)}</pre></details></li>)}</ul>}
              </Panel>
            </>}

            {activeTab === "config" && <GeneralSettings config={props.config} busy={busy} onSave={(value) => run(() => saveWhatsAppGeneralConfigAction(value), "Configuración guardada.")} />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  </div>;
}

function HeroStat({ label, value, onClick, warn, danger }: { label: string; value: number; onClick: () => void; warn?: boolean; danger?: boolean }) {
  return <button type="button" onClick={onClick} className="rounded-xl px-3 py-2 text-left transition-[background-color,transform] duration-150 hover:bg-primary/[0.1] active:scale-[0.97] sm:px-6 sm:text-center">
    <p className={`text-2xl font-semibold tabular-nums tracking-[-0.03em] ${danger ? "text-red-500" : warn ? "text-amber-500" : ""}`}>{value}</p>
    <p className="text-xs text-muted-foreground">{label}</p>
  </button>;
}

function DraftEditor({ draft, busy, onSave, onApprove, onDiscard }: { draft: Props["drafts"][number]; busy: boolean; onSave: (body: string) => void; onApprove: (body: string) => void; onDiscard: () => void }) {
  const [body, setBody] = useState(draft.body);
  const changed = body !== draft.body;
  return <div className="rounded-2xl border border-border/70 bg-background/40 p-4">
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground"><span className="flex items-center gap-2"><Send className="size-3.5" /><span className="font-medium text-foreground">{draft.kind}</span> → {draft.to}</span><span>{fmt(draft.createdAt, { dateStyle: "short", timeStyle: "short" })}</span></div>
    <Textarea value={body} onChange={(event) => setBody(event.target.value)} rows={4} maxLength={4096} className="resize-y rounded-xl border-emerald-500/20 bg-emerald-500/[0.05] text-sm leading-relaxed" />
    <div className="mt-1 text-right text-xs tabular-nums text-muted-foreground">{body.length}/4096</div>
    <div className="mt-2 flex flex-wrap justify-end gap-2"><Button size="sm" variant="ghost" className="rounded-lg text-muted-foreground hover:text-red-500" disabled={busy} onClick={onDiscard}><Trash2 className="mr-1.5 h-3.5 w-3.5" />Descartar</Button><Button size="sm" variant="outline" className="rounded-lg" disabled={busy || !changed} onClick={() => onSave(body)}>Guardar edición</Button><Button size="sm" className="rounded-lg" disabled={busy} onClick={() => onApprove(body)}><Check className="mr-1.5 h-3.5 w-3.5" />Aprobar y encolar</Button></div>
  </div>;
}

function GroupEditor({ group, clients, busy, onSave }: { group: Props["groups"][number]; clients: Props["clients"]; busy: boolean; onSave: (value: { clientId: string | null; purposes: string[]; aiMode: string; approvalMode: string; enabled: boolean }) => void }) {
  const [clientId, setClientId] = useState(group.clientId ?? ""); const [purposes, setPurposes] = useState<string[]>(group.purposes); const [aiMode, setAiMode] = useState(group.aiMode); const [approvalMode, setApprovalMode] = useState(group.approvalMode); const [enabled, setEnabled] = useState(group.enabled);
  const dirty = clientId !== (group.clientId ?? "") || aiMode !== group.aiMode || approvalMode !== group.approvalMode || enabled !== group.enabled || purposes.slice().sort().join() !== group.purposes.slice().sort().join();
  return <article className={`rounded-2xl border p-4 transition-colors sm:p-5 ${enabled ? "border-border/70 bg-background/40" : "border-dashed border-border/70 opacity-80"}`}>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3"><span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-xs font-semibold text-emerald-500">{initials(group.name)}</span><div className="min-w-0"><p className="truncate text-sm font-semibold">{group.name}</p><p className="truncate text-xs text-muted-foreground">{group.client?.name ?? "Sin cliente asignado"}</p></div></div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">{enabled ? "Habilitado" : "Deshabilitado"}<Switch checked={enabled} onChange={setEnabled} label={`Habilitar ${group.name}`} /></div>
    </div>
    <div className="mt-4 flex flex-wrap gap-1.5" role="group" aria-label="Funciones">
      {PURPOSES.map((purpose) => { const on = purposes.includes(purpose); return <button key={purpose} type="button" aria-pressed={on} onClick={() => setPurposes((old) => old.includes(purpose) ? old.filter((x) => x !== purpose) : [...old, purpose])} className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset transition-colors duration-150 active:scale-[0.97] ${on ? "bg-emerald-500/12 text-emerald-600 ring-emerald-500/30 dark:text-emerald-400" : "text-muted-foreground ring-border hover:text-foreground"}`}>{on && <Check className="size-3" />}{purposeLabels[purpose]}</button>; })}
    </div>
    <div className="mt-4 grid gap-3 sm:grid-cols-3">
      <Field label="Cliente"><Select label="Cliente" value={clientId} onChange={setClientId}><option value="">Sin asignar</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>
      <Field label="Respuestas IA"><Select label="Respuestas IA" value={aiMode} onChange={setAiMode}><option value="OFF">{modeLabels.OFF}</option><option value="DRAFT">{modeLabels.DRAFT}</option><option value="AUTO" disabled>Automático (requiere aprobación)</option></Select></Field>
      <Field label="Aprobaciones"><Select label="Aprobaciones" value={approvalMode} onChange={setApprovalMode}><option value="OFF">{modeLabels.OFF}</option><option value="DRAFT">{modeLabels.DRAFT}</option><option value="AUTO" disabled>Automático (requiere aprobación)</option></Select></Field>
    </div>
    <div className="mt-4 flex items-center justify-between gap-3 border-t border-border/60 pt-3"><span className="truncate font-mono text-xs text-muted-foreground">{group.jid}</span><Button size="sm" className="rounded-lg" variant={dirty ? "default" : "outline"} disabled={busy || !dirty} onClick={() => onSave({ clientId: clientId || null, purposes, aiMode, approvalMode, enabled })}>Guardar</Button></div>
  </article>;
}

function TeamEditor({ person, busy, onSave }: { person: Props["team"][number]; busy: boolean; onSave: (value: { phone: string; optedIn: boolean; activeSchedule: string }) => void }) {
  const [phone, setPhone] = useState(person.phone ?? ""); const [optedIn, setOptedIn] = useState(person.whatsappOptIn); const [activeSchedule, setActiveSchedule] = useState(person.activeSchedule == null ? "" : JSON.stringify(person.activeSchedule, null, 2));
  const [open, setOpen] = useState(false);
  const name = person.name ?? person.email ?? "Usuario";
  return <article className="rounded-2xl border border-border/70 bg-background/40 p-4">
    <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_220px_auto] md:items-end">
      <div className="flex min-w-0 items-center gap-3"><span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">{initials(name)}</span><div className="min-w-0"><p className="truncate text-sm font-semibold">{name}</p><p className="text-xs text-muted-foreground">{person.roleLegacy}</p></div></div>
      <Field label="Teléfono"><Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="5939…" autoComplete="tel" inputMode="tel" /></Field>
      <div className="flex items-center gap-3 md:pb-2"><span className="text-xs text-muted-foreground">Acepta WhatsApp</span><Switch checked={optedIn} onChange={setOptedIn} label={`${name} aceptó recibir WhatsApp`} /></div>
    </div>
    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-3">
      <button type="button" onClick={() => setOpen((v) => !v)} className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground" aria-expanded={open}><Clock3 className="size-3.5" />Horario activo {activeSchedule ? "· configurado" : "· sin avisos programados"}<ChevronDown className={`size-3.5 transition-transform ${open ? "rotate-180" : ""}`} /></button>
      <Button size="sm" variant="outline" className="rounded-lg" disabled={busy} onClick={() => onSave({ phone, optedIn, activeSchedule })}>Guardar</Button>
    </div>
    {open && <div className="mt-3"><Field label="Horario activo (JSON)" hint={<>Vacío = sin avisos programados. Fechas: <code>{'{"type":"dates","dates":["2026-10-20"]}'}</code> · Días: <code>{'{"type":"weekdays","days":[1,2,3,4,5]}'}</code> (lunes 1 a domingo 7).</>}><Textarea value={activeSchedule} onChange={(e) => setActiveSchedule(e.target.value)} rows={3} maxLength={2000} className="font-mono text-xs" placeholder={'{"type":"dates","dates":["2026-10-20","2026-10-27"]}'} aria-label={`Horario activo de ${name}`} /></Field></div>}
  </article>;
}

function ClientEditor({ client, reminderHours, busy, onSave }: { client: Props["clients"][number]; reminderHours: number; busy: boolean; onSave: (value: { phone: string; target: string; reminderHours: number }) => void }) {
  const [phone, setPhone] = useState(client.whatsappPhone ?? ""); const [target, setTarget] = useState(client.paymentReminderTarget); const [hours, setHours] = useState(String(reminderHours));
  const dirty = phone !== (client.whatsappPhone ?? "") || target !== client.paymentReminderTarget || hours !== String(reminderHours);
  return <div className="grid gap-3 py-4 first:pt-0 last:pb-0 md:grid-cols-[minmax(0,1fr)_180px_150px_120px_auto] md:items-end">
    <div className="flex min-w-0 items-center gap-3 md:pb-2"><span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted text-xs font-semibold text-muted-foreground">{initials(client.name)}</span><p className="truncate text-sm font-medium">{client.name}</p></div>
    <Field label="Teléfono WhatsApp"><Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="5939…" inputMode="tel" /></Field>
    <Field label="Destino de cobros"><Select label="Destino de cobros" value={target} onChange={setTarget}><option value="GROUP">Grupo</option><option value="PERSONAL">Personal</option></Select></Field>
    <Field label="Recordar (h)"><Input type="number" min={1} max={168} value={hours} onChange={(e) => setHours(e.target.value)} inputMode="numeric" /></Field>
    <Button size="sm" className="h-10 rounded-lg" variant={dirty ? "default" : "outline"} disabled={busy || !dirty} onClick={() => onSave({ phone, target, reminderHours: Number(hours) })}>Guardar</Button>
  </div>;
}
