// 📂 middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(_req: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: ["/:path*"], // pode deixar assim ou remover o matcher
};