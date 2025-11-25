import { proxyPut } from "@/lib/server/apiProxy";

export const runtime = "nodejs";

export const PUT = proxyPut("/api/mypage/edit");
