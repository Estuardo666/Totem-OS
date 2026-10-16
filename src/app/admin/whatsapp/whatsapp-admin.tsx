"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Bot, Check, CirclePause, CirclePlay, MessageCircle, Radio, RefreshCw, RotateCcw, Send, X } from "lucide-react";
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

function Label({ children }: { children: React.ReactNode }) { return <span className="text-xs font-medium text-muted-foreground">{children}</span>; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="grid gap-1.5"><Label>{label}</Label>{children}</label>; }

function GeneralSettings({ config, busy, onSave }: { config: Props["config"]; busy: boolean; onSave: (value: { ownerPhone: string; approvalReminderHours: number; maxApprovalReminders: number; skipWeekends: boolean; teamDailyHour: string; amountsInGroups: boolean }) => void }) {
  const [ownerPhone, setOwnerPhone] = useState(config.ownerPhone ?? "");
  const [hours, setHours] = useState(String(config.approvalReminderHours));
  const [maxReminders, setMaxReminders] = useState(String(config.maxApprovalReminders));
  const [skipWeekends, setSkipWeekends] = useState(config.skipWeekends);
  const [teamDailyHour, setTeamDailyHour] = useState(config.teamDailyHour);
  const [amountsInGroups, setAmountsInGroups] = useState(config.amountsInGroups);
  return <Card><CardHeader><CardTitle className="text-base">Configuración inicial</CardTitle><CardDescription>El dueño recibe decisiones y avisos en su chat privado. Su número debe diferir del número vinculado al bot.</CardDescription></CardHeader><CardContent className="space-y-4">
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"><Field label="Teléfono del dueño"><Input value={ownerPhone} onChange={(e) => setOwnerPhone(e.target.value)} placeholder="5939…" autoComplete="tel" /></Field><Field label="Horas antes del recordatorio"><Input type="number" min={1} max={168} value={hours} onChange={(e) => setHours(e.target.value)} /></Field><Field label="Máximo de recordatorios"><Input type="number" min={0} max={2} value={maxReminders} onChange={(e) => setMaxReminders(e.target.value)} /></Field><Field label="Resumen diario del equipo"><Input type="time" value={teamDailyHour} onChange={(e) => setTeamDailyHour(e.target.value)} /></Field>
      <label className="flex items-center gap-2 self-end pb-2 text-sm"><input type="checkbox" checked={skipWeekends} onChange={(e) => setSkipWeekends(e.target.checked)} />Saltar fines de semana</label><label className="flex items-center gap-2 self-end pb-2 text-sm"><input type="checkbox" checked={amountsInGroups} onChange={(e) => setAmountsInGroups(e.target.checked)} />Incluir montos de cobro en grupos</label>
    </div><div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4"><p className="text-xs text-muted-foreground">Mensajes a clientes: {config.clientsEnabled ? "habilitados por decisión del dueño" : "bloqueados hasta una decisión explícita del dueño"}.</p><Button disabled={busy} onClick={() => onSave({ ownerPhone, approvalReminderHours: Number(hours), maxApprovalReminders: Number(maxReminders), skipWeekends, teamDailyHour, amountsInGroups })}>Guardar configuración</Button></div>
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
  const filteredHistory = useMemo(() => props.history.filter((item) => (historyKind === "ALL" || item.kind === historyKind) && (historyStatus === "ALL" || item.status === historyStatus)), [props.history, historyKind, historyStatus]);
  const run = (work: () => Promise<unknown>, success = "Cambios guardados.") => startTransition(async () => { try { await work(); setNotice(success); router.refresh(); } catch (error) { setNotice(error instanceof Error ? error.message : "No se pudo completar la acción."); } });
  const pretty = (value: unknown) => JSON.stringify(value ?? {}, null, 2);
  const optionsOf = (value: unknown): Array<string | { label?: string; text?: string; title?: string }> => Array.isArray(value) ? value.filter((item): item is string | { label?: string; text?: string; title?: string } => typeof item === "string" || (typeof item === "object" && item !== null)) : [];
  const payloadOf = (value: unknown): Record<string, unknown> => typeof value === "object" && value !== null ? value as Record<string, unknown> : {};

  return <div className="min-h-screen bg-muted/30">
    <header className="sticky top-0 z-10 border-b bg-background/85 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-4">
        <div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-500/10 text-green-700"><MessageCircle className="h-5 w-5" /></div><div><h1 className="text-xl font-semibold">WhatsApp</h1><p className="text-xs text-muted-foreground">Totem Bot · configuración y actividad</p></div></div>
        <div className="flex items-center gap-2">
          {props.health.configured && <Button variant="outline" onClick={() => { setQrError(false); setQrRefresh(Date.now()); setQrOpen(true); }}>Ver QR</Button>}
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
      {notice && <div role="status" className="rounded-lg border bg-background px-4 py-3 text-sm">{notice}<button className="float-right text-muted-foreground" onClick={() => setNotice("")} aria-label="Cerrar aviso"><X className="h-4 w-4" /></button></div>}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card><CardContent className="flex items-center justify-between p-4"><div><p className="text-xs text-muted-foreground">Worker</p><p className="mt-1 font-semibold">{props.health.online === null ? "Sin configurar" : props.health.connected ? props.health.pairingOnly ? "Vínculo local verificado" : "En línea" : props.health.pairingOnly && props.health.qrAvailable ? "QR local disponible" : props.health.online ? "Disponible" : "Sin conexión"}</p>{props.health.details && <p className="text-xs text-muted-foreground">{props.health.details}</p>}</div><Radio className={props.health.online ? "h-5 w-5 text-green-600" : "h-5 w-5 text-muted-foreground"} /></CardContent></Card>
        <Card><CardContent className="flex items-center justify-between p-4"><div><p className="text-xs text-muted-foreground">Estado del bot</p><p className="mt-1 font-semibold">{props.config.paused ? "Pausado" : "Activo"}</p><p className="text-xs text-muted-foreground">Clientes: {props.config.clientsEnabled ? "habilitados" : "bloqueados"}</p></div><Bot className="h-5 w-5 text-muted-foreground" /></CardContent></Card>
        <Card><CardContent className="flex items-center justify-between p-4"><div><p className="text-xs text-muted-foreground">Cola</p><p className="mt-1 font-semibold">{props.config.queue?.pending ?? 0} por enviar</p><p className="text-xs text-muted-foreground">{props.config.queue?.draft ?? 0} borradores · {props.config.queue?.failed ?? 0} fallidos</p></div><Send className="h-5 w-5 text-muted-foreground" /></CardContent></Card>
        <Card><CardContent className="flex items-center justify-between p-4"><div><p className="text-xs text-muted-foreground">Bandeja de aprobación</p><p className="mt-1 font-semibold">{props.prompts.length} decisiones</p><p className="text-xs text-muted-foreground">{props.approvals.filter((a) => a.status === "PENDING").length} videos pendientes</p></div><Check className="h-5 w-5 text-muted-foreground" /></CardContent></Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="h-auto flex-wrap justify-start"><TabsTrigger value="config">Configuración</TabsTrigger><TabsTrigger value="inbox">Bandeja</TabsTrigger><TabsTrigger value="groups">Grupos</TabsTrigger><TabsTrigger value="team">Equipo</TabsTrigger><TabsTrigger value="clients">Clientes</TabsTrigger><TabsTrigger value="approvals">Aprobaciones</TabsTrigger><TabsTrigger value="history">Historial</TabsTrigger></TabsList>
        <TabsContent value="config"><GeneralSettings config={props.config} busy={busy} onSave={(value) => run(() => saveWhatsAppGeneralConfigAction(value), "Configuración guardada.")} /></TabsContent>
        <TabsContent value="inbox" className="grid gap-4 xl:grid-cols-2">
          <Card><CardHeader><CardTitle className="text-base">Decisiones del dueño</CardTitle><CardDescription>Las mismas opciones que recibe por WhatsApp. Vencen en 24 horas.</CardDescription></CardHeader><CardContent className="space-y-3">
            {props.prompts.length === 0 && <p className="text-sm text-muted-foreground">No hay decisiones pendientes.</p>}
            {props.prompts.map((prompt) => {
              const choices = optionsOf(prompt.options);
              const payload = payloadOf(prompt.payload);
              const summary = payload.summary ?? payload.question ?? payload.title ?? payload.message ?? payload.text ?? "Revisa la decisión propuesta por Totem Bot.";
              const referenceText = typeof payload.text === "string" && payload.text !== summary ? payload.text : null;
              return <article key={prompt.id} className="rounded-lg border p-4"><div className="flex flex-wrap items-center justify-between gap-2"><div className="font-medium">{promptTypeLabels[prompt.type] ?? prompt.type} <span className="text-muted-foreground">#{prompt.id}</span></div><Badge variant="secondary">Vence {new Date(prompt.expiresAt).toLocaleString("es-EC", { dateStyle: "short", timeStyle: "short" })}</Badge></div><p className="mt-2 whitespace-pre-wrap text-sm">{String(summary)}</p>{referenceText && <blockquote className="mt-2 rounded bg-muted p-3 text-sm"><span className="mb-1 block text-xs font-medium text-muted-foreground">Texto de referencia</span>{referenceText}</blockquote>}{payload.proposedText !== undefined && <blockquote className="mt-2 rounded bg-muted p-3 text-sm"><span className="mb-1 block text-xs font-medium text-muted-foreground">Respuesta propuesta</span>{String(payload.proposedText)}</blockquote>}<div className="mt-3 flex flex-wrap gap-2">{choices.map((choice, index) => { const label = typeof choice === "string" ? choice : choice.label ?? choice.text ?? choice.title ?? `Opción ${index + 1}`; return <Button key={index} size="sm" variant={index === 0 ? "default" : "outline"} disabled={busy} onClick={() => { if (prompt.type === "APPROVAL_DRAFT" && index === 2) { setActiveTab("approvals"); return; } run(() => decideOwnerPromptAction(prompt.id, String(index + 1)), "Decisión registrada."); }}>{label}</Button>; })}</div></article>;
            })}
          </CardContent></Card>
          <Card><CardHeader><CardTitle className="text-base">Borradores de salida</CardTitle><CardDescription>Editar antes de aprobar; aprobar envía el mensaje a la cola.</CardDescription></CardHeader><CardContent className="space-y-3">
            {props.drafts.length === 0 && <p className="text-sm text-muted-foreground">No hay borradores.</p>}
            {props.drafts.map((draft) => <DraftEditor key={draft.id} draft={draft} busy={busy} onSave={(body) => run(() => saveWhatsAppDraftAction(draft.id, body, false), "Edición guardada.")} onApprove={(body) => run(() => saveWhatsAppDraftAction(draft.id, body, true), "Borrador aprobado y encolado.")} onDiscard={() => run(() => discardWhatsAppDraftAction(draft.id), "Borrador descartado.")} />)}
          </CardContent></Card>
        </TabsContent>
        <TabsContent value="groups"><Card><CardHeader><CardTitle className="text-base">Grupos conectados</CardTitle><CardDescription>Asignación, funciones y modos por grupo. AUTO opera sin revisión previa.</CardDescription></CardHeader><CardContent className="space-y-3">
          {props.groups.length === 0 && <p className="text-sm text-muted-foreground">Aún no se han detectado grupos.</p>}
          {props.groups.map((group) => <GroupEditor key={group.id} group={group} clients={props.clients} busy={busy} onSave={(value) => run(() => updateWhatsAppGroupAction({ id: group.id, ...value }))} />)}
        </CardContent></Card></TabsContent>
        <TabsContent value="team"><Card><CardHeader><CardTitle className="text-base">Equipo</CardTitle><CardDescription>Teléfono, consentimiento de WhatsApp y horario de actividad.</CardDescription></CardHeader><CardContent className="space-y-3">
          {props.team.map((person) => <TeamEditor key={person.id} person={person} busy={busy} onSave={(value) => run(() => updateWhatsAppTeamMemberAction({ id: person.id, ...value }))} />)}
        </CardContent></Card></TabsContent>
        <TabsContent value="clients"><Card><CardHeader><CardTitle className="text-base">Clientes y cobros</CardTitle><CardDescription>Los mensajes a clientes quedan sujetos al interruptor global y al grupo habilitado.</CardDescription></CardHeader><CardContent className="space-y-3">
          {props.clients.map((client) => <ClientEditor key={client.id} client={client} reminderHours={client.approvalReminderHours ?? 48} busy={busy} onSave={(value) => run(() => updateWhatsAppClientAction({ id: client.id, ...value }))} />)}
        </CardContent></Card></TabsContent>
        <TabsContent value="approvals"><Card><CardHeader><CardTitle className="text-base">Aprobaciones de videos</CardTitle><CardDescription>Pendientes, sin match y resueltas. Deshacer restaura el estado anterior de la tarea.</CardDescription></CardHeader><CardContent className="space-y-2">
          {props.approvals.map((approval) => <div key={approval.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"><div className="min-w-0"><div className="flex items-center gap-2"><Badge variant={approval.status === "PENDING" ? "secondary" : "outline"}>{approval.status}</Badge><span className="font-medium">{approval.task?.title ?? approval.fileName ?? "Sin tarea emparejada"}</span></div><p className="mt-1 text-xs text-muted-foreground">{approval.task?.client.name ?? approval.groupJid} · {new Date(approval.sentAt).toLocaleString("es-EC")}{approval.task && ` · tarea: ${approval.task.status}`}</p></div>{approval.status === "APPROVED" && approval.previousTaskStatus && <Button size="sm" variant="outline" disabled={busy} onClick={() => run(() => undoWhatsAppApprovalAction(approval.id), "Aprobación deshecha; se restauró el estado anterior.")}><RotateCcw className="mr-2 h-4 w-4" />Deshacer</Button>}</div>)}
          {props.approvals.length === 0 && <p className="text-sm text-muted-foreground">No hay solicitudes de aprobación.</p>}
        </CardContent></Card></TabsContent>
        <TabsContent value="history" className="space-y-4"><Card><CardHeader><CardTitle className="text-base">Historial de mensajes</CardTitle><CardDescription>Últimos 100 mensajes encolados o enviados.</CardDescription></CardHeader><CardContent><div className="mb-4 flex flex-wrap gap-3"><Field label="Tipo"><select className="h-10 rounded-md border bg-background px-3 text-sm" value={historyKind} onChange={(e) => setHistoryKind(e.target.value)}><option value="ALL">Todos</option>{Array.from(new Set(props.history.map((x) => x.kind))).map((x) => <option key={x}>{x}</option>)}</select></Field><Field label="Estado"><select className="h-10 rounded-md border bg-background px-3 text-sm" value={historyStatus} onChange={(e) => setHistoryStatus(e.target.value)}><option value="ALL">Todos</option>{Array.from(new Set(props.history.map((x) => x.status))).map((x) => <option key={x}>{x}</option>)}</select></Field></div><div className="space-y-2">{filteredHistory.map((item) => <div key={item.id} className="rounded-lg border p-3"><div className="flex flex-wrap justify-between gap-2"><span className="font-medium">{item.kind} → {item.to}</span><Badge variant="outline">{item.status}</Badge></div><p className="mt-2 whitespace-pre-wrap text-sm">{item.body}</p><p className="mt-1 text-xs text-muted-foreground">{new Date(item.createdAt).toLocaleString("es-EC")}{item.error && ` · ${item.error}`}</p></div>)}{filteredHistory.length === 0 && <p className="text-sm text-muted-foreground">No hay mensajes con esos filtros.</p>}</div></CardContent></Card><Card><CardHeader><CardTitle className="text-base">Eventos recientes</CardTitle></CardHeader><CardContent className="space-y-2">{props.events.map((event) => <div key={event.id} className="flex items-start justify-between gap-3 rounded border p-3"><div><Badge variant="outline">{event.type}</Badge><pre className="mt-2 whitespace-pre-wrap break-words text-xs text-muted-foreground">{pretty(event.payload)}</pre></div><time className="shrink-0 text-xs text-muted-foreground">{new Date(event.createdAt).toLocaleString("es-EC")}</time></div>)}{props.events.length === 0 && <p className="text-sm text-muted-foreground">Sin eventos registrados.</p>}</CardContent></Card></TabsContent>
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
  return <article className="grid gap-4 rounded-lg border p-4 lg:grid-cols-[1fr_2fr_auto] lg:items-center"><div className="min-w-0"><p className="font-medium">{group.name}</p><p className="truncate text-xs text-muted-foreground">{group.jid}</p>{group.client && <p className="mt-1 text-xs">{group.client.name}</p>}</div><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Field label="Cliente"><select className="h-10 rounded-md border bg-background px-3 text-sm" value={clientId} onChange={(e) => setClientId(e.target.value)}><option value="">Sin asignar</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field><Field label="Funciones"><div className="flex flex-wrap gap-x-3 gap-y-2 pt-2">{PURPOSES.map((purpose) => <label key={purpose} className="flex items-center gap-1.5 text-xs"><input type="checkbox" checked={purposes.includes(purpose)} onChange={() => setPurposes((old) => old.includes(purpose) ? old.filter((x) => x !== purpose) : [...old, purpose])} />{purposeLabels[purpose]}</label>)}</div></Field><Field label="Respuestas IA"><select className="h-10 rounded-md border bg-background px-3 text-sm" value={aiMode} onChange={(e) => setAiMode(e.target.value)}><option>OFF</option><option>DRAFT</option><option value="AUTO" disabled>{group.aiMode === "AUTO" ? "AUTO (requiere aprobación)" : "AUTO (requiere aprobación)"}</option></select></Field><Field label="Aprobaciones"><select className="h-10 rounded-md border bg-background px-3 text-sm" value={approvalMode} onChange={(e) => setApprovalMode(e.target.value)}><option>OFF</option><option>DRAFT</option><option value="AUTO" disabled>AUTO (requiere aprobación)</option></select></Field></div><div className="flex items-center justify-between gap-3 lg:flex-col lg:items-end"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />Habilitado</label><Button size="sm" variant="outline" disabled={busy} onClick={() => onSave({ clientId: clientId || null, purposes, aiMode, approvalMode, enabled })}>Guardar</Button></div></article>;
}

function TeamEditor({ person, busy, onSave }: { person: Props["team"][number]; busy: boolean; onSave: (value: { phone: string; optedIn: boolean; activeSchedule: string }) => void }) {
  const [phone, setPhone] = useState(person.phone ?? ""); const [optedIn, setOptedIn] = useState(person.whatsappOptIn); const [activeSchedule, setActiveSchedule] = useState(person.activeSchedule == null ? "" : JSON.stringify(person.activeSchedule, null, 2));
  return <div className="grid gap-3 rounded-lg border p-4 md:grid-cols-[1fr_1fr_2fr_auto] md:items-end"><div><p className="font-medium">{person.name ?? person.email ?? "Usuario"}</p><p className="text-xs text-muted-foreground">{person.roleLegacy}</p></div><Field label="Teléfono"><Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="5939…" autoComplete="tel" /></Field><Field label="Horario activo"><Textarea value={activeSchedule} onChange={(e) => setActiveSchedule(e.target.value)} rows={3} maxLength={2000} placeholder={'{"type":"dates","dates":["2026-10-20","2026-10-27"]}'} aria-label={`Horario activo de ${person.name ?? person.email ?? "usuario"}`} /><span className="text-xs text-muted-foreground">Vacío = sin avisos programados. Para fechas específicas: <code>{'{"type":"dates","dates":["2026-10-20","2026-10-27"]}'}</code>. También admite <code>{'{"type":"weekdays","days":[1,2,3,4,5]}'}</code> (lunes 1 a domingo 7).</span></Field><div className="flex items-center gap-3"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={optedIn} onChange={(e) => setOptedIn(e.target.checked)} />Aceptó recibir WhatsApp</label><Button size="sm" variant="outline" disabled={busy} onClick={() => onSave({ phone, optedIn, activeSchedule })}>Guardar</Button></div></div>;
}

function ClientEditor({ client, reminderHours, busy, onSave }: { client: Props["clients"][number]; reminderHours: number; busy: boolean; onSave: (value: { phone: string; target: string; reminderHours: number }) => void }) {
  const [phone, setPhone] = useState(client.whatsappPhone ?? ""); const [target, setTarget] = useState(client.paymentReminderTarget); const [hours, setHours] = useState(String(reminderHours));
  return <div className="grid gap-3 rounded-lg border p-4 md:grid-cols-[1fr_1fr_1fr_1fr_auto] md:items-end"><div><p className="font-medium">{client.name}</p></div><Field label="Teléfono WhatsApp"><Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="5939…" /></Field><Field label="Destino de cobros"><select className="h-10 rounded-md border bg-background px-3 text-sm" value={target} onChange={(e) => setTarget(e.target.value)}><option value="GROUP">Grupo</option><option value="PERSONAL">Personal</option></select></Field><Field label="Horas antes de recordar"><Input type="number" min={1} max={168} value={hours} onChange={(e) => setHours(e.target.value)} /></Field><Button size="sm" variant="outline" disabled={busy} onClick={() => onSave({ phone, target, reminderHours: Number(hours) })}>Guardar</Button></div>;
}
