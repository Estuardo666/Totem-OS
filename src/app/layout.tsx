import type { CSSProperties } from "react";
import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Toaster } from "@/components/ui/toaster";
import { NextAuthSessionProvider } from "@/components/providers/session-provider";
import UploadThingProviderWrapper from "@/components/providers/uploadthing-provider";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { ThemeScript } from "@/components/providers/theme-script";
import { NextSSRPlugin } from "@uploadthing/react/next-ssr-plugin";
import { extractRouterConfig } from "uploadthing/server";
import { ourFileRouter } from "@/app/api/uploadthing/core";
import { ConditionalLayout } from "@/components/layouts/conditional-layout";
import { GoogleMapsScript } from "@/components/providers/google-maps-script";
import { PwaServiceWorker } from "@/components/providers/pwa-service-worker";
import { OneSignalProvider } from "@/components/providers/onesignal-provider";
import { getBrandSettings } from "@/actions/admin-actions";
import { PRIMARY_COLOR_COOKIE, resolvePrimaryColor } from "@/lib/theme";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const brandResult = await getBrandSettings();
  const faviconUrl = brandResult.success && brandResult.data?.favicon 
    ? brandResult.data.favicon 
    : "/favicon.ico";

  return {
    title: "Totem OS - Sistema Operativo Interno",
    description: "Sistema operativo interno para agencia de marketing digital",
    manifest: "/manifest.json",
    icons: {
      icon: [
        { url: faviconUrl },
        { url: "/icons/icon-v2-192x192.png", sizes: "192x192", type: "image/png" },
        { url: "/icons/icon-v2-512x512.png", sizes: "512x512", type: "image/png" },
      ],
      shortcut: [{ url: faviconUrl }],
      apple: [
        { url: "/apple-touch-icon.png?v=2", sizes: "180x180", type: "image/png" },
        { url: faviconUrl },
      ],
    },
    appleWebApp: {
      capable: true,
      statusBarStyle: "default",
      title: "Totem OS",
    },
    formatDetection: {
      telephone: false,
    },
  };
}

export const viewport: Viewport = {
  themeColor: "#5f40ff",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const cookieColor = cookieStore.get(PRIMARY_COLOR_COOKIE)?.value;
  const { hex: primaryColorHex, hsl: primaryColorHsl } = resolvePrimaryColor(cookieColor);
  const htmlStyle: CSSProperties & Record<string, string> = {
    "--primary-color": primaryColorHex,
    "--primary": primaryColorHsl,
  };

  return (
    <html lang="es" suppressHydrationWarning style={htmlStyle}>
      <head>
        <script async src="https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.js"></script>
        <link rel="apple-touch-icon" href="/apple-touch-icon.png?v=2" />
        <link rel="apple-touch-startup-image" href="/apple-splash/apple-splash-640x1136.png" media="(device-width: 320px) and (device-height: 568px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)" />
        <link rel="apple-touch-startup-image" href="/apple-splash/apple-splash-750x1334.png" media="(device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)" />
        <link rel="apple-touch-startup-image" href="/apple-splash/apple-splash-828x1792.png" media="(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)" />
        <link rel="apple-touch-startup-image" href="/apple-splash/apple-splash-1080x2340.png" media="(device-width: 360px) and (device-height: 780px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" />
        <link rel="apple-touch-startup-image" href="/apple-splash/apple-splash-1125x2436.png" media="(device-width: 375px) and (device-height: 812px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" />
        <link rel="apple-touch-startup-image" href="/apple-splash/apple-splash-1170x2532.png" media="(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" />
        <link rel="apple-touch-startup-image" href="/apple-splash/apple-splash-1242x2688.png" media="(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" />
        <link rel="apple-touch-startup-image" href="/apple-splash/apple-splash-1284x2778.png" media="(device-width: 428px) and (device-height: 926px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" />
        <link rel="apple-touch-startup-image" href="/apple-splash/apple-splash-1290x2796.png" media="(device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" />
        <link rel="apple-touch-startup-image" href="/apple-splash/apple-splash-1536x2048.png" media="(device-width: 768px) and (device-height: 1024px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)" />
        <link rel="apple-touch-startup-image" href="/apple-splash/apple-splash-1620x2160.png" media="(device-width: 810px) and (device-height: 1080px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)" />
        <link rel="apple-touch-startup-image" href="/apple-splash/apple-splash-1668x2224.png" media="(device-width: 834px) and (device-height: 1112px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)" />
        <link rel="apple-touch-startup-image" href="/apple-splash/apple-splash-1668x2388.png" media="(device-width: 834px) and (device-height: 1194px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)" />
        <link rel="apple-touch-startup-image" href="/apple-splash/apple-splash-2048x2732.png" media="(device-width: 1024px) and (device-height: 1366px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)" />
      </head>
      <body className="font-google-sans overflow-x-hidden">
        <ThemeScript />
        <GoogleMapsScript />
        <PwaServiceWorker />
        <NextSSRPlugin routerConfig={extractRouterConfig(ourFileRouter)} />
        <NextAuthSessionProvider>
          <OneSignalProvider>
            <ThemeProvider>
              <UploadThingProviderWrapper>
                <ConditionalLayout>
                  {children}
                </ConditionalLayout>
              </UploadThingProviderWrapper>
            </ThemeProvider>
          </OneSignalProvider>
        </NextAuthSessionProvider>
        <Toaster />
        <SpeedInsights />
      </body>
    </html>
  );
}
