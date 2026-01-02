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
  const isAuth = !!req.auth;
  const isAuthPage = req.nextUrl.pathname.startsWith("/sign-in") || req.nextUrl.pathname.startsWith("/sign-up");
  const isPublicReport = req.nextUrl.pathname.startsWith("/reports/share");
  const userRole = req.auth?.user?.role;
  const isEditor = userRole === "EDITOR";

  // Debug logging (desactivar en producción)
  console.log(`[Middleware] Path: ${req.nextUrl.pathname}, isAuth: ${isAuth}, role: ${userRole}, port: ${req.nextUrl.port}, fullUrl: ${req.nextUrl.toString()}`);

  // Permitir acceso público a reportes compartidos
  if (isPublicReport) {
    return NextResponse.next();
  }

  if (isAuthPage) {
    if (isAuth) {
      console.log(`[Middleware] Redirigiendo autenticado a dashboard desde ${req.nextUrl.pathname}`);
      return NextResponse.redirect(createUrlWithPort(req.nextUrl, "/"));
    }
    return NextResponse.next();
  }

  if (!isAuth) {
    console.log(`[Middleware] No autenticado, redirigiendo a sign-in desde ${req.nextUrl.pathname}`);
    return NextResponse.redirect(createUrlWithPort(req.nextUrl, "/sign-in"));
  }

  // Bloquear acceso a /finance/settlement para EDITOR
  if (isEditor && req.nextUrl.pathname === "/finance/settlement") {
    return NextResponse.redirect(createUrlWithPort(req.nextUrl, "/finance"));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|api/uploadthing).*)"],
};

