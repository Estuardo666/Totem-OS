"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { GoogleGenAI, type LiveServerMessage, type Session } from "@google/genai";
import { confirmAssistantDraft } from "@/actions/assistant-actions";
import type { AgentDraft, AgentTurn } from "@/lib/assistant/agent";

export type VoiceStatus = "idle" | "connecting" | "listening" | "thinking" | "speaking" | "error";

export interface TranscriptLine {
  id: number;
  role: "user" | "assistant";
  text: string;
  /** Id del item de OpenAI: la transcripción del usuario llega después. */
  itemId?: string;
}

export interface DraftEntry extends AgentDraft {
  state: "pending" | "saving" | "done" | "cancelled" | { error: string };
}


function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

function fromBase64Pcm16(data: string): Float32Array<ArrayBuffer> {
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const pcm = new Int16Array(bytes.buffer);
  const out = new Float32Array(pcm.length);
  for (let i = 0; i < pcm.length; i++) out[i] = pcm[i] / 0x8000;
  return out;
}

/**
 * Sesión de voz con Gemini Live.
 *
 * El navegador se conecta directo a Gemini con un token efímero; las
 * herramientas de la voz se ejecutan aquí: `asistente` llama al modelo
 * pensador en el servidor y `confirmar`/`cancelar` resuelven el borrador.
 */
export function useLiveVoice() {
  const [status, setStatus] = useState<VoiceStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<TranscriptLine[]>([]);
  const [drafts, setDrafts] = useState<DraftEntry[]>([]);

  const sessionRef = useRef<Session | null>(null);
  // OpenAI Realtime (WebRTC): conexión, canal de eventos y audio remoto.
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  // OpenAI solo admite una respuesta activa: response.create se envía cuando
  // la anterior terminó (response.done).
  const responseActiveRef = useRef(false);
  const pendingResponseRef = useRef(false);
  const micCtxRef = useRef<AudioContext | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  // Medidor del micrófono: anima el orbe y detecta si el usuario habla.
  const levelCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const levelBufRef = useRef<Uint8Array<ArrayBuffer> | null>(null);
  const outCtxRef = useRef<AudioContext | null>(null);
  const playheadRef = useRef(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const historyRef = useRef<{ role: "user" | "assistant"; content: string }[]>([]);
  const draftsRef = useRef<DraftEntry[]>([]);
  const lineIdRef = useRef(0);
  // Texto que la voz dijo en el turno actual y si llamó a una herramienta.
  const turnTextRef = useRef("");
  const turnHadToolRef = useRef(false);
  const nudgedRef = useRef(false);

  const updateDrafts = (fn: (prev: DraftEntry[]) => DraftEntry[]) => {
    draftsRef.current = fn(draftsRef.current);
    setDrafts(draftsRef.current);
  };

  // Fuerza una línea nueva aunque el último mensaje sea del mismo rol.
  const newLineRef = useRef(false);

  const appendTranscript = (role: TranscriptLine["role"], text: string) => {
    const forceNew = newLineRef.current;
    newLineRef.current = false;
    setTranscript((prev) => {
      const last = prev[prev.length - 1];
      if (last && last.role === role && !forceNew) {
        return [...prev.slice(0, -1), { ...last, text: last.text + text }];
      }
      return [...prev, { id: ++lineIdRef.current, role, text }];
    });
  };

  /** Reserva el lugar del mensaje del usuario hasta que llegue su texto. */
  const reserveUserLine = (itemId: string) => {
    setTranscript((prev) =>
      prev.some((l) => l.itemId === itemId)
        ? prev
        : [...prev, { id: ++lineIdRef.current, role: "user", text: "…", itemId }]
    );
    newLineRef.current = true;
  };

  const fillUserLine = (itemId: string, text: string) => {
    setTranscript((prev) => {
      if (!prev.some((l) => l.itemId === itemId)) {
        return [...prev, { id: ++lineIdRef.current, role: "user", text, itemId }];
      }
      return text
        ? prev.map((l) => (l.itemId === itemId ? { ...l, text } : l))
        : prev.filter((l) => l.itemId !== itemId);
    });
  };

  const stopPlayback = () => {
    for (const s of sourcesRef.current) {
      try { s.stop(); } catch { /* ya terminó */ }
    }
    sourcesRef.current.clear();
    playheadRef.current = 0;
  };

  const playChunk = (data: string) => {
    const ctx = outCtxRef.current;
    if (!ctx) return;
    const samples = fromBase64Pcm16(data);
    const buffer = ctx.createBuffer(1, samples.length, 24000);
    buffer.copyToChannel(samples, 0);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    const startAt = Math.max(ctx.currentTime, playheadRef.current);
    source.start(startAt);
    playheadRef.current = startAt + buffer.duration;
    sourcesRef.current.add(source);
    source.onended = () => {
      sourcesRef.current.delete(source);
      if (sourcesRef.current.size === 0) setStatus((s) => (s === "speaking" ? "listening" : s));
    };
    setStatus("speaking");
  };

  const pendingDraft = () =>
    [...draftsRef.current].reverse().find((d) => d.state === "pending" || typeof d.state === "object");

  const confirmDraft = useCallback(async (token: string) => {
    updateDrafts((prev) => prev.map((d) => (d.draftToken === token ? { ...d, state: "saving" } : d)));
    const result = await confirmAssistantDraft(token);
    updateDrafts((prev) =>
      prev.map((d) =>
        d.draftToken === token
          ? { ...d, state: result.success ? "done" : { error: result.error ?? "No se pudo guardar" } }
          : d
      )
    );
    return result;
  }, []);

  const cancelDraft = useCallback((token: string) => {
    updateDrafts((prev) => prev.map((d) => (d.draftToken === token ? { ...d, state: "cancelled" } : d)));
  }, []);

  const runTool = async (name: string, args: Record<string, unknown>): Promise<Record<string, unknown>> => {
    if (name === "asistente") {
      const pedido = String(args.pedido ?? "");
      historyRef.current = [...historyRef.current, { role: "user" as const, content: pedido }].slice(-12);
      const res = await fetch("/api/assistant/agent", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: historyRef.current }),
      });
      const data = (await res.json()) as AgentTurn & { error?: string };
      if (!res.ok || data.error) return { error: data.error ?? "No pude consultar" };
      historyRef.current = [...historyRef.current, { role: "assistant" as const, content: data.text }].slice(-12);
      if (data.drafts.length) {
        updateDrafts((prev) => [
          ...prev.map((d) => (d.state === "pending" ? { ...d, state: "cancelled" as const } : d)),
          ...data.drafts.map((d) => ({ ...d, state: "pending" as const })),
        ]);
      }
      return {
        respuesta: data.text,
        hayBorradorPendiente: data.drafts.length > 0,
        // Solo el resumen: el token nunca va al modelo de voz.
        borradores: data.drafts.map((d) => ({ accion: d.action, resumen: d.summary })),
      };
    }

    const draft = pendingDraft();
    if (name === "confirmar") {
      if (!draft) return { error: "No hay ningún borrador pendiente." };
      const result = await confirmDraft(draft.draftToken);
      return result.success ? { ok: true, mensaje: "Guardado." } : { ok: false, error: result.error };
    }
    if (name === "cancelar") {
      if (draft) cancelDraft(draft.draftToken);
      return { ok: true };
    }
    return { error: `Herramienta desconocida: ${name}` };
  };

  const handleMessage = async (message: LiveServerMessage) => {
    const content = message.serverContent;
    if (content?.interrupted) stopPlayback();
    if (content?.inputTranscription?.text) appendTranscript("user", content.inputTranscription.text);
    if (content?.outputTranscription?.text) {
      appendTranscript("assistant", content.outputTranscription.text);
      turnTextRef.current += content.outputTranscription.text;
    }
    if (content?.inputTranscription?.text) nudgedRef.current = false;
    if (content?.turnComplete) {
      // Si anunció que iba a revisar pero no llamó a ninguna herramienta, se
      // lo recordamos una vez (los modelos de audio a veces lo olvidan).
      const announced = /(un segundo|un momento|déjame (ver|revisar)|reviso|voy a revisar|consult)/i.test(
        turnTextRef.current
      );
      if (announced && !turnHadToolRef.current && !nudgedRef.current) {
        nudgedRef.current = true;
        sessionRef.current?.sendClientContent({
          turns: [{ role: "user", parts: [{ text: "(Sistema: no llamaste a la herramienta. Llama a \"asistente\" ahora con el pedido.)" }] }],
          turnComplete: true,
        });
      }
      turnTextRef.current = "";
      turnHadToolRef.current = false;
    }
    for (const part of content?.modelTurn?.parts ?? []) {
      if (part.inlineData?.data) playChunk(part.inlineData.data);
    }

    const calls = message.toolCall?.functionCalls;
    if (calls?.length) {
      turnHadToolRef.current = true;
      setStatus("thinking");
      const functionResponses = await Promise.all(
        calls.map(async (call) => {
          let response: Record<string, unknown>;
          try {
            response = await runTool(call.name ?? "", (call.args ?? {}) as Record<string, unknown>);
          } catch (e) {
            response = { error: e instanceof Error ? e.message : "Error" };
          }
          return { id: call.id, name: call.name, response };
        })
      );
      sessionRef.current?.sendToolResponse({ functionResponses });
      setStatus("listening");
    }
  };

  const requestOpenAIResponse = () => {
    const dc = dcRef.current;
    if (dc?.readyState !== "open") return;
    responseActiveRef.current = true;
    dc.send(JSON.stringify({ type: "response.create" }));
  };

  /** Eventos de OpenAI Realtime por el canal de datos. */
  const handleOpenAIEvent = async (event: { type: string; [key: string]: unknown }) => {
    switch (event.type) {
      case "input_audio_buffer.speech_started":
        setStatus("listening");
        break;
      case "input_audio_buffer.committed":
        if (typeof event.item_id === "string") reserveUserLine(event.item_id);
        break;
      case "conversation.item.input_audio_transcription.completed":
        if (typeof event.item_id === "string") {
          fillUserLine(event.item_id, typeof event.transcript === "string" ? event.transcript.trim() : "");
        }
        break;
      case "response.output_audio_transcript.delta":
        if (typeof event.delta === "string") {
          appendTranscript("assistant", event.delta);
          setStatus("speaking");
        }
        break;
      case "response.created":
        responseActiveRef.current = true;
        newLineRef.current = true;
        break;
      case "response.done":
        responseActiveRef.current = false;
        if (pendingResponseRef.current) {
          pendingResponseRef.current = false;
          requestOpenAIResponse();
        } else {
          setStatus((s) => (s === "thinking" ? s : "listening"));
        }
        break;
      case "response.function_call_arguments.done": {
        setStatus("thinking");
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(String(event.arguments || "{}"));
        } catch {
          /* argumentos vacíos */
        }
        let output: Record<string, unknown>;
        try {
          output = await runTool(String(event.name), args);
        } catch (e) {
          output = { error: e instanceof Error ? e.message : "Error" };
        }
        const dc = dcRef.current;
        if (dc?.readyState === "open") {
          dc.send(
            JSON.stringify({
              type: "conversation.item.create",
              item: { type: "function_call_output", call_id: event.call_id, output: JSON.stringify(output) },
            })
          );
          if (responseActiveRef.current) pendingResponseRef.current = true;
          else requestOpenAIResponse();
        }
        break;
      }
      case "error": {
        const err = event.error as { message?: string } | undefined;
        setError(err?.message ?? "Error de la sesión de voz");
        break;
      }
    }
  };

  /** Conecta con OpenAI Realtime por WebRTC usando el token efímero. */
  const startOpenAI = async (token: string, stream: MediaStream) => {
    const pc = new RTCPeerConnection();
    pcRef.current = pc;

    const audio = new Audio();
    audio.autoplay = true;
    remoteAudioRef.current = audio;
    pc.ontrack = (e) => {
      audio.srcObject = e.streams[0];
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
        setError("Se perdió la conexión de voz");
        setStatus("error");
        stop();
      }
    };
    stream.getTracks().forEach((track) => pc.addTrack(track, stream));

    const dc = pc.createDataChannel("oai-events");
    dcRef.current = dc;
    dc.onopen = () => setStatus("listening");
    dc.onmessage = (e) => {
      try {
        void handleOpenAIEvent(JSON.parse(e.data));
      } catch {
        /* evento no JSON */
      }
    };

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    const res = await fetch("https://api.openai.com/v1/realtime/calls", {
      method: "POST",
      body: offer.sdp,
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/sdp" },
    });
    if (!res.ok) throw new Error(`OpenAI rechazó la conexión (${res.status})`);
    await pc.setRemoteDescription({ type: "answer", sdp: await res.text() });
  };

  const stop = useCallback(() => {
    sessionRef.current?.close();
    sessionRef.current = null;
    dcRef.current?.close();
    dcRef.current = null;
    pcRef.current?.close();
    pcRef.current = null;
    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = null;
      remoteAudioRef.current = null;
    }
    micStreamRef.current?.getTracks().forEach((t) => t.stop());
    micStreamRef.current = null;
    void levelCtxRef.current?.close();
    levelCtxRef.current = null;
    analyserRef.current = null;
    void micCtxRef.current?.close();
    micCtxRef.current = null;
    stopPlayback();
    void outCtxRef.current?.close();
    outCtxRef.current = null;
    setStatus((s) => (s === "error" ? s : "idle"));
  }, []);

  const start = useCallback(async () => {
    setError(null);
    setStatus("connecting");
    try {
      const tokenRes = await fetch("/api/assistant/live-token", { method: "POST" });
      const tokenData = (await tokenRes.json()) as {
        provider?: "gemini" | "openai";
        token?: string;
        model?: string;
        error?: string;
      };
      if (!tokenRes.ok || !tokenData.token || !tokenData.model) {
        throw new Error(tokenData.error ?? "No se pudo iniciar la voz");
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      micStreamRef.current = stream;
      const levelCtx = new AudioContext();
      const analyser = levelCtx.createAnalyser();
      analyser.fftSize = 512;
      levelCtx.createMediaStreamSource(stream).connect(analyser);
      levelCtxRef.current = levelCtx;
      analyserRef.current = analyser;
      levelBufRef.current = new Uint8Array(analyser.fftSize);

      if (tokenData.provider === "openai") {
        await startOpenAI(tokenData.token, stream);
        return;
      }

      outCtxRef.current = new AudioContext({ sampleRate: 24000 });

      const ai = new GoogleGenAI({ apiKey: tokenData.token, httpOptions: { apiVersion: "v1alpha" } });
      const session = await ai.live.connect({
        model: tokenData.model,
        callbacks: {
          onopen: () => setStatus("listening"),
          onmessage: (m) => void handleMessage(m),
          onerror: (e) => {
            setError((e as ErrorEvent).message || "Error de conexión");
            setStatus("error");
          },
          onclose: (e) => {
            if (e.code !== 1000 && e.reason) {
              setError(e.reason);
              setStatus("error");
            }
            stop();
          },
        },
      });
      sessionRef.current = session;

      const micCtx = new AudioContext({ sampleRate: 16000 });
      micCtxRef.current = micCtx;
      await micCtx.audioWorklet.addModule("/audio-worklets/pcm16-capture.js");
      const node = new AudioWorkletNode(micCtx, "pcm16-capture");
      node.port.onmessage = (e: MessageEvent<ArrayBuffer>) => {
        sessionRef.current?.sendRealtimeInput({
          audio: { data: toBase64(e.data), mimeType: "audio/pcm;rate=16000" },
        });
      };
      micCtx.createMediaStreamSource(stream).connect(node);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo iniciar la voz");
      setStatus("error");
      stop();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stop]);

  useEffect(() => stop, [stop]);

  /** Nivel del micrófono entre 0 y 1 (RMS); 0 sin sesión. */
  const getInputLevel = useCallback(() => {
    const analyser = analyserRef.current;
    const buf = levelBufRef.current;
    if (!analyser || !buf) return 0;
    analyser.getByteTimeDomainData(buf);
    let sum = 0;
    for (let i = 0; i < buf.length; i++) {
      const v = (buf[i] - 128) / 128;
      sum += v * v;
    }
    return Math.min(1, Math.sqrt(sum / buf.length) * 4);
  }, []);

  return { status, error, transcript, drafts, start, stop, confirmDraft, cancelDraft, getInputLevel };
}
