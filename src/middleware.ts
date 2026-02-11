import NextAuth from "next-auth";
import { authConfig } from "./auth.config";
import { NextResponse } from "next/server";

const { auth } = NextAuth(authConfig);

// Función auxiliar para crear URLs que preservan el puerto
function createUrlWithPort(baseUrl: URL, path: string): URL {
  const url = new URL(path, baseUrl.toString());
  // Asegurar que el puerto se preserve
  url.port = baseUrl.port;
  return url;
}

export default auth((req) => {
  try {
    const isAuth = !!req.auth;
    const isAuthPage = req.nextUrl.pathname.startsWith("/sign-in") || req.nextUrl.pathname.startsWith("/sign-up");
    const isPublicReport = req.nextUrl.pathname.startsWith("/reports/share");
    const isPolicyPage = req.nextUrl.pathname.startsWith("/privacy") || req.nextUrl.pathname.startsWith("/terms");
    // Intentar leer roleLegacy primero, luego role como fallback
    // Si ambos son null/undefined, asumir EDITOR para no bloquear el acceso
    const userRole = req.auth?.user?.roleLegacy || req.auth?.user?.role || "EDITOR";
    const isEditor = userRole === "EDITOR";

    // Permitir acceso público a reportes compartidos
    if (isPublicReport) {
      return NextResponse.next();
    }

    // Permitir acceso público a páginas de políticas (para verificación con Google, etc)
    if (isPolicyPage) {
      return NextResponse.next();
    }

    if (isAuthPage) {
      if (isAuth) {
        return NextResponse.redirect(createUrlWithPort(req.nextUrl, "/"));
      }
      return NextResponse.next();
    }

    if (!isAuth) {
      return NextResponse.redirect(createUrlWithPort(req.nextUrl, "/sign-in"));
    }

    // Bloquear acceso a rutas de administrador para no ADMIN
    const isAdminRoute = req.nextUrl.pathname.startsWith("/admin");
    if (isAdminRoute && userRole !== "ADMIN") {
      return NextResponse.redirect(createUrlWithPort(req.nextUrl, "/"));
    }

    // Bloquear acceso a /finance/settlement para EDITOR
    if (isEditor && req.nextUrl.pathname === "/finance/settlement") {
      return NextResponse.redirect(createUrlWithPort(req.nextUrl, "/finance"));
    }

    return NextResponse.next();
  } catch (error) {
    console.error("[Middleware] Error:", error);
    // En caso de error, permitir pasar (no bloquear el sitio)
    return NextResponse.next();
  }
});

export const config = {
  // Excluir sw.js y assets públicos para evitar redirecciones en el registro del Service Worker
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|sw.js|manifest.json|apple-touch-icon.png|icons/.*|android-chrome-.*|mstile-.*|api/uploadthing).*)"],
};

