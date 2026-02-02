import type { Metadata } from "next";
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
import "./globals.css";

export const metadata: Metadata = {
  title: "Totem OS - Sistema Operativo Interno",
  description: "Sistema operativo interno para agencia de marketing digital",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Google+Sans:ital,opsz,wght@0,17..18,400..700;1,17..18,400..700&display=swap" rel="stylesheet" />
      </head>
      <body className="font-google-sans overflow-x-hidden">
        <ThemeScript />
        <GoogleMapsScript />
        <NextSSRPlugin routerConfig={extractRouterConfig(ourFileRouter)} />
        <NextAuthSessionProvider>
          <ThemeProvider>
            <UploadThingProviderWrapper>
              <ConditionalLayout>
                {children}
              </ConditionalLayout>
            </UploadThingProviderWrapper>
          </ThemeProvider>
        </NextAuthSessionProvider>
        <Toaster />
        <SpeedInsights />
      </body>
    </html>
  );
}
