"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { usePwaDetect } from "@/hooks/use-pwa-detect";
import Image from "next/image";

interface SplashContextValue {
  isVisible: boolean;
  hideSplash: () => void;
}

const SplashContext = createContext<SplashContextValue>({
  isVisible: false,
  hideSplash: () => {},
});

export const useSplash = () => useContext(SplashContext);

const SPLASH_MIN_DURATION = 1500; // Minimum time to show splash (ms)
const SPLASH_MAX_DURATION = 4000; // Maximum time before auto-hide (ms)
const SPLASH_FADE_DURATION = 500; // Fade out animation duration (ms)

interface SplashProviderProps {
  children: ReactNode;
}

export function SplashProvider({ children }: SplashProviderProps) {
  const { isPwa, platform } = usePwaDetect();
  const [showSplash, setShowSplash] = useState(false);
  const [isFading, setIsFading] = useState(false);
  const [canHide, setCanHide] = useState(false);
  const [appReady, setAppReady] = useState(false);

  // Splash disabled for desktop PWAs
  useEffect(() => {
    // No splash screen for desktop Chrome PWA
  }, [isPwa, platform]);

  // Minimum duration timer
  useEffect(() => {
    if (!showSplash) return;

    const timer = setTimeout(() => {
      setCanHide(true);
    }, SPLASH_MIN_DURATION);

    return () => clearTimeout(timer);
  }, [showSplash]);

  // Maximum duration safety timer
  useEffect(() => {
    if (!showSplash) return;

    const timer = setTimeout(() => {
      setIsFading(true);
      setTimeout(() => setShowSplash(false), SPLASH_FADE_DURATION);
    }, SPLASH_MAX_DURATION);

    return () => clearTimeout(timer);
  }, [showSplash]);

  // Auto-hide when app is ready and minimum duration passed
  useEffect(() => {
    if (showSplash && canHide && appReady) {
      setIsFading(true);
      setTimeout(() => setShowSplash(false), SPLASH_FADE_DURATION);
    }
  }, [showSplash, canHide, appReady]);

  // Mark app as ready when page is fully loaded
  useEffect(() => {
    if (document.readyState === "complete") {
      setAppReady(true);
      return;
    }
    const handler = () => setAppReady(true);
    window.addEventListener("load", handler);
    return () => window.removeEventListener("load", handler);
  }, []);

  const hideSplash = useCallback(() => {
    if (showSplash && canHide) {
      setIsFading(true);
      setTimeout(() => setShowSplash(false), SPLASH_FADE_DURATION);
    }
  }, [showSplash, canHide]);

  return (
    <SplashContext.Provider value={{ isVisible: showSplash, hideSplash }}>
      {showSplash && <SplashScreen isFading={isFading} />}
      {children}
    </SplashContext.Provider>
  );
}

interface SplashScreenProps {
  isFading: boolean;
}

function SplashScreen({ isFading }: SplashScreenProps) {
  return (
    <div
      className={`
        fixed inset-0 z-[9999] flex flex-col items-center justify-center
        bg-[#050505] transition-opacity duration-500
        ${isFading ? "opacity-0" : "opacity-100"}
      `}
      style={{ 
        // Prevent any interaction while splash is visible
        pointerEvents: isFading ? "none" : "all" 
      }}
    >
      {/* Logo container with animation */}
      <div className="relative flex flex-col items-center gap-6">
        {/* Logo with pulse animation */}
        <div className="relative animate-pulse-slow">
          <Image
            src="/icons/icon-v2-192x192.png"
            alt="Totem OS"
            width={120}
            height={120}
            priority
            className="rounded-3xl shadow-2xl shadow-primary/20"
          />
          {/* Glow effect */}
          <div 
            className="absolute inset-0 rounded-3xl blur-xl opacity-30"
            style={{ backgroundColor: "var(--primary-color, #5f40ff)" }}
          />
        </div>

        {/* App name */}
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white tracking-wide">
            Totem OS
          </h1>
          <p className="text-sm text-white/50 mt-1">
            Sistema Operativo Interno
          </p>
        </div>

        {/* Loading indicator */}
        <div className="flex items-center gap-2 mt-4">
          <LoadingDots />
        </div>
      </div>

      {/* Bottom branding */}
      <div className="absolute bottom-8 text-center">
        <p className="text-xs text-white/30">
          Powered by Totem Agency
        </p>
      </div>
    </div>
  );
}

function LoadingDots() {
  return (
    <div className="flex gap-1.5">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-2 h-2 rounded-full animate-bounce"
          style={{
            backgroundColor: "var(--primary-color, #5f40ff)",
            animationDelay: `${i * 150}ms`,
            animationDuration: "600ms",
          }}
        />
      ))}
    </div>
  );
}
