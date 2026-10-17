"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Bot, Check, CheckCircle2, CirclePause, CirclePlay, Clock3, Inbox, MessageCircle, QrCode, Radio, RefreshCw, RotateCcw, Send, ShieldCheck, Users, X } from "lucide-react";
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

const PURPOSES = ["SHOOT", "PAYMENT", "APPROVAL", "AI_QA"] as const;
const purposeLabels: Record<string, string> = { SHOOT: "Rodajes", PAYMENT: "Cobros", APPROVAL: "Aprobaciones", AI_QA: "Preguntas" };
const promptTypeLabels: Record<string, string> = { APPROVAL_DRAFT: "Aprobación de cliente", AI_DRAFT: "Respuesta sugerida", TASK_PICK: "Elegir tarea", GROUP_MATCH: "Asignar grupo", ENABLE_CLIENTS: "Activar mensajes a clientes", PROMOTE_AUTO: "Proponer modo automático", ALERT: "Aviso" };

const statusLabels: Record<string, string> = { PENDING: "Pendiente", APPROVED: "Aprobado", REJECTED: "Rechazado", UNMATCHED: "Sin match", CHANGES_REQUESTED: "Cambios pedidos", EXPIRED: "Vencido", SENT: "Enviado", FAILED: "Fallido", DRAFT: "Borrador", QUEUED: "En cola", DISCARDED: "Descartado", CANCELLED: "Cancelado" };
const statusTone = (status: string) => ["APPROVED", "SENT"].includes(status) ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : ["FAILED", "REJECTED"].includes(status) ? "border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400" : ["PENDING", "QUEUED", "DRAFT", "CHANGES_REQUESTED"].includes(status) ? "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400" : "text-muted-foreground";
function StatusBadge({ status }: { status: string }) { return <Badge variant="outline" className={`font-medium ${statusTone(status)}`}>{statusLabels[status] ?? status}</Badge>; }
function Empty({ icon: Icon, title, hint }: { icon: typeof Inbox; title: string; hint?: string }) { return <div className="flex flex-col items-center justify-center rounded-xl border border-dashed px-6 py-10 text-center"><span className="flex size-10 items-center justify-center rounded-xl bg-muted text-muted-foreground"><Icon className="size-5" /></span><p className="mt-3 text-sm font-medium">{title}</p>{hint && <p className="mt-1 max-w-xs text-xs text-muted-foreground">{hint}</p>}</div>; }
function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (value: boolean) => void; label: string; hint?: string }) {
  return <label className="flex cursor-pointer items-start justify-between gap-4 rounded-lg border bg-background/40 p-3 transition-colors hover:bg-muted/40"><span className="min-w-0"><span className="block text-sm font-medium">{label}</span>{hint && <span className="mt-0.5 block text-xs text-muted-foreground">{hint}</span>}</span><span className="relative mt-0.5 inline-flex shrink-0"><input type="checkbox" className="peer sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} /><span className="h-5 w-9 rounded-full bg-muted-foreground/30 transition-colors duration-200 peer-checked:bg-primary peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-background" /><span className="pointer-events-none absolute left-0.5 top-0.5 size-4 rounded-full bg-background shadow-sm transition-transform duration-200 ease-out peer-checked:translate-x-4" /></span></label>;
}

function Label({ children }: { children: React.ReactNode }) { return <span className="text-xs font-medium text-muted-foreground">{children}</span>; }
function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) { return <label className="grid content-start gap-1.5"><Label>{label}</Label>{children}{hint && <span className="text-[11px] leading-snug text-muted-foreground">{hint}</span>}</label>; }

function GeneralSettings({ config, busy, onSave }: { config: Props["config"]; busy: boolean; onSave: (value: { ownerPhone: string; approvalReminderHours: number; maxApprovalReminders: number; skipWeekends: boolean; teamDailyHour: string; amountsInGroups: boolean }) => void }) {
  const [ownerPhone, setOwnerPhone] = useState(config.ownerPhone ?? "");
  const [hours, setHours] = useState(String(config.approvalReminderHours));
  const [maxReminders, setMaxReminders] = useState(String(config.maxApprovalReminders));
  const [skipWeekends, setSkipWeekends] = useState(config.skipWeekends);
  const [teamDailyHour, setTeamDailyHour] = useState(config.teamDailyHour);
  const [amountsInGroups, setAmountsInGroups] = useState(config.amountsInGroups);
  const dirty = ownerPhone !== (config.ownerPhone ?? "") || hours !== String(config.approvalReminderHours) || maxReminders !== String(config.maxApprovalReminders) || skipWeekends !== config.skipWeekends || teamDailyHour !== config.teamDailyHour || amountsInGroups !== config.amountsInGroups;
  return <Card className="overflow-hidden"><CardHeader><CardTitle className="text-base">Configuración general</CardTitle><CardDescription>El dueño recibe decisiones y avisos en su chat privado. Su número debe ser distinto al número vinculado al bot.</CardDescription></CardHeader><CardContent className="space-y-6">
    <section className="space-y-3"><h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Dueño</h3><div className="grid gap-4 sm:grid-cols-2"><Field label="Teléfono del dueño" hint="Formato internacional sin +, p. ej. 5939…"><Input value={ownerPhone} onChange={(e) => setOwnerPhone(e.target.value)} placeholder="5939…" autoComplete="tel" inputMode="tel" /></Field><Field label="Resumen diario del equipo" hint="Hora en que el equipo recibe su agenda."><Input type="time" value={teamDailyHour} onChange={(e) => setTeamDailyHour(e.target.value)} /></Field></div></section>
    <section className="space-y-3"><h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Recordatorios de aprobación</h3><div className="grid gap-4 sm:grid-cols-2"><Field label="Horas antes del recordatorio" hint="Entre 1 y 168 horas."><Input type="number" min={1} max={168} value={hours} onChange={(e) => setHours(e.target.value)} inputMode="numeric" /></Field><Field label="Máximo de recordatorios" hint="0 desactiva los recordatorios; máximo 2."><Input type="number" min={0} max={2} value={maxReminders} onChange={(e) => setMaxReminders(e.target.value)} inputMode="numeric" /></Field></div></section>
    <section className="space-y-3"><h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Comportamiento</h3><div className="grid gap-3 sm:grid-cols-2"><Toggle checked={skipWeekends} onChange={setSkipWeekends} label="Saltar fines de semana" hint="No envía recordatorios sábado ni domingo." /><Toggle checked={amountsInGroups} onChange={setAmountsInGroups} label="Montos de cobro en grupos" hint="Si está apagado, los grupos reciben avisos sin cifras." /></div></section>
    <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4"><p className="flex items-center gap-2 text-xs text-muted-foreground"><ShieldCheck className="size-3.5 shrink-0" />Mensajes a clientes: {config.clientsEnabled ? "habilitados por decisión del dueño" : "bloqueados hasta una decisión explícita del dueño"}.</p><Button disabled={busy || !dirty} onClick={() => onSave({ ownerPhone, approvalReminderHours: Number(hours), maxApprovalReminders: Number(maxReminders), skipWeekends, teamDailyHour, amountsInGroups })}>{dirty ? "Guardar cambios" : "Sin cambios"}</Button></div>
  </CardContent></Card>;
}

export default function WhatsAppAdmin(props: Props) {
  const router = useRouter();
  const [busy, startTransition] = useTransition();
  const [notice, setNotice] = useState("");
  const [qrOpen, setQrOpen] = useState(false);
  const [qrRefresh, setQrRefresh] = useState(0);
  const [qrError, setQrError] = useState(false);
  const [historyKind, setHistoryKind] = useState("ALL");
  const [historyStatus, setHistoryStatus] = useState("ALL");
  const [activeTab, setActiveTab] = useState("inbox");
  useEffect(() => { if (!notice) return; const t = setTimeout(() => setNotice(""), 4000); return () => clearTimeout(t); }, [notice]);
  const pendingApprovals = props.approvals.filter((a) => a.status === "PENDING").length;
  const failed = props.config.queue?.failed ?? 0;
  const inboxCount = props.prompts.length + props.drafts.length;
  const workerLabel = props.health.online === null ? "Sin configurar" : props.health.connected ? props.health.pairingOnly ? "Vínculo local verificado" : "En línea" : props.health.pairingOnly && props.health.qrAvailable ? "QR local disponible" : props.health.online ? "Disponible" : "Sin conexión";
  const workerTone = props.health.connected ? "bg-emerald-500" : props.health.online ? "bg-amber-500" : "bg-muted-foreground/50";
  const filteredHistory = useMemo(() => props.history.filter((item) => (historyKind === "ALL" || item.kind === historyKind) && (historyStatus === "ALL" || item.status === historyStatus)), [props.history, historyKind, historyStatus]);
  const run = (work: () => Promise<unknown>, success = "Cambios guardados.") => startTransition(async () => { try { await work(); setNotice(success); router.refresh(); } catch (error) { setNotice(error instanceof Error ? error.message : "No se pudo completar la acción."); } });
  const pretty = (value: unknown) => JSON.stringify(value ?? {}, null, 2);
  const optionsOf = (value: unknown): Array<string | { label?: string; text?: string; title?: string }> => Array.isArray(value) ? value.filter((item): item is string | { label?: string; text?: string; title?: string } => typeof item === "string" || (typeof item === "object" && item !== null)) : [];
  const payloadOf = (value: unknown): Record<string, unknown> => typeof value === "object" && value !== null ? value as Record<string, unknown> : {};

  return <div className="min-h-screen bg-muted/30">
    <header className="sticky top-0 z-10 border-b bg-background/85 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-4">
        <div className="flex min-w-0 items-center gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"><MessageCircle className="h-5 w-5" /></div><div className="min-w-0"><div className="flex items-center gap-2"><h1 className="text-xl font-semibold tracking-[-0.02em]">WhatsApp</h1><span className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium text-muted-foreground"><span className="relative flex size-1.5">{props.health.connected && !props.config.paused && <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-60 motion-reduce:hidden" />}<span className={`relative inline-flex size-1.5 rounded-full ${props.config.paused ? "bg-amber-500" : workerTone}`} /></span>{props.config.paused ? "Pausado" : workerLabel}</span></div><p className="truncate text-xs text-muted-foreground">Totem Bot · configuración y actividad</p></div></div>
        <div className="flex items-center gap-2">
          {props.health.configured && <Button variant="outline" onClick={() => { setQrError(false); setQrRefresh(Date.now()); setQrOpen(true); }}><QrCode className="mr-2 h-4 w-4" />Ver QR</Button>}
          <Button variant={props.config.paused ? "default" : "outline"} disabled={busy} onClick={() => run(() => pauseWhatsAppAction(!props.config.paused), props.config.paused ? "Bot reanudado." : "Bot pausado.")}>
            {props.config.paused ? <><CirclePlay className="mr-2 h-4 w-4" />Reanudar</> : <><CirclePause className="mr-2 h-4 w-4" />Pausar bot</>}
          </Button>
        </div>
      </div>
    </header>
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
    <main className="mx-auto max-w-7xl space-y-5 px-4 py-6">
      {notice && <div role="status" className="fixed bottom-5 left-1/2 z-50 flex w-[min(92vw,420px)] -translate-x-1/2 items-center gap-3 rounded-xl border bg-popover px-4 py-3 text-sm text-popover-foreground shadow-lg motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2"><CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" /><span className="min-w-0 flex-1">{notice}</span><button className="rounded p-0.5 text-muted-foreground transition-colors hover:text-foreground" onClick={() => setNotice("")} aria-label="Cerrar aviso"><X className="h-4 w-4" /></button></div>}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard label="Worker" value={workerLabel} detail={props.health.details} icon={Radio} tone={props.health.connected ? "good" : props.health.online ? "warn" : "muted"} />
        <StatCard label="Estado del bot" value={props.config.paused ? "Pausado" : "Activo"} detail={`Clientes: ${props.config.clientsEnabled ? "habilitados" : "bloqueados"}`} icon={Bot} tone={props.config.paused ? "warn" : "good"} />
        <StatCard label="Cola" value={`${props.config.queue?.pending ?? 0} por enviar`} detail={`${props.config.queue?.draft ?? 0} borradores · ${failed} fallidos`} icon={Send} tone={failed ? "bad" : "muted"} onClick={() => { setHistoryStatus(failed ? "FAILED" : "ALL"); setActiveTab("history"); }} />
        <StatCard label="Bandeja de aprobación" value={`${props.prompts.length} ${props.prompts.length === 1 ? "decisión" : "decisiones"}`} detail={`${pendingApprovals} ${pendingApprovals === 1 ? "video pendiente" : "videos pendientes"}`} icon={Check} tone={props.prompts.length || pendingApprovals ? "warn" : "muted"} onClick={() => setActiveTab(props.prompts.length ? "inbox" : "approvals")} />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <div className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none]"><TabsList className="h-auto w-max justify-start"><TabsTrigger value="inbox">Bandeja<Count n={inboxCount} /></TabsTrigger><TabsTrigger value="approvals">Aprobaciones<Count n={pendingApprovals} /></TabsTrigger><TabsTrigger value="groups">Grupos<Count n={props.groups.length} muted /></TabsTrigger><TabsTrigger value="team">Equipo</TabsTrigger><TabsTrigger value="clients">Clientes</TabsTrigger><TabsTrigger value="history">Historial<Count n={failed} danger /></TabsTrigger><TabsTrigger value="config">Configuración</TabsTrigger></TabsList></div>
        <TabsContent value="config"><GeneralSettings config={props.config} busy={busy} onSave={(value) => run(() => saveWhatsAppGeneralConfigAction(value), "Configuración guardada.")} /></TabsContent>
        <TabsContent value="inbox" className="grid gap-4 xl:grid-cols-2">
          <Card><CardHeader><CardTitle className="text-base">Decisiones del dueño</CardTitle><CardDescription>Las mismas opciones que recibe por WhatsApp. Vencen en 24 horas.</CardDescription></CardHeader><CardContent className="space-y-3">
            {props.prompts.length === 0 && <Empty icon={CheckCircle2} title="No hay decisiones pendientes" hint="Cuando Totem Bot necesite tu aprobación aparecerá aquí y en tu WhatsApp." />}
            {props.prompts.map((prompt) => {
              const choices = optionsOf(prompt.options);
              const payload = payloadOf(prompt.payload);
              const summary = payload.summary ?? payload.question ?? payload.title ?? payload.message ?? payload.text ?? "Revisa la decisión propuesta por Totem Bot.";
              const referenceText = typeof payload.text === "string" && payload.text !== summary ? payload.text : null;
              return <article key={prompt.id} className="rounded-xl border bg-background/40 p-4 transition-colors hover:border-foreground/20"><div className="flex flex-wrap items-center justify-between gap-2"><div className="font-medium">{promptTypeLabels[prompt.type] ?? prompt.type} <span className="text-muted-foreground">#{prompt.id}</span></div><Badge variant="secondary" className="gap-1"><Clock3 className="size-3" />Vence {new Date(prompt.expiresAt).toLocaleString("es-EC", { dateStyle: "short", timeStyle: "short" })}</Badge></div><p className="mt-2 whitespace-pre-wrap text-sm">{String(summary)}</p>{referenceText && <blockquote className="mt-2 rounded bg-muted p-3 text-sm"><span className="mb-1 block text-xs font-medium text-muted-foreground">Texto de referencia</span>{referenceText}</blockquote>}{payload.proposedText !== undefined && <blockquote className="mt-2 rounded bg-muted p-3 text-sm"><span className="mb-1 block text-xs font-medium text-muted-foreground">Respuesta propuesta</span>{String(payload.proposedText)}</blockquote>}<div className="mt-3 flex flex-wrap gap-2">{choices.map((choice, index) => { const label = typeof choice === "string" ? choice : choice.label ?? choice.text ?? choice.title ?? `Opción ${index + 1}`; return <Button key={index} size="sm" variant={index === 0 ? "default" : "outline"} disabled={busy} onClick={() => { if (prompt.type === "APPROVAL_DRAFT" && index === 2) { setActiveTab("approvals"); return; } run(() => decideOwnerPromptAction(prompt.id, String(index + 1)), "Decisión registrada."); }}>{label}</Button>; })}</div></article>;
            })}
          </CardContent></Card>
          <Card><CardHeader><CardTitle className="text-base">Borradores de salida</CardTitle><CardDescription>Editar antes de aprobar; aprobar envía el mensaje a la cola.</CardDescription></CardHeader><CardContent className="space-y-3">
            {props.drafts.length === 0 && <Empty icon={Inbox} title="No hay borradores" hint="Los mensajes que requieran revisión antes de enviarse se listarán aquí." />}
            {props.drafts.map((draft) => <DraftEditor key={draft.id} draft={draft} busy={busy} onSave={(body) => run(() => saveWhatsAppDraftAction(draft.id, body, false), "Edición guardada.")} onApprove={(body) => run(() => saveWhatsAppDraftAction(draft.id, body, true), "Borrador aprobado y encolado.")} onDiscard={() => run(() => discardWhatsAppDraftAction(draft.id), "Borrador descartado.")} />)}
          </CardContent></Card>
        </TabsContent>
        <TabsContent value="groups"><Card><CardHeader><CardTitle className="text-base">Grupos conectados</CardTitle><CardDescription>Asignación, funciones y modos por grupo. AUTO opera sin revisión previa.</CardDescription></CardHeader><CardContent className="space-y-3">
          {props.groups.length === 0 && <Empty icon={Users} title="Aún no se han detectado grupos" hint="Agrega el número del bot a un grupo y aparecerá aquí." />}
          {props.groups.map((group) => <GroupEditor key={group.id} group={group} clients={props.clients} busy={busy} onSave={(value) => run(() => updateWhatsAppGroupAction({ id: group.id, ...value }))} />)}
        </CardContent></Card></TabsContent>
        <TabsContent value="team"><Card><CardHeader><CardTitle className="text-base">Equipo</CardTitle><CardDescription>Teléfono, consentimiento de WhatsApp y horario de actividad.</CardDescription></CardHeader><CardContent className="space-y-3">
          {props.team.map((person) => <TeamEditor key={person.id} person={person} busy={busy} onSave={(value) => run(() => updateWhatsAppTeamMemberAction({ id: person.id, ...value }))} />)}
        </CardContent></Card></TabsContent>
        <TabsContent value="clients"><Card><CardHeader><CardTitle className="text-base">Clientes y cobros</CardTitle><CardDescription>Los mensajes a clientes quedan sujetos al interruptor global y al grupo habilitado.</CardDescription></CardHeader><CardContent className="space-y-3">
          {props.clients.map((client) => <ClientEditor key={client.id} client={client} reminderHours={client.approvalReminderHours ?? 48} busy={busy} onSave={(value) => run(() => updateWhatsAppClientAction({ id: client.id, ...value }))} />)}
        </CardContent></Card></TabsContent>
        <TabsContent value="approvals"><Card><CardHeader><CardTitle className="text-base">Aprobaciones de videos</CardTitle><CardDescription>Pendientes, sin match y resueltas. Deshacer restaura el estado anterior de la tarea.</CardDescription></CardHeader><CardContent className="space-y-2">
          {props.approvals.map((approval) => <div key={approval.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"><div className="min-w-0"><div className="flex items-center gap-2"><StatusBadge status={approval.status} /><span className="font-medium">{approval.task?.title ?? approval.fileName ?? "Sin tarea emparejada"}</span></div><p className="mt-1 text-xs text-muted-foreground">{approval.task?.client.name ?? approval.groupJid} · {new Date(approval.sentAt).toLocaleString("es-EC")}{approval.task && ` · tarea: ${approval.task.status}`}</p></div>{approval.status === "APPROVED" && approval.previousTaskStatus && <Button size="sm" variant="outline" disabled={busy} onClick={() => run(() => undoWhatsAppApprovalAction(approval.id), "Aprobación deshecha; se restauró el estado anterior.")}><RotateCcw className="mr-2 h-4 w-4" />Deshacer</Button>}</div>)}
          {props.approvals.length === 0 && <Empty icon={Check} title="No hay solicitudes de aprobación" />}
        </CardContent></Card></TabsContent>
        <TabsContent value="history" className="space-y-4"><Card><CardHeader><CardTitle className="text-base">Historial de mensajes</CardTitle><CardDescription>Últimos 100 mensajes encolados o enviados.</CardDescription></CardHeader><CardContent><div className="mb-4 flex flex-wrap gap-3"><Field label="Tipo"><select className="h-10 rounded-md border bg-background px-3 text-sm" value={historyKind} onChange={(e) => setHistoryKind(e.target.value)}><option value="ALL">Todos</option>{Array.from(new Set(props.history.map((x) => x.kind))).map((x) => <option key={x}>{x}</option>)}</select></Field><Field label="Estado"><select className="h-10 rounded-md border bg-background px-3 text-sm" value={historyStatus} onChange={(e) => setHistoryStatus(e.target.value)}><option value="ALL">Todos</option>{Array.from(new Set(props.history.map((x) => x.status))).map((x) => <option key={x} value={x}>{statusLabels[x] ?? x}</option>)}</select></Field></div><div className="space-y-2">{filteredHistory.map((item) => <div key={item.id} className="rounded-lg border p-3"><div className="flex flex-wrap justify-between gap-2"><span className="font-medium">{item.kind} → {item.to}</span><StatusBadge status={item.status} /></div><p className="mt-2 whitespace-pre-wrap text-sm">{item.body}</p><p className="mt-1 text-xs text-muted-foreground">{new Date(item.createdAt).toLocaleString("es-EC")}{item.error && ` · ${item.error}`}</p></div>)}{filteredHistory.length === 0 && <Empty icon={Clock3} title="No hay mensajes con esos filtros" />}</div></CardContent></Card><Card><CardHeader><CardTitle className="text-base">Eventos recientes</CardTitle></CardHeader><CardContent className="space-y-2">{props.events.map((event) => <div key={event.id} className="flex items-start justify-between gap-3 rounded border p-3"><div><Badge variant="outline">{event.type}</Badge><pre className="mt-2 whitespace-pre-wrap break-words text-xs text-muted-foreground">{pretty(event.payload)}</pre></div><time className="shrink-0 text-xs text-muted-foreground">{new Date(event.createdAt).toLocaleString("es-EC")}</time></div>)}{props.events.length === 0 && <Empty icon={Clock3} title="Sin eventos registrados" />}</CardContent></Card></TabsContent>
      </Tabs>
    </main>
  </div>;
}

function DraftEditor({ draft, busy, onSave, onApprove, onDiscard }: { draft: Props["drafts"][number]; busy: boolean; onSave: (body: string) => void; onApprove: (body: string) => void; onDiscard: () => void }) {
  const [body, setBody] = useState(draft.body);
  return <div className="rounded-lg border p-3"><div className="mb-2 flex justify-between gap-2 text-xs text-muted-foreground"><span>{draft.kind} → {draft.to}</span><span>{new Date(draft.createdAt).toLocaleString("es-EC")}</span></div><Textarea value={body} onChange={(event) => setBody(event.target.value)} rows={3} maxLength={4096} /><div className="mt-2 flex justify-end gap-2"><Button size="sm" variant="ghost" disabled={busy} onClick={onDiscard}>Descartar</Button><Button size="sm" variant="outline" disabled={busy} onClick={() => onSave(body)}>Guardar edición</Button><Button size="sm" disabled={busy} onClick={() => onApprove(body)}><Check className="mr-2 h-4 w-4" />Aprobar y encolar</Button></div></div>;
}

function GroupEditor({ group, clients, busy, onSave }: { group: Props["groups"][number]; clients: Props["clients"]; busy: boolean; onSave: (value: { clientId: string | null; purposes: string[]; aiMode: string; approvalMode: string; enabled: boolean }) => void }) {
  const [clientId, setClientId] = useState(group.clientId ?? ""); const [purposes, setPurposes] = useState<string[]>(group.purposes); const [aiMode, setAiMode] = useState(group.aiMode); const [approvalMode, setApprovalMode] = useState(group.approvalMode); const [enabled, setEnabled] = useState(group.enabled);
  return <article className="grid gap-4 rounded-xl border bg-background/40 p-4 lg:grid-cols-[1fr_2fr_auto] lg:items-center"><div className="min-w-0"><p className="font-medium">{group.name}</p><p className="truncate text-xs text-muted-foreground">{group.jid}</p>{group.client && <p className="mt-1 text-xs">{group.client.name}</p>}</div><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Field label="Cliente"><select className="h-10 rounded-md border bg-background px-3 text-sm" value={clientId} onChange={(e) => setClientId(e.target.value)}><option value="">Sin asignar</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field><Field label="Funciones"><div className="flex flex-wrap gap-x-3 gap-y-2 pt-2">{PURPOSES.map((purpose) => <label key={purpose} className="flex items-center gap-1.5 text-xs"><input type="checkbox" className="size-3.5 accent-[hsl(var(--primary))]" checked={purposes.includes(purpose)} onChange={() => setPurposes((old) => old.includes(purpose) ? old.filter((x) => x !== purpose) : [...old, purpose])} />{purposeLabels[purpose]}</label>)}</div></Field><Field label="Respuestas IA"><select className="h-10 rounded-md border bg-background px-3 text-sm" value={aiMode} onChange={(e) => setAiMode(e.target.value)}><option>OFF</option><option>DRAFT</option><option value="AUTO" disabled>{group.aiMode === "AUTO" ? "AUTO (requiere aprobación)" : "AUTO (requiere aprobación)"}</option></select></Field><Field label="Aprobaciones"><select className="h-10 rounded-md border bg-background px-3 text-sm" value={approvalMode} onChange={(e) => setApprovalMode(e.target.value)}><option>OFF</option><option>DRAFT</option><option value="AUTO" disabled>AUTO (requiere aprobación)</option></select></Field></div><div className="flex items-center justify-between gap-3 lg:flex-col lg:items-end"><label className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-4 accent-[hsl(var(--primary))]" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />Habilitado</label><Button size="sm" variant="outline" disabled={busy} onClick={() => onSave({ clientId: clientId || null, purposes, aiMode, approvalMode, enabled })}>Guardar</Button></div></article>;
}

function TeamEditor({ person, busy, onSave }: { person: Props["team"][number]; busy: boolean; onSave: (value: { phone: string; optedIn: boolean; activeSchedule: string }) => void }) {
  const [phone, setPhone] = useState(person.phone ?? ""); const [optedIn, setOptedIn] = useState(person.whatsappOptIn); const [activeSchedule, setActiveSchedule] = useState(person.activeSchedule == null ? "" : JSON.stringify(person.activeSchedule, null, 2));
  return <div className="grid gap-3 rounded-xl border bg-background/40 p-4 md:grid-cols-[1fr_1fr_2fr_auto] md:items-end"><div><p className="font-medium">{person.name ?? person.email ?? "Usuario"}</p><p className="text-xs text-muted-foreground">{person.roleLegacy}</p></div><Field label="Teléfono"><Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="5939…" autoComplete="tel" /></Field><Field label="Horario activo"><Textarea value={activeSchedule} onChange={(e) => setActiveSchedule(e.target.value)} rows={3} maxLength={2000} placeholder={'{"type":"dates","dates":["2026-10-20","2026-10-27"]}'} aria-label={`Horario activo de ${person.name ?? person.email ?? "usuario"}`} /><span className="text-xs text-muted-foreground">Vacío = sin avisos programados. Para fechas específicas: <code>{'{"type":"dates","dates":["2026-10-20","2026-10-27"]}'}</code>. También admite <code>{'{"type":"weekdays","days":[1,2,3,4,5]}'}</code> (lunes 1 a domingo 7).</span></Field><div className="flex items-center gap-3"><label className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-4 accent-[hsl(var(--primary))]" checked={optedIn} onChange={(e) => setOptedIn(e.target.checked)} />Aceptó recibir WhatsApp</label><Button size="sm" variant="outline" disabled={busy} onClick={() => onSave({ phone, optedIn, activeSchedule })}>Guardar</Button></div></div>;
}

function ClientEditor({ client, reminderHours, busy, onSave }: { client: Props["clients"][number]; reminderHours: number; busy: boolean; onSave: (value: { phone: string; target: string; reminderHours: number }) => void }) {
  const [phone, setPhone] = useState(client.whatsappPhone ?? ""); const [target, setTarget] = useState(client.paymentReminderTarget); const [hours, setHours] = useState(String(reminderHours));
  return <div className="grid gap-3 rounded-xl border bg-background/40 p-4 md:grid-cols-[1fr_1fr_1fr_1fr_auto] md:items-end"><div><p className="font-medium">{client.name}</p></div><Field label="Teléfono WhatsApp"><Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="5939…" /></Field><Field label="Destino de cobros"><select className="h-10 rounded-md border bg-background px-3 text-sm" value={target} onChange={(e) => setTarget(e.target.value)}><option value="GROUP">Grupo</option><option value="PERSONAL">Personal</option></select></Field><Field label="Horas antes de recordar"><Input type="number" min={1} max={168} value={hours} onChange={(e) => setHours(e.target.value)} /></Field><Button size="sm" variant="outline" disabled={busy} onClick={() => onSave({ phone, target, reminderHours: Number(hours) })}>Guardar</Button></div>;
}

function Count({ n, muted, danger }: { n: number; muted?: boolean; danger?: boolean }) {
  if (!n) return null;
  return <span className={`ml-1.5 inline-flex min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-semibold tabular-nums ${danger ? "bg-red-500/15 text-red-600 dark:text-red-400" : muted ? "bg-muted text-muted-foreground" : "bg-primary/15 text-primary"}`}>{n}</span>;
}

function StatCard({ label, value, detail, icon: Icon, tone, onClick }: { label: string; value: string; detail?: string | null; icon: typeof Radio; tone: "good" | "warn" | "bad" | "muted"; onClick?: () => void }) {
  const toneClass = { good: "text-emerald-500 bg-emerald-500/10", warn: "text-amber-500 bg-amber-500/10", bad: "text-red-500 bg-red-500/10", muted: "text-muted-foreground bg-muted" }[tone];
  const body = <><div className="flex items-start justify-between gap-3"><p className="text-xs text-muted-foreground">{label}</p><span className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${toneClass}`}><Icon className="h-4 w-4" /></span></div><p className="mt-2 truncate text-[15px] font-semibold tracking-[-0.01em]">{value}</p>{detail && <p className="mt-0.5 truncate text-xs text-muted-foreground">{detail}</p>}</>;
  const base = "block w-full rounded-xl border bg-card p-4 text-left shadow-sm";
  return onClick ? <button type="button" onClick={onClick} className={`${base} transition-[border-color,transform] duration-150 ease-out hover:border-foreground/20 active:scale-[0.98]`}>{body}</button> : <div className={base}>{body}</div>;
}
