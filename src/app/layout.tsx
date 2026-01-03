import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Toaster } from "@/components/ui/toaster";
import { NextAuthSessionProvider } from "@/components/providers/session-provider";
import UploadThingProviderWrapper from "@/components/providers/uploadthing-provider";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { NextSSRPlugin } from "@uploadthing/react/next-ssr-plugin";
import { extractRouterConfig } from "uploadthing/server";
import { ourFileRouter } from "@/app/api/uploadthing/core";
import { ConditionalLayout } from "@/components/layouts/conditional-layout";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

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
      <body className={`${inter.className} overflow-x-hidden`}>
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
