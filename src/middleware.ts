import NextAuth from "next-auth";
import { authConfig } from "./auth.config";
import { NextResponse } from "next/server";

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const isAuth = !!req.auth;
  const isAuthPage = req.nextUrl.pathname.startsWith("/sign-in") || req.nextUrl.pathname.startsWith("/sign-up");
  const isPublicReport = req.nextUrl.pathname.startsWith("/reports/share");
  const userRole = req.auth?.user?.role;
  const isEditor = userRole === "EDITOR";

  // Permitir acceso público a reportes compartidos
  if (isPublicReport) {
    return NextResponse.next();
  }

  if (isAuthPage) {
    if (isAuth) return NextResponse.redirect(new URL("/", req.nextUrl));
    return NextResponse.next();
  }

  if (!isAuth) {
    return NextResponse.redirect(new URL("/sign-in", req.nextUrl));
  }

  // Bloquear acceso a /finance/settlement para EDITOR
  if (isEditor && req.nextUrl.pathname === "/finance/settlement") {
    return NextResponse.redirect(new URL("/finance", req.nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|api/uploadthing).*)"],
};

