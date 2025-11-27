import { proxyGet } from "@/lib/server/apiProxy";

export const runtime = "nodejs";

export const GET = proxyGet("/api/auth/check-email");
