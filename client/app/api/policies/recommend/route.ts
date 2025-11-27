import { NextRequest } from "next/server";
import { proxyRequest } from "@/lib/server/apiProxy";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  return proxyRequest(req, "/api/policies/recommend");
}
