import NextAuth from "next-auth";
import { authConfig } from "./auth.config";
import { NextResponse } from "next/server";
import { resolveRoleCode } from "./lib/roles";

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
    // roleCode es canónico; los campos legacy solo sirven para sesiones antiguas.
    // Sin un rol válido se aplica USER (mínimo privilegio), nunca EDITOR.
    const userRole = resolveRoleCode(req.auth?.user) ?? "USER";
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
    // Ante un fallo de autenticación se falla cerrado para rutas protegidas.
    const isPublicPath = req.nextUrl.pathname.startsWith("/sign-in")
      || req.nextUrl.pathname.startsWith("/sign-up")
      || req.nextUrl.pathname.startsWith("/privacy")
      || req.nextUrl.pathname.startsWith("/terms")
      || req.nextUrl.pathname.startsWith("/reports/share");
    return isPublicPath
      ? NextResponse.next()
      : NextResponse.redirect(createUrlWithPort(req.nextUrl, "/sign-in?error=auth"));
  }
});

export const config = {
  // Excluir sw.js y assets públicos para evitar redirecciones en el registro del Service Worker
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|sw.js|manifest.json|apple-touch-icon.png|icons/.*|android-chrome-.*|mstile-.*|api/uploadthing).*)"],
};

