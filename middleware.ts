// 📂 middleware.ts
import { NextResponse, type NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  // ✅ nunca mexe em /api
  if (req.nextUrl.pathname.startsWith("/api")) {
    return NextResponse.next();
  }
  return NextResponse.next();
}

// ✅ IMPORTANTÍSSIMO: exclui /api do matcher
export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};