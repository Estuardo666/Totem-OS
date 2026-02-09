"use client";

interface TTSOptions {
  rate?: number;
  volume?: number;
  voice?: string;
  onEnd?: () => void;
  onError?: (error: unknown) => void;
}

type TTSProvider = "web-speech" | "google-tts";

// Global audio element for mobile audio unlock
let globalAudioElement: HTMLAudioElement | null = null;
let audioUnlocked = false;

/**
 * Unlock audio playback on mobile devices.
 * Must be called from a user interaction (click/tap) handler.
 * This creates a silent audio context that allows future playback.
 */
export function unlockAudioForMobile(): Promise<void> {
  return new Promise((resolve) => {
    if (audioUnlocked) {
      console.log("[TTS] Audio already unlocked");
      resolve();
      return;
    }

    if (typeof window === "undefined") {
      resolve();
      return;
    }

    console.log("[TTS] Attempting to unlock audio for mobile...");

    // Create or reuse global audio element
    if (!globalAudioElement) {
      globalAudioElement = new Audio();
    }

    // Create a short silent audio data URL (minimal valid MP3)
    // This is a tiny silent MP3 that plays instantly
    const silentAudioBase64 = "data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//tQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAABhgC7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7v////////////////////////////////AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA//tQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAABhgC7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7v////////////////////////////////AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

    globalAudioElement.src = silentAudioBase64;
    globalAudioElement.volume = 0.01; // Near silent

    const playPromise = globalAudioElement.play();

    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          audioUnlocked = true;
          console.log("[TTS] Audio unlocked successfully for mobile");
          globalAudioElement?.pause();
          resolve();
        })
        .catch((error) => {
          console.warn("[TTS] Audio unlock failed (expected if not from user gesture):", error);
          resolve();
        });
    } else {
      // Older browsers without promise support
      audioUnlocked = true;
      resolve();
    }
  });
}

/**
 * Check if audio is unlocked for playback
 */
export function isAudioUnlocked(): boolean {
  return audioUnlocked;
}

/**
 * Text-to-Speech helper class with Google Cloud TTS and Web Speech API fallback
 * Compatible with iOS Safari, Chrome, and PWA
 */
export class TTS {
  private synth: SpeechSynthesis | null = null;
  private isIOS: boolean = false;
  private isMobile: boolean = false;
  private provider: TTSProvider;
  private currentAudio: HTMLAudioElement | null = null;
  private defaultVoice: string;
  private _isSpeaking: boolean = false;

  constructor(
    provider: TTSProvider = "web-speech",
    defaultVoice: string = "es-US-Neural2-A"
  ) {
    this.provider = provider;
    this.defaultVoice = defaultVoice;

    if (typeof window !== "undefined") {
      this.synth = window.speechSynthesis;
      this.isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      this.isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    }
  }

  /**
   * Get available Spanish voices for Web Speech API
   */
  getSpanishVoices(): SpeechSynthesisVoice[] {
    if (!this.synth) return [];

    const voices = this.synth.getVoices();
    return voices.filter((v) => v.lang.startsWith("es"));
  }

  /**
   * Local TTS using Web Speech API (free, works offline)
   */
  private speakLocal(text: string, options: TTSOptions = {}) {
    if (!this.synth) {
      console.warn("Web Speech API not supported");
      options.onError?.(new Error("Web Speech not supported"));
      return;
    }

    this.cancel();
    this._isSpeaking = true;

    const utterance = new SpeechSynthesisUtterance(text);

    // Select best Spanish voice
    const voices = this.getSpanishVoices();
    if (voices.length > 0) {
      const preferredVoice =
        voices.find((v) => v.lang === "es-CL" || v.lang === "es-AR") ||
        voices.find((v) => v.lang === "es-MX") ||
        voices[0];
      utterance.voice = preferredVoice;
    }

    utterance.lang = "es-CL";
    utterance.rate = options.rate || 1.0;
    utterance.pitch = 1.0;
    utterance.volume = options.volume || 1.0;

    utterance.onend = () => {
      this._isSpeaking = false;
      options.onEnd?.();
    };

    utterance.onerror = (event: SpeechSynthesisErrorEvent) => {
      this._isSpeaking = false;
      // Handle common "interrupted" and "canceled" errors silently
      if (event.error === "interrupted" || event.error === "canceled") {
        console.debug(`TTS ${event.error} - this is normal when canceling speech`);
        return;
      }
      const errorMessage = `Web Speech error: ${event.error || "unknown"}`;
      console.warn(errorMessage);
      options.onError?.(new Error(errorMessage));
    };

    // iOS fix: small delay to avoid bugs
    if (this.isIOS) {
      setTimeout(() => this.synth?.speak(utterance), 100);
    } else {
      this.synth.speak(utterance);
    }
  }

  /**
   * Cloud TTS using Google Cloud Text-to-Speech API
   */
  private async speakCloud(text: string, options: TTSOptions = {}) {
    try {
      this._isSpeaking = true;
      console.log("[TTS] Using Google Cloud TTS", { isMobile: this.isMobile, audioUnlocked });

      const response = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          voice: options.voice || this.defaultVoice,
          speed: options.rate || 1.0,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMsg = "TTS API error";
        try {
          const errorJson = JSON.parse(errorText);
          errorMsg = errorJson.error || errorMsg;
        } catch {
          errorMsg = errorText || errorMsg;
        }
        throw new Error(errorMsg);
      }

      // Create audio from blob
      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);

      this.currentAudio = new Audio(audioUrl);
      this.currentAudio.volume = options.volume || 1.0;
      
      // Mobile-specific: set playsinline attribute to help with iOS
      this.currentAudio.setAttribute("playsinline", "true");
      this.currentAudio.setAttribute("webkit-playsinline", "true");

      this.currentAudio.onended = () => {
        URL.revokeObjectURL(audioUrl);
        this.currentAudio = null;
        this._isSpeaking = false;
        options.onEnd?.();
      };

      this.currentAudio.onerror = (e) => {
        URL.revokeObjectURL(audioUrl);
        this._isSpeaking = false;
        console.log("[TTS] Audio playback error:", e);
        // On mobile, if audio fails, always fall back to Web Speech
        console.log("[TTS] Falling back to Web Speech");
        this.speakLocal(text, options);
      };

      try {
        // Try to play the audio
        await this.currentAudio.play();
        console.log("[TTS] Audio playback started successfully");
      } catch (playError) {
        URL.revokeObjectURL(audioUrl);
        this._isSpeaking = false;
        
        // This is likely a mobile autoplay restriction
        const errorMsg = playError instanceof Error ? playError.message : String(playError);
        console.warn("[TTS] Audio play() failed (likely mobile restriction):", errorMsg);
        
        // Fall back to Web Speech API which is more permissive on mobile
        console.log("[TTS] Falling back to Web Speech API for mobile");
        this.speakLocal(text, options);
      }
    } catch (error) {
      console.warn("[TTS] Google TTS unavailable:", error instanceof Error ? error.message : error);
      this._isSpeaking = false;
      // Auto fallback to Web Speech (don't call onError, let fallback handle it)
      console.log("[TTS] Falling back to Web Speech API");
      this.speakLocal(text, options);
    }
  }

  /**
   * Main speak method (uses configured provider)
   */
  speak(text: string, options: TTSOptions = {}) {
    console.log(`[TTS] speak() called with provider: ${this.provider}`);
    if (this.provider === "google-tts") {
      this.speakCloud(text, options);
    } else {
      console.log("[TTS] Using local Web Speech API");
      this.speakLocal(text, options);
    }
  }

  /**
   * Cancel any ongoing speech
   */
  cancel() {
    if (this.synth) {
      this.synth.cancel();
    }

    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
      this.currentAudio = null;
    }

    this._isSpeaking = false;
  }

  /**
   * Pause speech (Web Speech only)
   */
  pause() {
    if (this.synth && this.synth.speaking) {
      this.synth.pause();
    }
  }

  /**
   * Resume speech (Web Speech only)
   */
  resume() {
    if (this.synth && this.synth.paused) {
      this.synth.resume();
    }
  }

  /**
   * Check if currently speaking
   */
  isSpeaking(): boolean {
    return this._isSpeaking || (this.synth?.speaking ?? false) || this.currentAudio !== null;
  }

  /**
   * Get current provider
   */
  getProvider(): TTSProvider {
    return this.provider;
  }
}

// Singleton instances for each provider
let webSpeechInstance: TTS | null = null;
let googleTTSInstance: TTS | null = null;

/**
 * Get TTS instance (singleton per provider)
 */
export function getTTS(
  provider: TTSProvider = "web-speech",
  voice?: string
): TTS {
  if (provider === "google-tts") {
    if (!googleTTSInstance) {
      googleTTSInstance = new TTS("google-tts", voice || "es-US-Neural2-A");
    }
    return googleTTSInstance;
  }

  if (!webSpeechInstance) {
    webSpeechInstance = new TTS("web-speech", voice);
  }
  return webSpeechInstance;
}

/**
 * Available Google TTS voices for Spanish (LATAM)
 * Source: https://cloud.google.com/text-to-speech/docs/voices
 */
export const GOOGLE_TTS_VOICES = [
  { id: "es-US-Neural2-A", name: "LATAM Femenina (estilo Alexa)", gender: "female" },
  { id: "es-US-Neural2-B", name: "LATAM Masculina", gender: "male" },
  { id: "es-US-Neural2-C", name: "LATAM Femenina (tono maduro)", gender: "female" },
] as const;

export type GoogleTTSVoiceId = (typeof GOOGLE_TTS_VOICES)[number]["id"];
