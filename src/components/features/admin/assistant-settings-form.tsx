"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { Bot, CheckCircle2, KeyRound, Loader2, MessageSquare, Trash2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import {
  ASSISTANT_PROVIDERS,
  DEFAULT_LIVE_VOICE,
  DEFAULT_OPENAI_VOICE,
  LIVE_VOICES,
  OPENAI_REALTIME_MODELS,
  OPENAI_VOICES,
  VOICE_PROVIDERS,
  type VoiceProvider,
  PROVIDER_CATALOG,
  type AssistantProvider,
} from "@/lib/assistant/catalog";
import {
  type AssistantSettingsView,
  getAssistantSettings,
  removeAssistantApiKey,
  saveAssistantSettings,
  testAssistantConnection,
} from "@/actions/assistant-settings-actions";

const CUSTOM_MODEL = "__custom__";

export function AssistantSettingsForm() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<AssistantSettingsView | null>(null);
  const [provider, setProvider] = useState<AssistantProvider>("anthropic");
  const [model, setModel] = useState("");
  const [customModel, setCustomModel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [voice, setVoice] = useState<string>(DEFAULT_LIVE_VOICE);
  const [voiceProvider, setVoiceProvider] = useState<VoiceProvider>("gemini");
  const [openaiVoice, setOpenaiVoice] = useState<string>(DEFAULT_OPENAI_VOICE);
  const [openaiModel, setOpenaiModel] = useState<string>(OPENAI_REALTIME_MODELS[0].id);
  const [test, setTest] = useState<{ ok: boolean; message: string } | null>(null);
  const [isTesting, startTest] = useTransition();
  const [isSaving, startSave] = useTransition();

  const load = async () => {
    const result = await getAssistantSettings();
    if (!result.success || !result.data) return;
    const data = result.data;
    setSettings(data);
    setProvider(data.provider);
    setVoice(data.voiceSettings.voice);
    setVoiceProvider(data.voiceSettings.voiceProvider);
    setOpenaiVoice(data.voiceSettings.openaiVoice);
    setOpenaiModel(data.voiceSettings.openaiModel);
    const known = PROVIDER_CATALOG[data.provider].models.some((m) => m.id === data.model);
    setModel(known ? data.model : CUSTOM_MODEL);
    setCustomModel(known ? "" : data.model);
  };

  useEffect(() => {
    void load();
  }, []);

  const models = PROVIDER_CATALOG[provider].models;
  const resolvedModel = model === CUSTOM_MODEL ? customModel.trim() : model;
  const savedKey = settings?.keys[provider] ?? null;
  const payload = { provider, model: resolvedModel, apiKey: apiKey.trim() || undefined, voice, voiceProvider, openaiVoice, openaiModel };

  const onProviderChange = (value: string) => {
    const next = value as AssistantProvider;
    setProvider(next);
    setModel(PROVIDER_CATALOG[next].models[0].id);
    setCustomModel("");
    setApiKey("");
    setTest(null);
  };

  const onTest = () =>
    startTest(async () => {
      const result = await testAssistantConnection(payload);
      setTest(
        result.success && result.data
          ? { ok: true, message: `Conectado en ${result.data.ms} ms` }
          : { ok: false, message: result.error ?? "No se pudo conectar" }
      );
    });

  const onSave = () =>
    startSave(async () => {
      const result = await saveAssistantSettings(payload);
      if (result.success) {
        toast({ title: "Asistente guardado", description: `${PROVIDER_CATALOG[provider].label} · ${resolvedModel}` });
        setApiKey("");
        await load();
      } else {
        toast({ title: "No se pudo guardar", description: result.error, variant: "destructive" });
      }
    });

  const onRemoveKey = () =>
    startSave(async () => {
      const result = await removeAssistantApiKey(provider);
      if (result.success) {
        toast({ title: "Clave borrada" });
        await load();
      }
    });

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <div className="px-4 py-3 border-b bg-muted/30">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600">
            <Bot className="h-4 w-4 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-medium">Asistente IA</h3>
            <p className="text-xs text-muted-foreground">
              Modelo que piensa, consulta datos y ejecuta acciones
            </p>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/assistant">
              <MessageSquare className="mr-2 h-4 w-4" />
              Probar
            </Link>
          </Button>
        </div>
      </div>

      {!settings ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-4 px-4 py-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Proveedor</Label>
              <Select value={provider} onValueChange={onProviderChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ASSISTANT_PROVIDERS.map((p) => (
                    <SelectItem key={p} value={p}>
                      {PROVIDER_CATALOG[p].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Modelo</Label>
              <Select value={model} onValueChange={(v) => { setModel(v); setTest(null); }}>
                <SelectTrigger>
                  <SelectValue placeholder="Elige un modelo" />
                </SelectTrigger>
                <SelectContent>
                  {models.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.label}
                    </SelectItem>
                  ))}
                  <SelectItem value={CUSTOM_MODEL}>Otro (escribir id)…</SelectItem>
                </SelectContent>
              </Select>
              {model === CUSTOM_MODEL && (
                <Input
                  value={customModel}
                  onChange={(e) => setCustomModel(e.target.value)}
                  placeholder="id exacto del modelo"
                />
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5">
              <KeyRound className="h-3.5 w-3.5" />
              API key de {PROVIDER_CATALOG[provider].label}
            </Label>
            <div className="flex gap-2">
              <Input
                type="password"
                autoComplete="off"
                value={apiKey}
                onChange={(e) => { setApiKey(e.target.value); setTest(null); }}
                placeholder={
                  savedKey
                    ? `${savedKey.masked} (${savedKey.source === "env" ? "desde .env" : "guardada"}) — pega otra para reemplazar`
                    : "Pega tu API key"
                }
              />
              {savedKey?.source === "db" && (
                <Button variant="ghost" size="icon" onClick={onRemoveKey} disabled={isSaving} aria-label="Borrar clave">
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Se guarda cifrada en el servidor y nunca se envía al navegador.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Voz en vivo</Label>
              <Select value={voiceProvider} onValueChange={(v) => setVoiceProvider(v as VoiceProvider)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VOICE_PROVIDERS.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Voz</Label>
              {voiceProvider === "openai" ? (
                <Select value={openaiVoice} onValueChange={setOpenaiVoice}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {OPENAI_VOICES.map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Select value={voice} onValueChange={setVoice}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LIVE_VOICES.map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            {voiceProvider === "openai" && (
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Modelo Realtime</Label>
                <Select value={openaiModel} onValueChange={setOpenaiModel}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {OPENAI_REALTIME_MODELS.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <p className="text-xs text-muted-foreground sm:col-span-2">
              {voiceProvider === "openai"
                ? "Usa OPENAI_API_KEY (de pago, sin plan gratuito). Se aplica en la próxima conversación."
                : "Usa GEMINI_API_KEY. Se aplica en la próxima conversación."}
            </p>
          </div>

          {test && (
            <div className={`flex items-center gap-2 text-sm ${test.ok ? "text-emerald-600" : "text-destructive"}`}>
              {test.ok ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
              <span className="break-all">{test.message}</span>
            </div>
          )}

          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="outline" onClick={onTest} disabled={isTesting || !resolvedModel}>
              {isTesting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Probar conexión
            </Button>
            <Button onClick={onSave} disabled={isSaving || !resolvedModel}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Guardar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
